import { z } from "zod";

export const VerdictEnum = z.enum([
  "Team A",
  "Team B",
  "Even",
  "Slight edge to Team A",
  "Slight edge to Team B",
  "Disagreement",
]);

export const VetoRiskEnum = z.enum(["None", "Low", "Moderate", "High"]);

export const PeerReviewVerdictSchema = z.object({
  verdict: VerdictEnum.exclude(["Disagreement"]),
  confidence: z.number().min(0).max(100),
  reasons: z.array(z.string()).min(1),
  counters: z.array(z.string()),
  warnings: z.array(z.string()),
}).strict();

export type PeerReviewVerdict = z.infer<typeof PeerReviewVerdictSchema>;

export const PEER_REVIEW_PROMPT_CONTRACT = `You are a peer reviewer evaluating a dynasty fantasy football trade. You must return ONLY valid JSON matching this exact schema — no markdown, no explanation outside the JSON:

{
  "verdict": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "confidence": <number 0-100>,
  "reasons": ["<why this verdict is correct — cite specific values, ADP, ages, injury data from the fact layer>", ...],
  "counters": ["<counter-arguments — reasons the OTHER side could be right, risks, caveats>", ...],
  "warnings": ["<data quality issues, missing info, age cliffs, injury red flags>", ...]
}

Rules:
- "verdict": who wins the trade based on the deterministic fact layer
- "confidence": 0-100, reduce for low data quality / missing valuations / stale injury data
- "reasons": 3-7 bullet points grounding your verdict in the provided numbers (market values, ADP, analytics, roster needs)
- "counters": 2-5 counter-arguments — why someone might disagree with your verdict
- "warnings": 0-5 data quality or risk warnings (missing ADP, stale injury data, age cliffs, etc.)
- Do NOT hallucinate values. Use ONLY the numbers in the deterministic fact layer.
- If data is missing for key players, note it in warnings and reduce confidence.`;

export const PEER_REVIEW_TEMPERATURE = 0.4;
export const PEER_REVIEW_MAX_TOKENS = 1500;

export type PeerReviewProviderResult = {
  provider: "openai" | "grok";
  verdict: PeerReviewVerdict | null;
  raw: any;
  latencyMs: number;
  error?: string;
  schemaValid: boolean;
};

export type DisagreementCode =
  | 'verdict_polarity_mismatch'
  | 'confidence_spread_high'
  | 'reason_overlap_low'
  | 'data_quality_concern'
  | 'provider_degraded';

export type PeerReviewConsensus = {
  verdict: z.infer<typeof VerdictEnum>;
  confidence: number;
  reasons: string[];
  counters: string[];
  warnings: string[];
  meta: {
    providers: PeerReviewProviderResult[];
    consensusMethod: "agreement" | "disagreement" | "single_provider" | "degraded_fallback";
    totalLatencyMs: number;
    confidenceAdjustment: string;
    disagreementCodes?: DisagreementCode[];
    disagreementDetails?: string;
  };
};

