interface MatchupWeek {
  week: number
  matchups: { roster_id: number; matchup_id: number; points: number }[]
}

interface Manager {
  rosterId: number
  displayName: string
  username: string
  avatar: string | null
  wins: number
  losses: number
  ties: number
  pointsFor: string
}

interface Trade {
  roster_ids?: number[]
  created: number
}

interface HeadToHead {
  rosterId1: number
  rosterId2: number
  wins1: number
  wins2: number
  totalPoints1: number
  totalPoints2: number
  matchups: { week: number; pts1: number; pts2: number; winner: number }[]
}

export interface RivalryEvidence {
  type: 'h2h' | 'trade' | 'record' | 'matchup' | 'streak'
  label: string
  detail: string
}

export interface RivalryPair {
  team1: { rosterId: number; displayName: string; username: string; avatar: string | null; wins: number; losses: number; pointsFor: string }
  team2: { rosterId: number; displayName: string; username: string; avatar: string | null; wins: number; losses: number; pointsFor: string }
  h2hRecord: { wins1: number; wins2: number }
  tradeFriction: number
  recordProximity: number
  matchupImpact: number
  totalScore: number
  lastMatchup: { week: number; pts1: number; pts2: number; winner: number } | null
  recentLoser: number | null
  streakHolder: { rosterId: number; streak: number } | null
  evidence: RivalryEvidence[]
}

export interface RivalryWeekData {
  rivalryOfTheWeek: RivalryPair | null
  revengeGame: RivalryPair | null
  tradeTensionIndex: { pair: RivalryPair; tensionScore: number; tradeCount: number } | null
  topRivalries: RivalryPair[]
}

function buildHeadToHead(matchupWeeks: MatchupWeek[]): HeadToHead[] {
  const pairMap = new Map<string, HeadToHead>()

  for (const { week, matchups } of matchupWeeks) {
    const byMatchupId = new Map<number, { roster_id: number; points: number }[]>()
    for (const m of matchups) {
      if (!byMatchupId.has(m.matchup_id)) byMatchupId.set(m.matchup_id, [])
      byMatchupId.get(m.matchup_id)!.push(m)
    }

    for (const [, pair] of byMatchupId) {
      if (pair.length !== 2) continue
      const [a, b] = pair.sort((x, y) => x.roster_id - y.roster_id)
      const key = `${a.roster_id}-${b.roster_id}`

      if (!pairMap.has(key)) {
        pairMap.set(key, {
          rosterId1: a.roster_id,
          rosterId2: b.roster_id,
          wins1: 0,
          wins2: 0,
          totalPoints1: 0,
          totalPoints2: 0,
          matchups: [],
        })
      }

      const h2h = pairMap.get(key)!
      h2h.totalPoints1 += a.points
      h2h.totalPoints2 += b.points
      const winner = a.points > b.points ? a.roster_id : b.points > a.points ? b.roster_id : 0
      if (winner === a.roster_id) h2h.wins1++
      else if (winner === b.roster_id) h2h.wins2++
      h2h.matchups.push({ week, pts1: a.points, pts2: b.points, winner })
    }
  }

  return Array.from(pairMap.values())
}

function countTradeFriction(trades: Trade[]): Map<string, number> {
  const friction = new Map<string, number>()
  for (const t of trades) {
    const ids = (t.roster_ids || []).sort((a, b) => a - b)
    if (ids.length === 2) {
      const key = `${ids[0]}-${ids[1]}`
      friction.set(key, (friction.get(key) || 0) + 1)
    }
  }
  return friction
}

function computeRecordProximity(m1: Manager, m2: Manager): number {
  const winDiff = Math.abs(m1.wins - m2.wins)
  const lossDiff = Math.abs(m1.losses - m2.losses)
  const ptsDiff = Math.abs(parseFloat(m1.pointsFor || '0') - parseFloat(m2.pointsFor || '0'))
  const maxPts = Math.max(parseFloat(m1.pointsFor || '1'), parseFloat(m2.pointsFor || '1'))
  const ptsProximity = 1 - Math.min(ptsDiff / maxPts, 1)
  const recordProximity = 1 - Math.min((winDiff + lossDiff) / 20, 1)
  return (recordProximity * 0.6 + ptsProximity * 0.4) * 100
}

function computeMatchupImpact(h2h: HeadToHead): number {
  if (h2h.matchups.length === 0) return 0
  let closeGames = 0
  let totalMargin = 0
  for (const m of h2h.matchups) {
    const margin = Math.abs(m.pts1 - m.pts2)
    totalMargin += margin
    if (margin < 15) closeGames++
  }
  const avgMargin = totalMargin / h2h.matchups.length
  const closeGamePct = closeGames / h2h.matchups.length
  const competitiveness = (1 - Math.min(avgMargin / 50, 1)) * 60
  const closeBonus = closeGamePct * 40
  return competitiveness + closeBonus
}

function getStreak(h2h: HeadToHead): { rosterId: number; streak: number } | null {
  const sorted = [...h2h.matchups].sort((a, b) => b.week - a.week)
  if (sorted.length === 0) return null
  const lastWinner = sorted[0].winner
  if (lastWinner === 0) return null
  let streak = 0
  for (const m of sorted) {
    if (m.winner === lastWinner) streak++
    else break
  }
  return streak >= 2 ? { rosterId: lastWinner, streak } : null
}

