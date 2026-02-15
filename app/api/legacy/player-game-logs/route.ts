import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'

interface WeekStats {
  week: number
  opponent?: string
  pts_ppr?: number
  pts_half_ppr?: number
  pts_std?: number
  pass_yd?: number
  pass_td?: number
  pass_int?: number
  pass_att?: number
  pass_cmp?: number
  rush_yd?: number
  rush_td?: number
  rush_att?: number
  rec?: number
  rec_yd?: number
  rec_td?: number
  rec_tgt?: number
  fum_lost?: number
  gp?: number
  gms_active?: number
}

export const POST = withApiUsage({ endpoint: "/api/legacy/player-game-logs", tool: "LegacyPlayerGameLogs" })(async (req: NextRequest) => {
  try {
    const { player_id, season } = await req.json()

    if (!player_id) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const rawSeason = String(season || '2025')
    const currentSeason = /^\d{4}$/.test(rawSeason) ? rawSeason : '2025'

    const res = await fetch(
      `https://api.sleeper.com/stats/nfl/player/${player_id}?season_type=regular&season=${currentSeason}&grouping=week`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch game logs from Sleeper' }, { status: 502 })
    }

    const rawData = await res.json()

    let scheduleMap: Record<string, { opponent: string }> = {}
    try {
      const schedRes = await fetch(
        `https://api.sleeper.com/schedule/nfl/regular/${currentSeason}`,
        { next: { revalidate: 86400 } }
      )
      if (schedRes.ok) {
        const schedData = await schedRes.json()
        if (Array.isArray(schedData)) {
          const { getAllPlayers } = await import('@/lib/sleeper-client')
          const allPlayers = await getAllPlayers()
          const playerInfo = allPlayers[player_id]
          const playerTeam = playerInfo?.team

          if (playerTeam) {
            for (const game of schedData) {
              const week = game.week
              if (game.home === playerTeam) {
                scheduleMap[week] = { opponent: game.away }
              } else if (game.away === playerTeam) {
                scheduleMap[week] = { opponent: `@${game.home}` }
              }
            }
          }
        }
      }
    } catch {}

    const gameLogs: WeekStats[] = []

    if (Array.isArray(rawData)) {
      for (const entry of rawData) {
        if (!entry || typeof entry !== 'object') continue
        const stats = entry.stats || entry
        const week = entry.week || stats.week

        if (!week) continue

        const schedule = scheduleMap[String(week)]

        gameLogs.push({
          week: Number(week),
          opponent: schedule?.opponent || stats.opponent || undefined,
          pts_ppr: stats.pts_ppr ?? stats.fantasy_points_ppr ?? undefined,
          pts_half_ppr: stats.pts_half_ppr ?? undefined,
          pts_std: stats.pts_std ?? undefined,
          gp: stats.gp ?? stats.gms_active ?? undefined,
          pass_att: stats.pass_att ?? undefined,
          pass_cmp: stats.pass_cmp ?? undefined,
          pass_yd: stats.pass_yd ?? undefined,
          pass_td: stats.pass_td ?? undefined,
          pass_int: stats.pass_int ?? undefined,
          rush_att: stats.rush_att ?? undefined,
          rush_yd: stats.rush_yd ?? undefined,
          rush_td: stats.rush_td ?? undefined,
          rec_tgt: stats.rec_tgt ?? undefined,
          rec: stats.rec ?? undefined,
          rec_yd: stats.rec_yd ?? undefined,
          rec_td: stats.rec_td ?? undefined,
          fum_lost: stats.fum_lost ?? undefined,
        })
      }
    } else if (rawData && typeof rawData === 'object') {
      for (const [weekKey, stats] of Object.entries(rawData)) {
        const weekNum = parseInt(weekKey)
        if (isNaN(weekNum)) continue
        const s = stats as Record<string, any>
        const schedule = scheduleMap[weekKey]

        gameLogs.push({
          week: weekNum,
          opponent: schedule?.opponent || undefined,
          pts_ppr: s.pts_ppr ?? s.fantasy_points_ppr ?? undefined,
          pts_half_ppr: s.pts_half_ppr ?? undefined,
          pts_std: s.pts_std ?? undefined,
          gp: s.gp ?? s.gms_active ?? undefined,
          pass_att: s.pass_att ?? undefined,
          pass_cmp: s.pass_cmp ?? undefined,
          pass_yd: s.pass_yd ?? undefined,
          pass_td: s.pass_td ?? undefined,
          pass_int: s.pass_int ?? undefined,
          rush_att: s.rush_att ?? undefined,
          rush_yd: s.rush_yd ?? undefined,
          rush_td: s.rush_td ?? undefined,
          rec_tgt: s.rec_tgt ?? undefined,
          rec: s.rec ?? undefined,
          rec_yd: s.rec_yd ?? undefined,
          rec_td: s.rec_td ?? undefined,
          fum_lost: s.fum_lost ?? undefined,
        })
      }
    }

    gameLogs.sort((a, b) => a.week - b.week)

    return NextResponse.json({
      ok: true,
      season: currentSeason,
      gameLogs,
    })
  } catch (error: any) {
    console.error('Game logs error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch game logs' }, { status: 500 })
  }
})