export function validateAndParsePeerReview(raw: any): {
  valid: boolean;
  verdict: PeerReviewVerdict | null;
} {
  if (!raw || typeof raw !== "object") return { valid: false, verdict: null };

  try {
    const result = PeerReviewVerdictSchema.safeParse(raw);
    if (result.success) return { valid: true, verdict: result.data };

    const coerced = {
      verdict: raw.verdict || raw.winner,
      confidence:
        typeof raw.confidence === "string"
          ? parseFloat(raw.confidence)
          : raw.confidence,
      reasons: Array.isArray(raw.reasons)
        ? raw.reasons
        : Array.isArray(raw.factors)
          ? raw.factors
          : [],
      counters: Array.isArray(raw.counters) ? raw.counters : [],
      warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    };

    const retry = PeerReviewVerdictSchema.safeParse(coerced);
    if (retry.success) return { valid: true, verdict: retry.data };

    if (coerced.verdict && VerdictEnum.exclude(["Disagreement"]).safeParse(coerced.verdict).success) {
      return {
        valid: false,
        verdict: {
          verdict: coerced.verdict,
          confidence: typeof coerced.confidence === "number" ? Math.min(100, Math.max(0, coerced.confidence)) : 50,
          reasons: Array.isArray(coerced.reasons) && coerced.reasons.length > 0 ? coerced.reasons : ["Analysis provided but schema incomplete"],
          counters: Array.isArray(coerced.counters) ? coerced.counters : [],
          warnings: Array.isArray(coerced.warnings) ? coerced.warnings : ["Provider returned non-standard schema"],
        },
      };
    }

    return { valid: false, verdict: null };
  } catch {
    return { valid: false, verdict: null };
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

function verdictClass(v: string): "A" | "B" | "Even" {
  if (v === "Team A" || v === "Slight edge to Team A") return "A";
  if (v === "Team B" || v === "Slight edge to Team B") return "B";
  return "Even";
}

export function mergePeerReviews(
  results: PeerReviewProviderResult[]
): PeerReviewConsensus | null {
  const valid = results.filter((r) => r.verdict !== null);

  if (valid.length === 0) return null;

  const totalLatencyMs = Math.max(...results.map((r) => r.latencyMs));

  if (valid.length === 1) {
    const r = valid[0];
    const failedProvider = results.find((p) => p.verdict === null);
    const isDegraded = !!failedProvider;
    const confidencePenalty = isDegraded ? 10 : 0;
    const adjustedConfidence = Math.max(0, r.verdict!.confidence - confidencePenalty);

    const warnings = [...r.verdict!.warnings];
    if (isDegraded) {
      warnings.push(`${failedProvider!.provider} failed (${failedProvider!.error || "unknown error"}) — using ${r.provider} only`);
    }

    return {
      verdict: r.verdict!.verdict,
      confidence: adjustedConfidence,
      reasons: r.verdict!.reasons,
      counters: r.verdict!.counters,
      warnings,
      meta: {
        providers: results,
        consensusMethod: isDegraded ? "degraded_fallback" : "single_provider",
        totalLatencyMs,
        confidenceAdjustment: isDegraded
          ? `−${confidencePenalty} (${failedProvider!.provider} unavailable)`
          : "none",
        ...(isDegraded ? {
          disagreementCodes: ['provider_degraded'] as DisagreementCode[],
          disagreementDetails: `${failedProvider!.provider} was unavailable, analysis based solely on ${r.provider}.`,
        } : {}),
      },
    };
  }

  const a = valid[0];
  const b = valid[1];
  const aV = a.verdict!;
  const bV = b.verdict!;

  const classA = verdictClass(aV.verdict);
  const classB = verdictClass(bV.verdict);

  const avgConfidence = Math.round((aV.confidence + bV.confidence) / 2);
  const mergedReasons = dedupeAndRank(aV.reasons, bV.reasons);
  const mergedCounters = dedupeAndRank(aV.counters, bV.counters);
  const mergedWarnings = dedupeAndRank(aV.warnings, bV.warnings);

  if (classA === classB) {
    const boostedConfidence = Math.min(100, avgConfidence + 10);
    const agreedVerdict = aV.confidence >= bV.confidence ? aV.verdict : bV.verdict;

    return {
      verdict: agreedVerdict,
      confidence: boostedConfidence,
      reasons: mergedReasons,
      counters: mergedCounters,
      warnings: mergedWarnings,
      meta: {
        providers: results,
        consensusMethod: "agreement",
        totalLatencyMs,
        confidenceAdjustment: `+10 (both providers agree: ${classA})`,
      },
    };
  }

  const cappedConfidence = Math.min(avgConfidence, 40);

  mergedWarnings.unshift(
    `Provider disagreement: ${a.provider} says "${aV.verdict}" (${aV.confidence}%), ${b.provider} says "${bV.verdict}" (${bV.confidence}%)`
  );

  const disagreementCodes: DisagreementCode[] = [];
  const detailParts: string[] = [];

  disagreementCodes.push('verdict_polarity_mismatch');
  detailParts.push(`${a.provider} rated "${classA}" while ${b.provider} rated "${classB}"`);

  const confidenceSpread = Math.abs(aV.confidence - bV.confidence);
  if (confidenceSpread >= 25) {
    disagreementCodes.push('confidence_spread_high');
    detailParts.push(`Confidence spread of ${confidenceSpread}% suggests different data interpretation`);
  }

  const aReasonSet = new Set(aV.reasons.map(r => r.toLowerCase().slice(0, 40)));
  const bReasonSet = new Set(bV.reasons.map(r => r.toLowerCase().slice(0, 40)));
  const overlap = [...aReasonSet].filter(r => bReasonSet.has(r)).length;
  const totalUnique = new Set([...aReasonSet, ...bReasonSet]).size;
  if (totalUnique > 0 && overlap / totalUnique < 0.3) {
    disagreementCodes.push('reason_overlap_low');
    detailParts.push(`Providers cited different reasoning (${Math.round((overlap / totalUnique) * 100)}% overlap)`);
  }

  return {
    verdict: "Disagreement",
    confidence: cappedConfidence,
    reasons: mergedReasons,
    counters: mergedCounters,
    warnings: mergedWarnings,
    meta: {
      providers: results,
      consensusMethod: "disagreement",
      totalLatencyMs,
      confidenceAdjustment: `capped at ${cappedConfidence} (verdict class mismatch: ${a.provider}=${classA}, ${b.provider}=${classB})`,
      disagreementCodes,
      disagreementDetails: detailParts.join('. ') + '.',
    },
  };
}

export const LegacyWinnerEnum = z.enum([
  "Team A",
  "Team B",
  "Even",
  "Slight edge to Team A",
  "Slight edge to Team B",
]);

export const WinnerEnum = LegacyWinnerEnum;

export const TradeAnalysisSchema = z.object({
  winner: LegacyWinnerEnum,
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
