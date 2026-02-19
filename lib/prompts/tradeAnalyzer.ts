import type { TeamArchetype } from '@/lib/teamClassifier'

export interface CounterSuggestion {
  description: string
  giveAdd: string[]
  getRemove: string[]
  estimatedDelta: string
}

export interface VisualData {
  giveValue: number
  getValue: number
  giveAge: number
  getAge: number
  givePositionalFit: number
  getPositionalFit: number
}

export interface TradeAnalysisResponse {
  fairness: 'strong win' | 'slight win' | 'fair' | 'slight loss' | 'strong loss'
  valueDelta: string
  archetypeFit: 'excellent' | 'good' | 'neutral' | 'poor' | 'terrible'
  verdict: string
  confidence: number
  keyRisks: string[]
  counterSuggestions: CounterSuggestion[]
  visualData: VisualData
}

export function buildTradeAnalysisPrompt(
  give: string,
  get: string,
  leagueSettings: string,
  archetype: TeamArchetype,
  archetypeExplanation: string,
  positionalNeeds: string,
  futurePicks: number,
  rollingInsights: string = ''
): string {
  return `You are AllFantasy's elite dynasty trade advisor.

League: ${leagueSettings}

User Team:
\u2022 Archetype: ${archetype}
\u2022 Explanation: ${archetypeExplanation}
\u2022 Positional Needs: ${positionalNeeds}
\u2022 Future capital: ${futurePicks} relevant 2026+ picks

Recent rolling insights:
${rollingInsights || 'None available'}

Trade:
Give: ${give}
Get: ${get}

Analyze dynasty-style (focus 2026\u20132028 window). Be brutally honest.

Output **strict JSON only**:

{
  "fairness": "strong win" | "slight win" | "fair" | "slight loss" | "strong loss",
  "valueDelta": "+22%" | "-9%" | etc,
  "archetypeFit": "excellent" | "good" | "neutral" | "poor" | "terrible",
  "verdict": "One clear, personalized sentence.",
  "confidence": 92,
  "keyRisks": ["Injury concern", "Bye week conflict"],
  "counterSuggestions": [
    {
      "description": "Add your 2027 2nd to balance value",
      "giveAdd": ["2027 2nd round pick"],
      "getRemove": [],
      "estimatedDelta": "+5%"
    },
    {
      "description": "Swap WR X for WR Y + late pick",
      "giveAdd": ["WR Y"],
      "getRemove": ["WR X"],
      "estimatedDelta": "even"
    }
  ],
  "visualData": {
    "giveValue": 185,
    "getValue": 210,
    "giveAge": 25.8,
    "getAge": 24.2,
    "givePositionalFit": 68,
    "getPositionalFit": 92
  }
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON object.`
}