export function computeRivalryWeek(
  matchupWeeks: MatchupWeek[],
  trades: Trade[],
  managers: Manager[]
): RivalryWeekData {
  const managerMap = new Map<number, Manager>()
  for (const m of managers) managerMap.set(m.rosterId, m)

  const h2hList = buildHeadToHead(matchupWeeks)
  const friction = countTradeFriction(trades)

  const rivalries: RivalryPair[] = []

  for (const h2h of h2hList) {
    const m1 = managerMap.get(h2h.rosterId1)
    const m2 = managerMap.get(h2h.rosterId2)
    if (!m1 || !m2) continue

    const key = `${h2h.rosterId1}-${h2h.rosterId2}`
    const tradeFrictionCount = friction.get(key) || 0
    const recordProx = computeRecordProximity(m1, m2)
    const matchupImpact = computeMatchupImpact(h2h)
    const tradeFrictionScore = Math.min(tradeFrictionCount * 20, 100)

    const totalGames = h2h.matchups.length
    const historyDepth = Math.min(totalGames / 10, 1) * 15

    const totalScore =
      matchupImpact * 0.30 +
      recordProx * 0.25 +
      tradeFrictionScore * 0.25 +
      historyDepth +
      (totalGames >= 3 ? 10 : 0)

    const sortedMatchups = [...h2h.matchups].sort((a, b) => b.week - a.week)
    const lastMatchup = sortedMatchups[0] || null
    const recentLoser = lastMatchup
      ? lastMatchup.winner === h2h.rosterId1 ? h2h.rosterId2
        : lastMatchup.winner === h2h.rosterId2 ? h2h.rosterId1
        : null
      : null

    const evidence: RivalryEvidence[] = []
    evidence.push({
      type: 'h2h',
      label: `H2H: ${h2h.wins1}-${h2h.wins2}`,
      detail: `${m1.displayName} and ${m2.displayName} have played ${totalGames} head-to-head games (${h2h.wins1} wins vs ${h2h.wins2} wins)`,
    })
    if (tradeFrictionCount > 0) {
      evidence.push({
        type: 'trade',
        label: `${tradeFrictionCount} Trade${tradeFrictionCount > 1 ? 's' : ''}`,
        detail: `${tradeFrictionCount} completed trade${tradeFrictionCount > 1 ? 's' : ''} between these managers`,
      })
    }
    const winDiff = Math.abs(m1.wins - m2.wins)
    if (winDiff <= 2) {
      evidence.push({
        type: 'record',
        label: `${winDiff === 0 ? 'Tied' : `${winDiff}W gap`}`,
        detail: `${m1.displayName} (${m1.wins}-${m1.losses}) vs ${m2.displayName} (${m2.wins}-${m2.losses}) — ${winDiff === 0 ? 'identical records' : `separated by ${winDiff} win${winDiff > 1 ? 's' : ''}`}`,
      })
    }
    if (lastMatchup) {
      const margin = Math.abs(lastMatchup.pts1 - lastMatchup.pts2)
      evidence.push({
        type: 'matchup',
        label: `Wk ${lastMatchup.week}: ${margin.toFixed(1)}pt margin`,
        detail: `Last meeting in Week ${lastMatchup.week}: ${lastMatchup.pts1.toFixed(1)} - ${lastMatchup.pts2.toFixed(1)} (${margin < 10 ? 'nailbiter' : margin < 25 ? 'competitive' : 'blowout'})`,
      })
    }
    const streak = getStreak(h2h)
    if (streak && streak.streak >= 2) {
      const streakName = streak.rosterId === m1.rosterId ? m1.displayName : m2.displayName
      evidence.push({
        type: 'streak',
        label: `${streak.streak}-game streak`,
        detail: `${streakName} has won ${streak.streak} consecutive head-to-head meetings`,
      })
    }

    rivalries.push({
      team1: { rosterId: m1.rosterId, displayName: m1.displayName, username: m1.username, avatar: m1.avatar, wins: m1.wins, losses: m1.losses, pointsFor: m1.pointsFor },
      team2: { rosterId: m2.rosterId, displayName: m2.displayName, username: m2.username, avatar: m2.avatar, wins: m2.wins, losses: m2.losses, pointsFor: m2.pointsFor },
      h2hRecord: { wins1: h2h.wins1, wins2: h2h.wins2 },
      tradeFriction: tradeFrictionCount,
      recordProximity: Math.round(recordProx),
      matchupImpact: Math.round(matchupImpact),
      totalScore: Math.round(totalScore),
      lastMatchup,
      recentLoser,
      streakHolder: streak,
      evidence,
    })
  }

  rivalries.sort((a, b) => b.totalScore - a.totalScore)
  const topRivalries = rivalries.slice(0, 3)

  const rivalryOfTheWeek = topRivalries[0] || null

  const revengeGame = rivalries.find(r =>
    r.recentLoser !== null && r.lastMatchup !== null && r.lastMatchup.winner !== 0 && r.streakHolder !== null && r.streakHolder.streak >= 2
  ) || rivalries.find(r => r.recentLoser !== null && r.lastMatchup !== null && r.lastMatchup.winner !== 0) || null

  let tradeTensionIndex: RivalryWeekData['tradeTensionIndex'] = null
  const highFriction = rivalries.filter(r => r.tradeFriction > 0).sort((a, b) => b.tradeFriction - a.tradeFriction)
  if (highFriction.length > 0) {
    const top = highFriction[0]
    const tensionScore = Math.min(Math.round(
      top.tradeFriction * 25 +
      (top.recordProximity > 70 ? 20 : 0) +
      (top.matchupImpact > 60 ? 15 : 0)
    ), 100)
    tradeTensionIndex = { pair: top, tensionScore, tradeCount: top.tradeFriction }
  }

  return { rivalryOfTheWeek, revengeGame, tradeTensionIndex, topRivalries }
}
