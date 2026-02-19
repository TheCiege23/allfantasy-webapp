import type { TeamArchetype } from '@/lib/teamClassifier'

export interface TradeAnalysisResponse {
  fairness: 'strong win' | 'slight win' | 'fair' | 'slight loss' | 'strong loss'
  valueDelta: string
  archetypeFit: 'excellent' | 'good' | 'neutral' | 'poor' | 'terrible'
  verdict: string
  counterSuggestions: string[]
  confidence: number
}

export function buildTradeAnalysisPrompt(
  give: string,
  get: string,
  leagueSettings: string,
  archetype: TeamArchetype,
  archetypeExplanation: string,
  positionalNeeds: string,
  userFuturePicks: number
): string {
  return `You are an elite dynasty fantasy football GM and trade advisor for AllFantasy.

League format: ${leagueSettings}

User's team archetype: ${archetype}
Explanation: ${archetypeExplanation}

Positional situation: ${positionalNeeds}
Future draft capital: ${userFuturePicks} firsts/seconds owned (2026+)

Proposed trade:
Give: ${give}
Get: ${get}

Analyze with brutal honesty and dynasty-specific reasoning (2026-2028 window focus):

1. Raw value delta (use current KTC-style market values)
2. Fit for this exact archetype and positional needs
3. Short-term (2026) vs long-term (2027-2028) impact
4. Risk factors (age, injury, situation)
5. Personalized verdict (one clear sentence)

Output format (strict JSON):
{
  "fairness": "strong win" | "slight win" | "fair" | "slight loss" | "strong loss",
  "valueDelta": "+18%" | "-12%" | etc,
  "archetypeFit": "excellent" | "good" | "neutral" | "poor" | "terrible",
  "verdict": "Push this trade hard — it perfectly fills your RB hole while keeping your contender window open.",
  "counterSuggestions": ["Add your 2027 2nd to make it fair", "Counter with Player X instead of Y"],
  "confidence": 85
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON object.`
}
