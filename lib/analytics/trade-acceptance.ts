import type { OpponentTendencies } from '../opponent-tendencies';

export interface AcceptanceFactor {
  label: string;
  delta: number;
  rationale: string;
}

export interface AcceptanceResult {
  score: number;
  factors: AcceptanceFactor[];
  summary: string;
}

export interface TradeAcceptanceInput {
  fairnessScore: number;
  valueDelta: number;
  myTotal: number;
  theirTotal: number;

  proposedAssets: Array<{
    type: 'player' | 'pick';
    name: string;
    pos?: string;
    value: number;
    pickYear?: number;
    pickRound?: number;
  }>;

  opponentTendencies?: OpponentTendencies | null;
  opponentTradeCount?: number;
  opponentSeasonsCovered?: number;

  targetRecord?: { wins: number; losses: number } | null;
  myRecord?: { wins: number; losses: number } | null;

  leagueSize?: number;
  currentWeek?: number;
  format?: 'dynasty' | 'redraft';
}

const BASE_SCORE = 50;

const WEIGHTS = {
  fairness: 22,
  needsAlignment: 15,
  tradeWillingness: 10,
  assetAlignment: 10,
  timing: 6,
  standingsPressure: 7,
  tradeFatigue: 5,
  loyaltyPenalty: 5,
} as const;

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function computeFairnessFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { fairnessScore, valueDelta, theirTotal } = input;

  const deltaRatio = theirTotal > 0 ? valueDelta / theirTotal : 0;

  let delta = 0;
  let rationale = '';

  if (fairnessScore >= 90) {
    delta = WEIGHTS.fairness * 0.9;
    rationale = 'Very fair trade — both sides close in value';
  } else if (fairnessScore >= 75) {
    delta = WEIGHTS.fairness * 0.5;
    rationale = 'Reasonably fair trade with minor value gap';
  } else if (fairnessScore >= 60) {
    delta = WEIGHTS.fairness * 0.1;
    rationale = 'Noticeable value gap — may need sweetener';
  } else if (fairnessScore >= 40) {
    delta = -WEIGHTS.fairness * 0.4;
    rationale = 'Significant value imbalance — hard sell';
  } else {
    delta = -WEIGHTS.fairness * 0.9;
    rationale = 'Major value gap — unlikely to be accepted';
  }

  if (deltaRatio > 0.15) {
    rationale += '. They receive more value';
  } else if (deltaRatio < -0.15) {
    rationale += '. They give up more value';
  }

  return {
    label: 'Trade Fairness',
    delta: Math.round(delta),
    rationale,
  };
}

function computeNeedsAlignmentFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { proposedAssets, opponentTendencies } = input;
  if (!opponentTendencies || !opponentTendencies.positionNeeds) {
    return { label: 'Roster Needs', delta: 0, rationale: 'Opponent needs unknown' };
  }

  const needs = opponentTendencies.positionNeeds;
  const topNeeds = Object.entries(needs)
    .filter(([, v]) => v > 0.1)
    .sort((a, b) => b[1] - a[1]);

  if (topNeeds.length === 0) {
    return { label: 'Roster Needs', delta: 2, rationale: 'Opponent roster is well-balanced' };
  }

  const playerAssets = proposedAssets.filter(a => a.type === 'player' && a.pos);
  let matchScore = 0;
  const matchedPositions: string[] = [];

  for (const asset of playerAssets) {
    const pos = asset.pos?.toUpperCase();
    if (!pos) continue;
    const needVal = needs[pos];
    if (needVal && needVal > 0.1) {
      matchScore += needVal * (asset.value / Math.max(input.theirTotal, 1));
      matchedPositions.push(pos);
    }
  }

  let delta: number;
  let rationale: string;

  if (matchScore > 0.3) {
    delta = WEIGHTS.needsAlignment * 0.9;
    rationale = `Fills key needs at ${[...new Set(matchedPositions)].join(', ')}`;
  } else if (matchScore > 0.15) {
    delta = WEIGHTS.needsAlignment * 0.5;
    rationale = `Partially addresses needs at ${[...new Set(matchedPositions)].join(', ')}`;
  } else if (matchScore > 0) {
    delta = WEIGHTS.needsAlignment * 0.15;
    rationale = 'Minor need alignment';
  } else {
    delta = -WEIGHTS.needsAlignment * 0.3;
    rationale = `Doesn't address top needs: ${topNeeds.slice(0, 2).map(([p]) => p).join(', ')}`;
  }

  return { label: 'Roster Needs', delta: Math.round(delta), rationale };
}

function computeTradeWillingnessFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { opponentTendencies } = input;
  if (!opponentTendencies) {
    return { label: 'Trade Activity', delta: 0, rationale: 'No trade history data' };
  }

  const w = opponentTendencies.tradeWillingness;

  let delta: number;
  let rationale: string;

  if (w >= 0.7) {
    delta = WEIGHTS.tradeWillingness * 0.8;
    rationale = 'Very active trader — open to deals';
  } else if (w >= 0.4) {
    delta = WEIGHTS.tradeWillingness * 0.3;
    rationale = 'Moderately active — will consider offers';
  } else if (w >= 0.2) {
    delta = -WEIGHTS.tradeWillingness * 0.2;
    rationale = 'Rarely trades — selective about offers';
  } else {
    delta = -WEIGHTS.tradeWillingness * 0.6;
    rationale = 'Very inactive trader — difficult to engage';
  }

  return { label: 'Trade Activity', delta: Math.round(delta), rationale };
}

function computeAssetAlignmentFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { proposedAssets, opponentTendencies } = input;
  if (!opponentTendencies) {
    return { label: 'Asset Fit', delta: 0, rationale: 'No preference data available' };
  }

  let alignmentScore = 0;
  const alignedTraits: string[] = [];

  const pickAssets = proposedAssets.filter(a => a.type === 'pick');
  const playerAssets = proposedAssets.filter(a => a.type === 'player');
  const totalAssets = proposedAssets.length || 1;
  const pickRatio = pickAssets.length / totalAssets;

  if (opponentTendencies.pickPreference > 0.55 && pickRatio > 0.3) {
    alignmentScore += 0.3;
    alignedTraits.push('loves picks');
  } else if (opponentTendencies.pickPreference < 0.4 && pickRatio > 0.5) {
    alignmentScore -= 0.2;
  }

  if (opponentTendencies.rookieBias > 0.55 && playerAssets.some(a => {
    const r = a.pickRound;
    return r && r <= 2;
  })) {
    alignmentScore += 0.2;
    alignedTraits.push('targets youth');
  }

  if (opponentTendencies.veteranLean > 0.55 && playerAssets.length > 0) {
    alignmentScore += 0.15;
    alignedTraits.push('prefers proven talent');
  }

  if (opponentTendencies.consolidationPreference > 0.55 && playerAssets.length <= 2) {
    alignmentScore += 0.15;
    alignedTraits.push('prefers consolidation');
  } else if (opponentTendencies.consolidationPreference > 0.55 && playerAssets.length > 3) {
    alignmentScore -= 0.1;
  }

  if (opponentTendencies.starChasing > 0.55) {
    const hasHighValue = playerAssets.some(a => a.value > 5000);
    if (hasHighValue) {
      alignmentScore += 0.2;
      alignedTraits.push('star chaser');
    }
  }

  let delta: number;
  let rationale: string;

  if (alignmentScore > 0.4) {
    delta = WEIGHTS.assetAlignment * 0.8;
    rationale = `Strong fit: ${alignedTraits.join(', ')}`;
  } else if (alignmentScore > 0.15) {
    delta = WEIGHTS.assetAlignment * 0.35;
    rationale = `Partial alignment: ${alignedTraits.join(', ') || 'some overlap'}`;
  } else if (alignmentScore >= 0) {
    delta = 0;
    rationale = 'Neutral asset alignment';
  } else {
    delta = -WEIGHTS.assetAlignment * 0.4;
    rationale = 'Asset types don\'t match their preferences';
  }

  return { label: 'Asset Fit', delta: Math.round(delta), rationale };
}

function computeTimingFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { currentWeek, format } = input;

  const now = new Date();
  const month = now.getMonth();
  const week = currentWeek ?? estimateNFLWeek(now);

  let delta: number;
  let rationale: string;

  if (format === 'dynasty') {
    if (month >= 1 && month <= 3) {
      delta = WEIGHTS.timing * 0.6;
      rationale = 'Offseason — peak dynasty trade window';
    } else if (month >= 4 && month <= 6) {
      delta = WEIGHTS.timing * 0.8;
      rationale = 'Draft season — high trade activity period';
    } else if (week && week <= 4) {
      delta = WEIGHTS.timing * 0.4;
      rationale = 'Early season — managers still adjusting rosters';
    } else if (week && week >= 5 && week <= 10) {
      delta = WEIGHTS.timing * 0.2;
      rationale = 'Mid-season — moderate trade activity';
    } else if (week && week >= 11 && week <= 13) {
      delta = -WEIGHTS.timing * 0.2;
      rationale = 'Late season — managers cautious near playoffs';
    } else if (week && week >= 14) {
      delta = -WEIGHTS.timing * 0.5;
      rationale = 'Playoff push — most managers locked in';
    } else {
      delta = 0;
      rationale = 'Standard timing';
    }
  } else {
    if (week && week <= 3) {
      delta = WEIGHTS.timing * 0.5;
      rationale = 'Early season — active trade window';
    } else if (week && week >= 4 && week <= 8) {
      delta = WEIGHTS.timing * 0.3;
      rationale = 'Mid-season — managers evaluating rosters';
    } else if (week && week >= 9 && week <= 11) {
      delta = -WEIGHTS.timing * 0.1;
      rationale = 'Late season — trade deadlines approaching';
    } else if (week && week >= 12) {
      delta = -WEIGHTS.timing * 0.7;
      rationale = 'Past trade deadline in most leagues';
    } else {
      delta = 0;
      rationale = 'Standard timing';
    }
  }

  return { label: 'Timing', delta: Math.round(delta), rationale };
}

function computeStandingsPressureFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { targetRecord, leagueSize } = input;
  if (!targetRecord) {
    return { label: 'Standings Pressure', delta: 0, rationale: 'Record data unavailable' };
  }

  const totalGames = targetRecord.wins + targetRecord.losses;
  if (totalGames === 0) {
    return { label: 'Standings Pressure', delta: 0, rationale: 'Season hasn\'t started' };
  }

  const winPct = targetRecord.wins / totalGames;
  const playoffSpots = Math.floor((leagueSize || 12) / 2);
  const playoffThreshold = playoffSpots / (leagueSize || 12);

  let delta: number;
  let rationale: string;

  if (winPct < 0.3 && totalGames >= 3) {
    delta = WEIGHTS.standingsPressure * 0.7;
    rationale = `Struggling at ${targetRecord.wins}-${targetRecord.losses} — desperate for changes`;
  } else if (winPct < playoffThreshold && totalGames >= 3) {
    delta = WEIGHTS.standingsPressure * 0.4;
    rationale = `Below playoff pace — motivated to improve`;
  } else if (winPct >= playoffThreshold && winPct < 0.65) {
    delta = WEIGHTS.standingsPressure * 0.1;
    rationale = 'On the bubble — open to upgrades';
  } else if (winPct >= 0.65) {
    delta = -WEIGHTS.standingsPressure * 0.3;
    rationale = 'Comfortable in standings — less urgency to trade';
  } else {
    delta = 0;
    rationale = 'Neutral standing';
  }

  return { label: 'Standings Pressure', delta: Math.round(delta), rationale };
}

function computeTradeFatigueFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { opponentTradeCount, opponentSeasonsCovered } = input;

  if (opponentTradeCount == null || opponentTradeCount === 0) {
    return { label: 'Trade Fatigue', delta: 0, rationale: 'No recent trade data' };
  }

  const seasons = Math.max(opponentSeasonsCovered || 1, 1);
  const tradesPerSeason = opponentTradeCount / seasons;

  let delta: number;
  let rationale: string;

  if (tradesPerSeason > 12) {
    delta = -WEIGHTS.tradeFatigue * 0.6;
    rationale = 'Very high trade volume — may be experiencing deal fatigue';
  } else if (tradesPerSeason > 8) {
    delta = -WEIGHTS.tradeFatigue * 0.2;
    rationale = 'Active trader — slightly less eager for new deals';
  } else if (tradesPerSeason >= 3) {
    delta = WEIGHTS.tradeFatigue * 0.3;
    rationale = 'Healthy trade pace — engaged and receptive';
  } else {
    delta = -WEIGHTS.tradeFatigue * 0.1;
    rationale = 'Low trade activity — may not be checking offers';
  }

  return { label: 'Trade Fatigue', delta: Math.round(delta), rationale };
}

function computeLoyaltyFactor(input: TradeAcceptanceInput): AcceptanceFactor {
  const { opponentTendencies } = input;
  if (!opponentTendencies) {
    return { label: 'Loyalty Factor', delta: 0, rationale: 'No data' };
  }

  const loyalty = opponentTendencies.loyaltyFactor;

  let delta: number;
  let rationale: string;

  if (loyalty > 0.7) {
    delta = -WEIGHTS.loyaltyPenalty * 0.6;
    rationale = 'High roster loyalty — reluctant to move core players';
  } else if (loyalty > 0.5) {
    delta = -WEIGHTS.loyaltyPenalty * 0.2;
    rationale = 'Moderate loyalty — needs compelling reason to trade';
  } else {
    delta = WEIGHTS.loyaltyPenalty * 0.3;
    rationale = 'Low attachment — willing to move players for value';
  }

  return { label: 'Loyalty Factor', delta: Math.round(delta), rationale };
}

function estimateNFLWeek(date: Date): number {
  const year = date.getFullYear();
  const seasonStart = new Date(year, 8, 5);
  if (date < seasonStart) return 0;
  const diffMs = date.getTime() - seasonStart.getTime();
  const week = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.min(Math.max(week, 1), 18);
}

