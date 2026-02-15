// lib/trade-engine/packageBuilder.ts
import type { Asset, LeagueIntelligence, TradeCandidate, TradeEngineOutput } from "./types";
import { runTradeEngine } from "./trade-engine";
import {
  applyParityGuardrailsToCandidates,
  type GuardrailsConfig,
  type GuardrailCandidateDebug,
  type GuardrailReasonCode,
} from "./guardrails";

export type OfferBand = "FAIR" | "AGGRESSIVE" | "OVERPAY";

export type OfferBandsConfig = {
  fairPct?: number;
  aggressiveMinPct?: number;
  aggressiveMaxPct?: number;
  overpayMinPct?: number;
  overpayMaxPct?: number;
};

export type BuildPackagesParams = {
  userRosterId: number;
  partnerRosterId: number;
  target: Asset;
  intelligence: LeagueIntelligence;
  constraints?: any;
  bands?: OfferBandsConfig;
  guardrails?: GuardrailsConfig;
  includeGuardrailDebug?: boolean;
};

export type BuiltOfferPackages = {
  target: Asset;
  engineStats: TradeEngineOutput["stats"];
  offers: Partial<Record<OfferBand, TradeCandidate>>;
  notes: string[];
  meta?: {
    tpiByRosterId?: Record<number, number>;
    userTpi?: number;
    partnerTpi?: number;
  };
  debug?: {
    guardrails?: {
      removedCount: number;
      removed?: GuardrailCandidateDebug[];
      summaryByCode?: Record<GuardrailReasonCode, number>;
    };
  };
};

function candidateAcquiresTarget(
  c: TradeCandidate,
  userRosterId: number,
  partnerRosterId: number,
  target: Asset
): boolean {
  const targetInReceive = (c.receive ?? []).some((a) => a.type === target.type && a.id === target.id);
  const targetInGive = (c.give ?? []).some((a) => a.type === target.type && a.id === target.id);

  if (c.fromRosterId === partnerRosterId && c.toRosterId === userRosterId && targetInReceive) return true;

  if (c.fromRosterId === userRosterId && c.toRosterId === partnerRosterId && targetInGive) return false;

  if (targetInReceive && (c.toRosterId === userRosterId || c.fromRosterId === partnerRosterId)) return true;

  return false;
}

function bandRanges(targetValue: number, bands?: OfferBandsConfig) {
  const fairPct = bands?.fairPct ?? 0.08;
  const aggressiveMin = bands?.aggressiveMinPct ?? 0.88;
  const aggressiveMax = bands?.aggressiveMaxPct ?? 0.95;
  const overpayMin = bands?.overpayMinPct ?? 1.08;
  const overpayMax = bands?.overpayMaxPct ?? 1.18;

  const fair = { min: targetValue * (1 - fairPct), max: targetValue * (1 + fairPct) };
  const aggressive = { min: targetValue * aggressiveMin, max: targetValue * aggressiveMax };
  const overpay = { min: targetValue * overpayMin, max: targetValue * overpayMax };

  return { fair, aggressive, overpay };
}

function selectCheapestInRange(
  candidates: TradeCandidate[],
  range: { min: number; max: number }
): TradeCandidate | undefined {
  const inRange = candidates.filter((c) => c.giveTotal >= range.min && c.giveTotal <= range.max);
  if (!inRange.length) return undefined;

  inRange.sort((a, b) => {
    if (a.giveTotal !== b.giveTotal) return a.giveTotal - b.giveTotal;
    const aN = (a.give?.length ?? 0);
    const bN = (b.give?.length ?? 0);
    if (aN !== bN) return aN - bN;
    return (b.fairnessScore ?? 0) - (a.fairnessScore ?? 0);
  });

  return inRange[0];
}

