export type ConfidenceLevel = 'high' | 'learning' | 'evolving';

export interface InsightMetadata {
  insight_id: string;
  insight_type: 'trade_analysis' | 'roster_summary' | 'dynasty_projection' | 'waiver_analysis' | 'player_finder' | 'league_ranking' | 'manager_compare' | 'ai_coach';
  confidence_level: ConfidenceLevel;
  confidence_score: number;
  league_id?: string;
  sport?: string;
  scoring_type?: string;
  data_coverage?: 'dense' | 'moderate' | 'sparse';
}

export function generateInsightId(): string {
  return crypto.randomUUID();
}

export function calculateConfidence(params: {
  hasHistoricalData?: boolean;
  dataPointCount?: number;
  isCommonScenario?: boolean;
  playerCoverage?: number;
  leagueAge?: number;
}): { level: ConfidenceLevel; score: number } {
  const { 
    hasHistoricalData = false, 
    dataPointCount = 0, 
    isCommonScenario = true,
    playerCoverage = 1,
    leagueAge = 1
  } = params;

  let score = 0.5;

  if (hasHistoricalData) score += 0.15;
  if (dataPointCount > 100) score += 0.1;
  else if (dataPointCount > 50) score += 0.05;
  if (isCommonScenario) score += 0.1;
  if (playerCoverage > 0.9) score += 0.1;
  else if (playerCoverage < 0.5) score -= 0.15;
  if (leagueAge > 3) score += 0.05;

  score = Math.max(0, Math.min(1, score));

  let level: ConfidenceLevel;
  if (score >= 0.75) {
    level = 'high';
  } else if (score >= 0.5) {
    level = 'learning';
  } else {
    level = 'evolving';
  }

  return { level, score };
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence';
    case 'learning':
      return 'Learning';
    case 'evolving':
      return 'Evolving insight';
  }
}

export function getConfidenceTooltip(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'The AI has seen many similar league scenarios and player profiles.';
    case 'learning':
      return 'This scenario is less common. The AI is still learning from similar league situations.';
    case 'evolving':
      return "The AI's confidence will improve as more league data is analyzed.";
  }
}

export function getConfidenceColor(level: ConfidenceLevel): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (level) {
    case 'high':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        dot: '🟢',
      };
    case 'learning':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        dot: '🟡',
      };
    case 'evolving':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
        dot: '🔵',
      };
  }
}

export function shouldShowConfidenceLabel(
  level: ConfidenceLevel,
  isHighStakes: boolean,
  shownInSession: Set<ConfidenceLevel>
): boolean {
  if (level !== 'high') return true;
  if (isHighStakes) return true;
  if (!shownInSession.has(level)) return true;
  return false;
}
