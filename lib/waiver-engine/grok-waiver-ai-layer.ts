// lib/waiver-engine/grok-waiver-ai-layer.ts
import type { WaiverSuggestion } from "./waiver-types";
import { enrichWaiverSuggestionWithGrok } from "./grok-waiver-enrichment";

type GrokWaiverAssistConfig = {
  enabled?: boolean;
  maxSuggestions?: number;
  concurrency?: number;
  leagueMeta?: {
    leagueName?: string;
    format?: "dynasty" | "redraft" | string;
    superflex?: boolean;
    tep?: boolean;
    idp?: boolean;
  };
  teamContextNotes?: string[];
};

function envBool(name: string, fallback = false): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function pLimit(concurrency: number) {
  let active = 0;
  const q: Array<() => void> = [];
  const next = () => {
    active--;
    if (q.length) q.shift()!();
  };
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((r) => q.push(r));
    active++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

export async function runGrokAssistOnWaiverSuggestions(
  suggestions: WaiverSuggestion[],
  cfg?: GrokWaiverAssistConfig
): Promise<{ suggestions: WaiverSuggestion[]; grok: { enriched: number; attempted: number; notes: string[] } }> {
  const enabled = cfg?.enabled ?? envBool("GROK_ENRICH_WAIVERS_ENABLED", false);
  const maxSuggestions = cfg?.maxSuggestions ?? Number(process.env.GROK_ENRICH_WAIVERS_MAX || "10");
  const concurrency = cfg?.concurrency ?? Number(process.env.GROK_ENRICH_WAIVERS_CONCURRENCY || "3");

  const notes: string[] = [];
  if (!enabled) return { suggestions, grok: { enriched: 0, attempted: 0, notes: ["Grok waiver enrichment disabled."] } };
  if (!suggestions?.length) return { suggestions: suggestions || [], grok: { enriched: 0, attempted: 0, notes: ["No waiver suggestions to enrich."] } };

  const limiter = pLimit(Math.max(1, concurrency));
  const slice = suggestions.slice(0, Math.max(0, maxSuggestions));

  const out = [...suggestions];
  let enriched = 0;

  await Promise.all(
    slice.map((s, idx) =>
      limiter(async () => {
        const res = await enrichWaiverSuggestionWithGrok({
          leagueMeta: cfg?.leagueMeta,
          suggestion: s,
          teamContextNotes: cfg?.teamContextNotes,
        });

        if (!res.ok) return;

        enriched++;
        out[idx] = {
          ...s,
          ai: {
            ...(s.ai ?? {}),
            confidence: res.confidence,
            narrative: s.ai?.narrative?.length ? s.ai.narrative : res.narrative,
            messageTemplate: s.ai?.messageTemplate ?? res.messageTemplate,
            tags: s.ai?.tags?.length ? s.ai.tags : res.tags,
            evidenceLinks: s.ai?.evidenceLinks?.length ? s.ai.evidenceLinks : res.evidenceLinks,
          },
        };
      })
    )
  );

  return { suggestions: out, grok: { enriched, attempted: slice.length, notes } };
}
