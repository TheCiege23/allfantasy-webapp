export interface TradeFeedback {
  timestamp: string
  tradeText: string
  suggestionTitle: string
  suggestionText: string
  vote: 'up' | 'down'
  leagueSize: number | null
  isDynasty: boolean | null
  scoring: string | null
  userRoster: string | null
  userContention: string | null
}

let feedbackStore: TradeFeedback[] = []

export function addFeedback(entry: TradeFeedback) {
  feedbackStore.push(entry)
  if (feedbackStore.length > 500) {
    feedbackStore = feedbackStore.slice(-250)
  }
}

export function getRecentFeedback(limit = 50): TradeFeedback[] {
  return feedbackStore.slice(-limit)
}

export function buildFeedbackPromptBlock(): string {
  const recent = feedbackStore.slice(-20)
  if (recent.length === 0) return ''

  const upCount = recent.filter(f => f.vote === 'up').length
  const downCount = recent.filter(f => f.vote === 'down').length

  const lines = recent.map(f => {
    const icon = f.vote === 'up' ? 'GOOD' : 'BAD'
    const context = f.isDynasty ? 'dynasty' : 'redraft'
    return `[${icon}] "${f.suggestionTitle}" (${context}, ${f.scoring || 'ppr'}): ${f.vote === 'up' ? 'User found this helpful/accurate' : 'User said this was overvalued or inaccurate'}`
  })

  return `\n=== USER FEEDBACK HISTORY (learn from this) ===
Recent feedback: ${upCount} helpful, ${downCount} unhelpful out of ${recent.length} ratings.
${downCount > upCount ? 'WARNING: More negative than positive feedback — recalibrate valuations, avoid overvaluing players, be more conservative.' : ''}
${lines.join('\n')}
Use this feedback to calibrate your suggestions. Avoid patterns that received negative feedback. Repeat patterns that received positive feedback.\n`
}
