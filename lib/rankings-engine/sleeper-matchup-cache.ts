import { prisma } from '@/lib/prisma'
import { getLeagueMatchups } from '@/lib/sleeper-client'

const CURRENT_SEASON = 2025

interface CachedWeekStat {
  week: number
  rosterId: number
  pointsFor: number
  pointsAgainst: number
  win: number
  matchupId: number | null
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000

export async function ensureMatchupsCached(
  leagueId: string,
  maxWeek: number,
  seasonYear: number = CURRENT_SEASON,
): Promise<void> {
  const existing = await prisma.weeklyMatchup.findMany({
    where: { leagueId, seasonYear },
    select: { week: true, updatedAt: true },
    distinct: ['week'],
  })

  const cachedWeeks = new Map<number, Date>()
  for (const r of existing) {
    const prev = cachedWeeks.get(r.week)
    if (!prev || r.updatedAt > prev) cachedWeeks.set(r.week, r.updatedAt)
  }

  const now = Date.now()
  const missingWeeks: number[] = []
  for (let w = 1; w <= maxWeek; w++) {
    const cachedAt = cachedWeeks.get(w)
    if (!cachedAt) {
      missingWeeks.push(w)
    } else if (w === maxWeek && now - cachedAt.getTime() > STALE_THRESHOLD_MS) {
      await prisma.weeklyMatchup.deleteMany({ where: { leagueId, seasonYear, week: w } })
      missingWeeks.push(w)
    }
  }

  if (missingWeeks.length === 0) return

  const fetchPromises = missingWeeks.map(w =>
    getLeagueMatchups(leagueId, w).then(matchups => ({ week: w, matchups })),
  )
  const results = await Promise.all(fetchPromises)

  for (const { week, matchups } of results) {
    const matchupMap = new Map<number, typeof matchups>()
    for (const m of matchups) {
      if (!m.matchup_id) continue
      const group = matchupMap.get(m.matchup_id) || []
      group.push(m)
      matchupMap.set(m.matchup_id, group)
    }

    const rows = matchups.map(m => {
      let oppPoints = 0
      if (m.matchup_id) {
        const group = matchupMap.get(m.matchup_id) || []
        const opp = group.find(x => x.roster_id !== m.roster_id)
        oppPoints = opp?.points || 0
      }
      const pts = m.points || 0
      return {
        leagueId,
        seasonYear,
        week,
        rosterId: m.roster_id,
        matchupId: m.matchup_id || null,
        pointsFor: pts,
        pointsAgainst: oppPoints,
        win: pts > oppPoints ? 1 : 0,
      }
    })

    if (rows.length > 0) {
      await prisma.weeklyMatchup.createMany({
        data: rows,
        skipDuplicates: true,
      })
    }
  }
}

export async function getWeekStatsFromCache(
  leagueId: string,
  maxWeek: number,
  seasonYear: number = CURRENT_SEASON,
): Promise<{
  weekStats: CachedWeekStat[]
  weeklyPointsByRoster: Map<number, number[]>
  weeklyOpponentPointsByRoster: Map<number, number[]>
}> {
  await ensureMatchupsCached(leagueId, maxWeek, seasonYear)

  const rows = await prisma.weeklyMatchup.findMany({
    where: { leagueId, seasonYear, week: { lte: maxWeek } },
    orderBy: [{ week: 'asc' }, { rosterId: 'asc' }],
  })

  const weekStats: CachedWeekStat[] = []
  const weeklyPointsByRoster = new Map<number, number[]>()
  const weeklyOpponentPointsByRoster = new Map<number, number[]>()

  for (const r of rows) {
    weekStats.push({
      week: r.week,
      rosterId: r.rosterId,
      pointsFor: r.pointsFor,
      pointsAgainst: r.pointsAgainst,
      win: r.win,
      matchupId: r.matchupId,
    })

    const pts = weeklyPointsByRoster.get(r.rosterId) || []
    while (pts.length < r.week - 1) pts.push(0)
    pts.push(r.pointsFor)
    weeklyPointsByRoster.set(r.rosterId, pts)

    const opp = weeklyOpponentPointsByRoster.get(r.rosterId) || []
    while (opp.length < r.week - 1) opp.push(0)
    opp.push(r.matchupId !== null ? r.pointsAgainst : 0)
    weeklyOpponentPointsByRoster.set(r.rosterId, opp)
  }

  return { weekStats, weeklyPointsByRoster, weeklyOpponentPointsByRoster }
}

export async function refreshWeekCache(
  leagueId: string,
  week: number,
  seasonYear: number = CURRENT_SEASON,
): Promise<void> {
  await prisma.weeklyMatchup.deleteMany({
    where: { leagueId, seasonYear, week },
  })
  await ensureMatchupsCached(leagueId, week, seasonYear)
}