function selectClosestToBand(
  candidates: TradeCandidate[],
  range: { min: number; max: number }
): TradeCandidate | undefined {
  if (!candidates.length) return undefined;
  const mid = (range.min + range.max) / 2;

  const scored = candidates.map((c) => ({
    c,
    dist: Math.abs((c.giveTotal ?? 0) - mid),
  }));

  scored.sort((a, b) => {
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (a.c.giveTotal !== b.c.giveTotal) return a.c.giveTotal - b.c.giveTotal;
    return (b.c.fairnessScore ?? 0) - (a.c.fairnessScore ?? 0);
  });

  return scored[0]?.c;
}

export function buildCheapestFairOfferPackages(params: BuildPackagesParams): BuiltOfferPackages {
  const {
    userRosterId,
    partnerRosterId,
    target,
    intelligence,
    constraints,
    bands,
    guardrails,
    includeGuardrailDebug,
  } = params;

  const engineOut: TradeEngineOutput = runTradeEngine(userRosterId, intelligence, constraints);
  const allValid = engineOut.validTrades ?? [];

  const matchingAll = allValid.filter((c) => candidateAcquiresTarget(c, userRosterId, partnerRosterId, target));

  const notes: string[] = [];
  if (!matchingAll.length) {
    notes.push("No engine-valid trades found that acquire the target asset from this partner.");
    return {
      target,
      engineStats: engineOut.stats,
      offers: {},
      notes,
    };
  }

  matchingAll.sort((a, b) => {
    if (a.giveTotal !== b.giveTotal) return a.giveTotal - b.giveTotal;
    return (b.fairnessScore ?? 0) - (a.fairnessScore ?? 0);
  });

  const gr = applyParityGuardrailsToCandidates({
    userRosterId,
    partnerRosterId,
    intelligence,
    candidates: matchingAll,
    config: {
      ...(guardrails ?? {}),
      includeReasonCodes: !!includeGuardrailDebug,
    },
  });

  let pool = gr.filtered;
  if (!pool.length) {
    notes.push(...gr.notes);
    notes.push("Guardrails removed all matches; falling back to unfiltered candidates for manual review.");
    pool = matchingAll;
  } else {
    notes.push(...gr.notes);
  }

  const targetValue = target.value ?? 0;
  const ranges = bandRanges(targetValue, bands);

  const fair = selectCheapestInRange(pool, ranges.fair) ?? selectClosestToBand(pool, ranges.fair);
  const aggressive = selectCheapestInRange(pool, ranges.aggressive) ?? selectClosestToBand(pool, ranges.aggressive);
  const overpay = selectCheapestInRange(pool, ranges.overpay) ?? selectClosestToBand(pool, ranges.overpay);

  if (fair && !(fair.giveTotal >= ranges.fair.min && fair.giveTotal <= ranges.fair.max)) {
    notes.push("FAIR offer is closest-available (no candidate fell within the fair band).");
  }
  if (aggressive && !(aggressive.giveTotal >= ranges.aggressive.min && aggressive.giveTotal <= ranges.aggressive.max)) {
    notes.push("AGGRESSIVE offer is closest-available (no candidate fell within the aggressive band).");
  }
  if (overpay && !(overpay.giveTotal >= ranges.overpay.min && overpay.giveTotal <= ranges.overpay.max)) {
    notes.push("OVERPAY offer is closest-available (no candidate fell within the overpay band).");
  }

  const result: BuiltOfferPackages = {
    target,
    engineStats: engineOut.stats,
    offers: {
      FAIR: fair,
      AGGRESSIVE: aggressive,
      OVERPAY: overpay,
    },
    notes,
    meta: {
      tpiByRosterId: gr.tpiByRosterId,
      userTpi: gr.tpiByRosterId?.[userRosterId],
      partnerTpi: gr.tpiByRosterId?.[partnerRosterId],
    },
  };

  if (includeGuardrailDebug) {
    result.debug = {
      guardrails: {
        removedCount: gr.removedCount,
        removed: gr.removed,
        summaryByCode: gr.summaryByCode as any,
      },
    };
  }

  return result;
}
