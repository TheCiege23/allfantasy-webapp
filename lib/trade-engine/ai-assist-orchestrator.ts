// lib/trade-engine/ai-assist-orchestrator.ts
import type { TradeCandidate, TradeEngineOutput } from "./types";
import { runGrokAssistOnTradeEngineOutput } from "./grok-ai-layer";
import { runAiAssist as runOpenAiAssist } from "./ai-layer";

export type AiProviderMode = "off" | "openai" | "grok" | "both";

export type AssistSnapshotLike = {
  league?: any;
  profilesByRosterId?: Record<number, any>;
  [k: string]: any;
};

export type RunAssistOptions = {
  mode?: AiProviderMode;

  snapshot?: AssistSnapshotLike;
  userRosterId: number;

  trades?: TradeCandidate[];

  openai?: {
    enabled?: boolean;
  };

  grok?: {
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
  };

  includeNotes?: boolean;
};

function envStr(name: string, fallback: string) {
  const v = (process.env[name] ?? "").trim();
  return v ? v : fallback;
}
function envBool(name: string, fallback = false) {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
function resolveMode(explicit?: AiProviderMode): AiProviderMode {
  if (explicit) return explicit;
  const m = envStr("AI_ASSIST_MODE", "openai").toLowerCase();
  if (m === "off" || m === "openai" || m === "grok" || m === "both") return m;
  return "openai";
}

function buildLeagueMetaFromSnapshot(snapshot?: AssistSnapshotLike) {
  const league = snapshot?.league ?? {};
  return {
    leagueName: league?.name,
    format: league?.format,
    superflex: !!league?.superflex,
    tep: !!league?.tep,
    idp: !!league?.idp,
  } as const;
}

export async function runAssistOrchestrator(
  engineOut: TradeEngineOutput,
  opts: RunAssistOptions
): Promise<TradeEngineOutput & { assist?: { mode: AiProviderMode; notes?: string[] } }> {
  const mode = resolveMode(opts.mode);
  const includeNotes = opts.includeNotes ?? true;
  const notes: string[] = [];

  let out: TradeEngineOutput = {
    ...engineOut,
    validTrades: opts.trades ?? engineOut.validTrades ?? [],
  };

  if (mode === "off") {
    if (includeNotes) notes.push("AI assist is off (AI_ASSIST_MODE=off).");
    return { ...out, assist: includeNotes ? { mode, notes } : { mode } };
  }

  if (mode === "openai" || mode === "both") {
    const openAiEnabled =
      opts.openai?.enabled ?? envBool("OPENAI_ASSIST_ENABLED", true);

    if (!openAiEnabled) {
      if (includeNotes) notes.push("OpenAI assist skipped (OPENAI_ASSIST_ENABLED=false).");
    } else {
      if (!opts.snapshot) {
        if (includeNotes) notes.push("OpenAI assist skipped (snapshot missing).");
      } else {
        try {
          const enrichedTrades = await runOpenAiAssist({
            snapshot: opts.snapshot as any,
            userRosterId: opts.userRosterId,
            trades: out.validTrades ?? [],
          });

          if (Array.isArray(enrichedTrades)) {
            out = { ...out, validTrades: enrichedTrades };
          } else if (enrichedTrades && typeof enrichedTrades === "object") {
            const maybeTrades =
              (enrichedTrades as any).trades ??
              (enrichedTrades as any).validTrades ??
              (enrichedTrades as any).results;
            if (Array.isArray(maybeTrades)) out = { ...out, validTrades: maybeTrades };
          }

          if (includeNotes) notes.push("OpenAI assist applied.");
        } catch (e: any) {
          if (includeNotes) notes.push(`OpenAI assist failed: ${String(e?.message || e)}`);
        }
      }
    }
  }

  if (mode === "grok" || mode === "both") {
    const grokEnabled =
      opts.grok?.enabled ?? envBool("GROK_ENRICH_ENABLED", false);

    if (!grokEnabled) {
      if (includeNotes) notes.push("Grok assist skipped (GROK_ENRICH_ENABLED=false).");
    } else {
      try {
        const leagueMeta =
          opts.grok?.leagueMeta ?? buildLeagueMetaFromSnapshot(opts.snapshot);

        const grokOut = await runGrokAssistOnTradeEngineOutput(out, {
          enabled: true,
          maxCandidates: opts.grok?.maxCandidates,
          concurrency: opts.grok?.concurrency,
          leagueMeta,
        });

        out = {
          ...out,
          validTrades: grokOut.validTrades ?? out.validTrades,
        };

        if (includeNotes) {
          notes.push(`Grok assist applied (${grokOut.grok?.enriched ?? 0}/${grokOut.grok?.attempted ?? 0}).`);
        }
      } catch (e: any) {
        if (includeNotes) notes.push(`Grok assist failed: ${String(e?.message || e)}`);
      }
    }
  }

  return { ...out, assist: includeNotes ? { mode, notes } : { mode } };
}
