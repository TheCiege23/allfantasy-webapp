// lib/trade-engine/grok-ai-layer.ts
import type { TradeCandidate, TradeEngineOutput } from "./types";
import { enrichTradeCandidateWithGrok } from "./grok-enrichment";
import { guardrailCodesToUiList } from "./guardrailCopy";
import type { GuardrailCandidateDebug } from "./guardrails";

type GrokTradeAssistConfig = {
  enabled?: boolean;
  maxCandidates?: number;
  concurrency?: number;
  leagueMeta?: {
    leagueName?: string;
    format?: "dynasty" | "redraft";
    superflex?: boolean;
    tep?: boolean;
    idp?: boolean;
  };
  guardrailsRemoved?: GuardrailCandidateDebug[];
};

function envBool(name: string, fallback = false): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function pLimit(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()!();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      const result = await fn();
      return result;
    } finally {
      next();
    }
  };
}

export async function runGrokAssistOnTradeEngineOutput(
  output: TradeEngineOutput,
  config?: GrokTradeAssistConfig
): Promise<TradeEngineOutput & { grok?: { enriched: number; attempted: number; notes: string[] } }> {
  const enabled = config?.enabled ?? envBool("GROK_ENRICH_ENABLED", false);
  const maxCandidates = config?.maxCandidates ?? Number(process.env.GROK_ENRICH_MAX || "8");
  const concurrency = config?.concurrency ?? Number(process.env.GROK_ENRICH_CONCURRENCY || "3");

  const notes: string[] = [];
  if (!enabled) {
    notes.push("Grok enrichment disabled (GROK_ENRICH_ENABLED=false).");
    return { ...output, grok: { enriched: 0, attempted: 0, notes } };
  }

  const candidates = output.validTrades ?? [];
  if (!candidates.length) {
    notes.push("No valid trades to enrich.");
    return { ...output, grok: { enriched: 0, attempted: 0, notes } };
  }

  const slice = candidates.slice(0, Math.max(0, maxCandidates));
  const limiter = pLimit(Math.max(1, concurrency));

  const removedMap = new Map<string, GuardrailCandidateDebug>();
  for (const r of config?.guardrailsRemoved ?? []) removedMap.set(r.tradeId, r);

  let enriched = 0;

  const enrichedCandidates: TradeCandidate[] = [...candidates];

  await Promise.all(
    slice.map((c, idx) =>
      limiter(async () => {
        const removed = removedMap.get(c.id);
        const guardrailReasons =
          removed?.codes?.length
            ? guardrailCodesToUiList(removed.codes, removed.details).map((x) => x.short)
            : [];

        const res = await enrichTradeCandidateWithGrok({
          leagueMeta: config?.leagueMeta ?? {},
          candidate: c,
          guardrailReasons,
        });

        if (!res.ok) {
          return;
        }

        enriched++;

        const updated: TradeCandidate = {
          ...c,
          ai: {
            ...(c.ai ?? {}),
            messageTemplate: c.ai?.messageTemplate ?? res.messageTemplate,
            riskNarrative: c.ai?.riskNarrative?.length ? c.ai.riskNarrative : res.narrative,
            targetWhy: c.ai?.targetWhy?.length ? c.ai.targetWhy : res.narrative,
            restructureHints: c.ai?.restructureHints?.length ? c.ai.restructureHints : res.tags,
            timingNarrative: c.ai?.timingNarrative?.length
              ? c.ai.timingNarrative
              : res.evidenceLinks?.map((l) => `${l.label}: ${l.url}`),
          },
        };

        enrichedCandidates[idx] = updated;
      })
    )
  );

  return {
    ...output,
    validTrades: enrichedCandidates,
    grok: { enriched, attempted: slice.length, notes },
  };
}
