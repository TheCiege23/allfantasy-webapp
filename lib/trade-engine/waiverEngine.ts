export type TeamDirection = 'CONTEND' | 'REBUILD' | 'MIDDLE' | 'FRAGILE_CONTEND';

export type WaiverRecommendation = 'Strong Add' | 'Add' | 'Monitor' | 'Skip';

export interface WaiverCandidate {
  name: string;
  position: string;
  value: number;
  age?: number;
  isInjured?: boolean;
  injurySeverity?: number;
}

export interface RosterPlayer {
  name: string;
  position: string;
  value: number;
  isCornerstone?: boolean;
  isStarter?: boolean;
}

export interface WaiverContext {
  teamDirection: TeamDirection;
  rosterNeeds: string[];
  rosterSurplus: string[];
  leagueScarcity?: Record<string, number>;
  isSuperFlex?: boolean;
  isTEP?: boolean;
  currentWeek?: number;
  totalWeeks?: number;
  faabBudget?: number;
  leagueFaabBudget?: number;
}

export interface WaiverResult {
  candidate: WaiverCandidate;
  drop?: RosterPlayer;
  priorityScore: number;
  recommendation: WaiverRecommendation;
  breakdown: {
    needScore: number;
    replacementDelta: number;
    timingFactor: number;
    scarcityBonus: number;
    injuryBonus: number;
  };
  reason: string;
}

const CORNERSTONE_THRESHOLD = 4000;

const RECOMMENDATION_THRESHOLDS = {
  strongAdd: 50,
  add: 30,
  monitor: 15,
};

function getSeasonUrgencyMultiplier(week: number, totalWeeks: number): number {
  const progress = week / totalWeeks;
  if (progress >= 0.85) return 1.3;
  if (progress >= 0.65) return 1.1;
  return 1.0;
}

function computeNeedScore(
  position: string,
  context: WaiverContext
): number {
  const pos = position.toUpperCase();
  const needsUpper = context.rosterNeeds.map(p => p.toUpperCase());
  const surplusUpper = context.rosterSurplus.map(p => p.toUpperCase());
  const isNeed    = needsUpper.includes(pos);
  const isSurplus = surplusUpper.includes(pos);

  let base = isNeed ? 30 : isSurplus ? -10 : 10;

  const scarcity = context.leagueScarcity?.[pos] ?? context.leagueScarcity?.[position] ?? 50;
  if (scarcity >= 70 && isSurplus) {
    base = Math.max(base, 5);
  }

  if (pos === 'TE' && context.isTEP) {
    base += 10;
  }

  if (pos === 'QB' && context.isSuperFlex) {
    base += 8;
  }

  return base;
}

function computeReplacementDelta(
  candidate: WaiverCandidate,
  roster: RosterPlayer[]
): number {
  const samePosition = roster.filter(
    p => p.position.toUpperCase() === candidate.position.toUpperCase()
  );
  const starters = samePosition.filter(p => p.isStarter);

  if (samePosition.length === 0) {
    return candidate.value * 0.65;
  }

  if (starters.length === 0) {
    return candidate.value * 0.45;
  }

  const worstStarterValue = Math.min(...starters.map(p => p.value));
  return Math.max(0, (candidate.value - worstStarterValue) * 0.4);
}

function computeTimingFactor(
  candidate: WaiverCandidate,
  context: WaiverContext
): { score: number; injuryBonus: number } {
  const { teamDirection } = context;
  const age = candidate.age ?? 25;
  const value = candidate.value;
  const isHighValue = value >= 3000;
  const isYoung = age <= 24;
  const isOld = age >= 28;

  let injuryBonus = 0;
  if (candidate.isInjured) {
    injuryBonus = -5;
  } else if ((candidate.injurySeverity ?? 0) > 70) {
    injuryBonus = +15;
  }

  let score: number;

  switch (teamDirection) {
    case 'CONTEND':
      score = isHighValue ? 15 : isYoung ? 5 : 10;
      break;

    case 'FRAGILE_CONTEND':
      score = isHighValue ? 20 : isOld ? 8 : isYoung ? 5 : 12;
      break;

    case 'REBUILD':
      score = isYoung ? 20 : isOld ? -5 : 5;
      break;

    case 'MIDDLE':
    default:
      score = 10;
      break;
  }

  return { score, injuryBonus };
}

function computeScarcityBonus(
  position: string,
  context: WaiverContext
): number {
  const scarcity = context.leagueScarcity?.[position] ?? 50;
  if (scarcity >= 80) return 10;
  if (scarcity >= 65) return 5;
  return 0;
}

function getRecommendation(
  score: number,
  context: WaiverContext
): WaiverRecommendation {
  const week = context.currentWeek ?? 1;
  const total = context.totalWeeks ?? 17;
  const urgency = getSeasonUrgencyMultiplier(week, total);

  const thresholds = {
    strongAdd: RECOMMENDATION_THRESHOLDS.strongAdd / urgency,
    add:       RECOMMENDATION_THRESHOLDS.add / urgency,
    monitor:   RECOMMENDATION_THRESHOLDS.monitor / urgency,
  };

  if (score >= thresholds.strongAdd) return 'Strong Add';
  if (score >= thresholds.add)       return 'Add';
  if (score >= thresholds.monitor)   return 'Monitor';
  return 'Skip';
}