export function computeTradeAcceptance(input: TradeAcceptanceInput): AcceptanceResult {
  const factors: AcceptanceFactor[] = [];

  factors.push(computeFairnessFactor(input));
  factors.push(computeNeedsAlignmentFactor(input));
  factors.push(computeTradeWillingnessFactor(input));
  factors.push(computeAssetAlignmentFactor(input));
  factors.push(computeTimingFactor(input));
  factors.push(computeStandingsPressureFactor(input));
  factors.push(computeTradeFatigueFactor(input));
  factors.push(computeLoyaltyFactor(input));

  const totalDelta = factors.reduce((sum, f) => sum + f.delta, 0);
  const rawScore = BASE_SCORE + totalDelta;
  const score = clamp(Math.round(rawScore));

  const positiveFactors = factors.filter(f => f.delta > 0).sort((a, b) => b.delta - a.delta);
  const negativeFactors = factors.filter(f => f.delta < 0).sort((a, b) => a.delta - b.delta);

  let summary: string;
  if (score >= 75) {
    summary = 'High likelihood of acceptance — strong alignment with opponent preferences';
  } else if (score >= 55) {
    summary = 'Moderate acceptance chance — reasonable offer with some friction points';
  } else if (score >= 35) {
    summary = 'Low acceptance likelihood — consider adjusting the offer';
  } else {
    summary = 'Very unlikely to be accepted — significant misalignment with opponent';
  }

  if (positiveFactors.length > 0) {
    summary += `. Strengths: ${positiveFactors.slice(0, 2).map(f => f.label.toLowerCase()).join(', ')}`;
  }
  if (negativeFactors.length > 0) {
    summary += `. Concerns: ${negativeFactors.slice(0, 2).map(f => f.label.toLowerCase()).join(', ')}`;
  }

  return { score, factors, summary };
}

export interface OptimizationSuggestion {
  type: 'swap_asset' | 'add_sweetener' | 'reframe_pitch' | 'adjust_value';
  description: string;
  expectedImpact: number;
  targetFactor: string;
}

export function suggestOptimizations(
  acceptance: AcceptanceResult,
  input: TradeAcceptanceInput,
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const weakFactors = acceptance.factors
    .filter(f => f.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  for (const factor of weakFactors) {
    if (factor.label === 'Trade Fairness' && factor.delta < -5) {
      suggestions.push({
        type: 'adjust_value',
        description: 'Increase offered value to close the fairness gap',
        expectedImpact: Math.min(Math.abs(factor.delta) * 0.6, 12),
        targetFactor: 'Trade Fairness',
      });
    }

    if (factor.label === 'Roster Needs' && input.opponentTendencies?.positionNeeds) {
      const topNeeds = Object.entries(input.opponentTendencies.positionNeeds)
        .filter(([, v]) => v > 0.15)
        .sort((a, b) => b[1] - a[1]);
      if (topNeeds.length > 0) {
        suggestions.push({
          type: 'swap_asset',
          description: `Include a ${topNeeds[0][0]} player to fill their biggest roster need`,
          expectedImpact: Math.min(Math.abs(factor.delta) * 0.7, 10),
          targetFactor: 'Roster Needs',
        });
      }
    }

    if (factor.label === 'Asset Fit') {
      if (input.opponentTendencies?.pickPreference && input.opponentTendencies.pickPreference > 0.55) {
        suggestions.push({
          type: 'swap_asset',
          description: 'Add draft pick(s) to the offer — this manager values future capital',
          expectedImpact: Math.min(Math.abs(factor.delta) * 0.5, 8),
          targetFactor: 'Asset Fit',
        });
      }
      if (input.opponentTendencies?.starChasing && input.opponentTendencies.starChasing > 0.55) {
        suggestions.push({
          type: 'swap_asset',
          description: 'Include a high-profile player — they gravitate toward star names',
          expectedImpact: Math.min(Math.abs(factor.delta) * 0.5, 8),
          targetFactor: 'Asset Fit',
        });
      }
    }

    if (factor.label === 'Loyalty Factor' && factor.delta < -2) {
      suggestions.push({
        type: 'reframe_pitch',
        description: 'Frame the trade around upgrading their roster, not moving their guys',
        expectedImpact: 3,
        targetFactor: 'Loyalty Factor',
      });
    }

    if (factor.label === 'Standings Pressure' && factor.delta < 0) {
      suggestions.push({
        type: 'reframe_pitch',
        description: 'Emphasize how this trade strengthens their championship chances',
        expectedImpact: 2,
        targetFactor: 'Standings Pressure',
      });
    }
  }

  suggestions.sort((a, b) => b.expectedImpact - a.expectedImpact);
  return suggestions.slice(0, 4);
}
