import { z } from "zod";

export const WinnerEnum = z.enum([
  "Team A",
  "Team B",
  "Even",
  "Slight edge to Team A",
  "Slight edge to Team B",
]);

export const VetoRiskEnum = z.enum(["None", "Low", "Moderate", "High"]);

export const TradeAnalysisSchema = z.object({
  winner: WinnerEnum,
  valueDelta: z.string(),
  factors: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(100),
  dynastyVerdict: z.string(),
  vetoRisk: z.string().optional(),
  agingConcerns: z.array(z.string()).optional(),
  recommendations: z.array(z.string()).optional(),
  youGiveAdjusted: z.string().optional(),
  youWantAdded: z.string().optional(),
  reason: z.string().optional(),
});

export type TradeAnalysis = z.infer<typeof TradeAnalysisSchema>;

export type ProviderResult = {
  provider: "openai" | "grok";
  analysis: TradeAnalysis | null;
  raw: any;
  latencyMs: number;
  error?: string;
  schemaValid: boolean;
  confidenceScore: number;
};

export type ConsensusAnalysis = TradeAnalysis & {
  meta: {
    providers: ProviderResult[];
    consensusMethod: "single" | "weighted_merge" | "primary_fallback";
    primaryProvider: "openai" | "grok";
    totalLatencyMs: number;
  };
};

export function scoreProviderResult(result: ProviderResult): number {
  let score = 0;

  if (result.schemaValid) score += 40;
  if (result.analysis) {
    score += Math.min(30, (result.analysis.confidence / 100) * 30);
    if (result.analysis.factors?.length >= 3) score += 10;
    if (result.analysis.valueDelta?.length > 10) score += 5;
    if (result.analysis.dynastyVerdict?.length > 10) score += 5;
    if (result.analysis.recommendations?.length) score += 5;
    if (result.analysis.agingConcerns?.length) score += 5;
  }

  return Math.min(100, score);
}

export function validateAndParseAnalysis(raw: any): {
  valid: boolean;
  analysis: TradeAnalysis | null;
} {
  try {
    const parsed = TradeAnalysisSchema.safeParse(raw);
    if (parsed.success) {
      return { valid: true, analysis: parsed.data };
    }

    const coerced = {
      ...raw,
      confidence:
        typeof raw?.confidence === "string"
          ? parseFloat(raw.confidence)
          : raw?.confidence,
      factors: Array.isArray(raw?.factors) ? raw.factors : [],
    };

    const retry = TradeAnalysisSchema.safeParse(coerced);
    if (retry.success) {
      return { valid: true, analysis: retry.data };
    }

    if (
      raw &&
      typeof raw === "object" &&
      raw.winner &&
      raw.dynastyVerdict
    ) {
      return {
        valid: false,
        analysis: {
          winner: raw.winner,
          valueDelta: raw.valueDelta || "",
          factors: Array.isArray(raw.factors) ? raw.factors : [],
          confidence:
            typeof raw.confidence === "number" ? raw.confidence : 50,
          dynastyVerdict: raw.dynastyVerdict || "",
          vetoRisk: raw.vetoRisk,
          agingConcerns: Array.isArray(raw.agingConcerns)
            ? raw.agingConcerns
            : undefined,
          recommendations: Array.isArray(raw.recommendations)
            ? raw.recommendations
            : undefined,
          youGiveAdjusted: raw.youGiveAdjusted,
          youWantAdded: raw.youWantAdded,
          reason: raw.reason,
        },
      };
    }

    return { valid: false, analysis: null };
  } catch {
    return { valid: false, analysis: null };
  }
}

function dedupeAndRank(arrA: string[], arrB: string[]): string[] {
  const seen = new Map<string, number>();

  for (const item of arrA) {
    const key = item.toLowerCase().trim();
    seen.set(key, (seen.get(key) || 0) + 2);
  }
  for (const item of arrB) {
    const key = item.toLowerCase().trim();
    seen.set(key, (seen.get(key) || 0) + 1);
  }

  const all = [...new Set([...arrA, ...arrB])];
  all.sort((a, b) => {
    const sa = seen.get(a.toLowerCase().trim()) || 0;
    const sb = seen.get(b.toLowerCase().trim()) || 0;
    return sb - sa;
  });

  return all;
}

function resolveWinner(
  a: TradeAnalysis,
  b: TradeAnalysis,
  scoreA: number,
  scoreB: number
): TradeAnalysis["winner"] {
  if (a.winner === b.winner) return a.winner;

  const winnerWeight = new Map<string, number>();
  const addWeight = (w: string, weight: number) =>
    winnerWeight.set(w, (winnerWeight.get(w) || 0) + weight);

  addWeight(a.winner, scoreA);
  addWeight(b.winner, scoreB);

  let best = a.winner;
  let bestScore = 0;
  for (const [w, s] of winnerWeight) {
    if (s > bestScore) {
      best = w as TradeAnalysis["winner"];
      bestScore = s;
    }
  }
  return best;
}

export function mergeAnalyses(
  results: ProviderResult[],
  primaryProvider: "openai" | "grok"
): ConsensusAnalysis | null {
  const valid = results.filter((r) => r.analysis !== null);

  if (valid.length === 0) return null;

  if (valid.length === 1) {
    const r = valid[0];
    return {
      ...r.analysis!,
      meta: {
        providers: results,
        consensusMethod: "single",
        primaryProvider,
        totalLatencyMs: Math.max(...results.map((r) => r.latencyMs)),
      },
    };
  }

  const primary = valid.find((r) => r.provider === primaryProvider) || valid[0];
  const secondary = valid.find((r) => r.provider !== primary.provider) || valid[1];

  const pScore = scoreProviderResult(primary);
  const sScore = scoreProviderResult(secondary);

  if (sScore < 30) {
    return {
      ...primary.analysis!,
      meta: {
        providers: results,
        consensusMethod: "primary_fallback",
        primaryProvider,
        totalLatencyMs: Math.max(...results.map((r) => r.latencyMs)),
      },
    };
  }

  const pA = primary.analysis!;
  const sA = secondary.analysis!;

  const totalWeight = pScore + sScore;
  const pWeight = pScore / totalWeight;
  const sWeight = sScore / totalWeight;

  const merged: TradeAnalysis = {
    winner: resolveWinner(pA, sA, pScore, sScore),
    valueDelta:
      pScore >= sScore ? pA.valueDelta : sA.valueDelta,
    factors: dedupeAndRank(pA.factors || [], sA.factors || []),
    confidence: Math.round(
      pA.confidence * pWeight + sA.confidence * sWeight
    ),
    dynastyVerdict:
      pScore >= sScore ? pA.dynastyVerdict : sA.dynastyVerdict,
    vetoRisk: pA.vetoRisk || sA.vetoRisk,
    agingConcerns: dedupeAndRank(
      pA.agingConcerns || [],
      sA.agingConcerns || []
    ),
    recommendations: dedupeAndRank(
      pA.recommendations || [],
      sA.recommendations || []
    ),
    youGiveAdjusted: pA.youGiveAdjusted || sA.youGiveAdjusted,
    youWantAdded: pA.youWantAdded || sA.youWantAdded,
    reason: pA.reason || sA.reason,
  };

  return {
    ...merged,
    meta: {
      providers: results,
      consensusMethod: "weighted_merge",
      primaryProvider,
      totalLatencyMs: Math.max(...results.map((r) => r.latencyMs)),
    },
  };
}