function buildReason(
  candidate: WaiverCandidate,
  breakdown: WaiverResult['breakdown'],
  recommendation: WaiverRecommendation,
  context: WaiverContext
): string {
  const parts: string[] = [];

  if (breakdown.needScore >= 25) {
    parts.push(`${candidate.position} is a roster need`);
  } else if (breakdown.needScore <= -5) {
    parts.push(`${candidate.position} is a surplus position`);
  }

  if (breakdown.replacementDelta > 500) {
    parts.push(`significant upgrade over current ${candidate.position} options`);
  } else if (breakdown.replacementDelta > 200) {
    parts.push(`moderate upgrade at ${candidate.position}`);
  }

  if (context.teamDirection === 'REBUILD' && (candidate.age ?? 99) <= 24) {
    parts.push('fits rebuild timeline as young asset');
  }

  if (context.teamDirection === 'FRAGILE_CONTEND' && candidate.value >= 3000) {
    parts.push('high-impact add for contention window');
  }

  if (breakdown.injuryBonus > 0) {
    parts.push('injury context increases urgency');
  }

  if (breakdown.scarcityBonus > 0) {
    parts.push(`${candidate.position} is scarce in your league`);
  }

  return parts.length > 0
    ? `${recommendation}: ${parts.join(', ')}.`
    : `${recommendation} based on overall scoring.`;
}

export function scoreWaiverPriorities(
  candidates: WaiverCandidate[],
  roster: RosterPlayer[],
  context: WaiverContext
): WaiverResult[] {
  const results: WaiverResult[] = [];

  for (const candidate of candidates) {
    const needScore        = computeNeedScore(candidate.position, context);
    const replacementDelta = computeReplacementDelta(candidate, roster);
    const { score: timingFactor, injuryBonus } = computeTimingFactor(candidate, context);
    const scarcityBonus    = computeScarcityBonus(candidate.position, context);

    const priorityScore = needScore + replacementDelta + timingFactor + injuryBonus + scarcityBonus;

    const breakdown = {
      needScore,
      replacementDelta,
      timingFactor,
      scarcityBonus,
      injuryBonus,
    };

    const recommendation = getRecommendation(priorityScore, context);

    results.push({
      candidate,
      priorityScore: Math.round(priorityScore),
      recommendation,
      breakdown,
      reason: buildReason(candidate, breakdown, recommendation, context),
    });
  }

  return results.sort((a, b) => b.priorityScore - a.priorityScore);
}

function meetsUpgradeThreshold(
  candidateValue: number,
  dropValue: number
): boolean {
  const delta = candidateValue - dropValue;
  if (delta <= 0) return false;

  const relativePct = delta / Math.max(dropValue, 1);
  return delta >= 250 || relativePct >= 0.08;
}

function computeUpgradeBonus(delta: number): number {
  if (delta <= 0) return 0;
  return Math.min(25, Math.round(Math.log2(delta / 100 + 1) * 6));
}

function selectTopCandidates(
  available: WaiverCandidate[],
  rosterNeeds: string[],
  totalLimit = 60
): WaiverCandidate[] {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const perPositionLimit = Math.floor(totalLimit / positions.length);
  const selected: WaiverCandidate[] = [];

  for (const pos of positions) {
    const posPlayers = available
      .filter(p => p.position.toUpperCase() === pos.toUpperCase())
      .sort((a, b) => b.value - a.value)
      .slice(0, perPositionLimit);
    selected.push(...posPlayers);
  }

  const selectedNames = new Set(selected.map(p => p.name));
  const remaining = available
    .filter(p => !selectedNames.has(p.name))
    .sort((a, b) => b.value - a.value)
    .slice(0, totalLimit - selected.length);

  return [...selected, ...remaining];
}

export function runWaiverEngine(
  available: WaiverCandidate[],
  roster: RosterPlayer[],
  context: WaiverContext
): WaiverResult[] {
  const droppable = roster
    .filter(p => !p.isCornerstone && p.value < CORNERSTONE_THRESHOLD)
    .sort((a, b) => a.value - b.value);

  if (droppable.length === 0) {
    console.warn('[waiverEngine] No droppable players found on roster');
    return [];
  }

  const topCandidates = selectTopCandidates(available, context.rosterNeeds);

  const suggestions: WaiverResult[] = [];

  for (const candidate of topCandidates) {
    const dropTarget = droppable.find(
      p => p.position.toUpperCase() === candidate.position.toUpperCase()
    ) ?? droppable[0];

    if (!meetsUpgradeThreshold(candidate.value, dropTarget.value)) continue;

    const delta = candidate.value - dropTarget.value;
    const candidatePosUpper = candidate.position.toUpperCase();
    const isNeed = context.rosterNeeds.map(p => p.toUpperCase()).includes(candidatePosUpper);
    const isYoung = (candidate.age ?? 99) <= 24;
    const isContender =
      context.teamDirection === 'CONTEND' ||
      context.teamDirection === 'FRAGILE_CONTEND';
    const isRebuild = context.teamDirection === 'REBUILD';

    let score = 0;

    score += Math.min(40, Math.round((delta / 5000) * 40));

    if (isNeed) score += 25;

    if (isContender && candidate.value >= 3000) score += 10;
    if (isRebuild && isYoung)                   score += 10;

    score += computeUpgradeBonus(delta);

    const scarcityBonus = computeScarcityBonus(candidate.position, context);
    score += scarcityBonus;

    const injuryBonus = (candidate.injurySeverity ?? 0) > 70 ? 12 : 0;
    score += injuryBonus;

    const recommendation = getRecommendation(score, context);
    const breakdown = {
      needScore: isNeed ? 25 : 0,
      replacementDelta: delta,
      timingFactor: isContender ? 10 : isRebuild ? (isYoung ? 10 : 0) : 0,
      scarcityBonus,
      injuryBonus,
    };

    suggestions.push({
      candidate,
      drop: dropTarget,
      priorityScore: Math.round(score),
      recommendation,
      breakdown,
      reason: buildReason(candidate, breakdown, recommendation, context),
    });
  }

  return suggestions
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 15);
}
