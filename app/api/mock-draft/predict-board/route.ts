import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getLiveADP, type ADPEntry } from '@/lib/adp-data'
import { applyRealtimeAdpAdjustments } from '@/lib/mock-draft/adp-realtime-adjuster'
import { buildManagerDNAFromLeague, type ManagerDNA } from '@/lib/mock-draft/manager-dna'

type PickForecast = {
  overall: number
  round: number
  pick: number
  manager: string
  topTargets: Array<{ player: string; position: string; probability: number; why: string }>
}

const POSITION_TARGETS: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2 }

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function snakeOrder(teamCount: number, round: number): number[] {
  const arr = Array.from({ length: teamCount }, (_, i) => i)
  return round % 2 === 1 ? arr : arr.reverse()
}

function scorePlayerForManager(
  player: ADPEntry,
  managerProfile: { tendency: Record<string, number>; rosterCounts: Record<string, number>; panicScore?: number; reachFrequency?: number },
  overall: number,
  recentPositionRun?: string
): number {
  const pos = player.position
  const needBoost = clamp((POSITION_TARGETS[pos] ?? 2) - (managerProfile.rosterCounts[pos] ?? 0), -2, 4)
  const tendencyBoost = managerProfile.tendency[pos] ?? 1
  const adpDelta = clamp((player.adp - overall) / 20, -2, 2)
  const valueBoost = clamp((player.value ?? 2500) / 2500, 0.6, 2)

  const reachMod = (managerProfile.reachFrequency || 0.3) > 0.5 ? adpDelta * 0.15 : 0
  let panicMod = 0
  if (recentPositionRun && recentPositionRun === pos) {
    panicMod = (managerProfile.panicScore || 0.3) * 0.35
  }

  return 1 + needBoost * 0.25 + tendencyBoost * 0.22 + adpDelta * 0.18 + valueBoost * 0.14 + reachMod + panicMod
}

function pickWeighted(candidates: ADPEntry[], weights: number[]): ADPEntry {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const leagueId = String(body?.leagueId || '')
    const rounds = clamp(Number(body?.rounds || 2), 1, 4)
    const simulations = clamp(Number(body?.simulations || 250), 80, 600)

    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      include: {
        teams: {
          include: { performances: { orderBy: { week: 'desc' }, take: 8 } },
          orderBy: { currentRank: 'asc' },
          take: 20,
        },
        rosters: { select: { platformUserId: true, playerData: true }, take: 20 },
      },
    })

    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    const adp = await getLiveADP(league.isDynasty ? 'dynasty' : 'redraft', 220)
    const adjusted = await applyRealtimeAdpAdjustments(adp, { isDynasty: league.isDynasty })
    const pool = adjusted.entries.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position)).slice(0, 180)

    const teamCount = Math.max(league.leagueSize || 0, league.teams.length || 0, 12)

    const dnaCards: ManagerDNA[] = league.teams.length
      ? buildManagerDNAFromLeague(
          league.teams.map(t => ({
            teamName: t.teamName,
            ownerName: t.ownerName,
            wins: t.wins,
            losses: t.losses,
            ties: t.ties,
            pointsFor: t.pointsFor,
            currentRank: t.currentRank,
            performances: t.performances.map(p => ({ week: p.week, points: p.points })),
            platformUserId: (t as any).platformUserId || t.externalId,
          })),
          league.rosters || [],
          pool,
          league.isDynasty,
          teamCount
        )
      : []

    const teamNames = Array.from({ length: teamCount }, (_, i) =>
      dnaCards[i]?.manager || `Manager ${i + 1}`
    )

    const managerProfiles = Array.from({ length: teamCount }, (_, i) => {
      const dna = dnaCards[i]
      return {
        manager: teamNames[i],
        tendency: dna?.tendency || { QB: 1, RB: 1, WR: 1, TE: 1 },
        rosterCounts: { QB: 0, RB: 0, WR: 0, TE: 0 },
        panicScore: dna?.panicScore || 0.3,
        reachFrequency: dna?.reachFrequency || 0.3,
      }
    })

    const pickCount = rounds * teamCount
    const pickOutcomes: Map<number, Map<string, number>> = new Map()

    for (let s = 0; s < simulations; s++) {
      const available = [...pool]
      const counts = managerProfiles.map(m => ({ ...m, rosterCounts: { QB: 0, RB: 0, WR: 0, TE: 0 } }))
      const recentPicks: string[] = []

      let overall = 1
      for (let round = 1; round <= rounds; round++) {
        const order = snakeOrder(teamCount, round)
        for (let pick = 1; pick <= teamCount; pick++) {
          const managerIdx = order[pick - 1]
          const profile = counts[managerIdx]

          const last3 = recentPicks.slice(-3)
          const posRunCounts: Record<string, number> = {}
          for (const p of last3) posRunCounts[p] = (posRunCounts[p] || 0) + 1
          const recentRun = Object.entries(posRunCounts).find(([, c]) => c >= 2)?.[0]

          const candidateSlice = available.slice(0, 40)
          const weights = candidateSlice.map((p) => Math.max(0.05, scorePlayerForManager(p, profile, overall, recentRun)))
          const chosen = pickWeighted(candidateSlice, weights)

          const avIdx = available.findIndex(p => p.name === chosen.name)
          if (avIdx >= 0) available.splice(avIdx, 1)

          if (chosen.position in profile.rosterCounts) {
            const key = chosen.position as keyof typeof profile.rosterCounts
            profile.rosterCounts[key] = (profile.rosterCounts[key] || 0) + 1
          }
          recentPicks.push(chosen.position)

          if (!pickOutcomes.has(overall)) pickOutcomes.set(overall, new Map())
          const map = pickOutcomes.get(overall)!
          map.set(`${chosen.name}|${chosen.position}|${profile.manager}`, (map.get(`${chosen.name}|${chosen.position}|${profile.manager}`) || 0) + 1)

          overall++
        }
      }
    }

    const forecasts: PickForecast[] = []
    let overall = 1
    for (let round = 1; round <= rounds; round++) {
      const order = snakeOrder(teamCount, round)
      for (let pick = 1; pick <= teamCount; pick++) {
        const manager = teamNames[order[pick - 1]] || `Manager ${order[pick - 1] + 1}`
        const results = Array.from((pickOutcomes.get(overall) || new Map()).entries())
          .filter(([k]) => k.endsWith(`|${manager}`))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([key, cnt]) => {
            const [player, position] = key.split('|')
            const probability = Math.round((cnt / simulations) * 100)
            const why = position === 'RB'
              ? 'Historical roster construction and scarcity pressure point toward RB here.'
              : position === 'WR'
                ? 'Manager tendency and ADP board value suggest WR is likely.'
                : position === 'QB'
                  ? 'QB timing window is open based on league and manager style.'
                  : 'TE leverage pick profile appears in this simulation cluster.'

            return { player, position, probability, why }
          })

        forecasts.push({ overall, round, pick, manager, topTargets: results })
        overall++
      }
    }

    const userGuidance = forecasts
      .filter(f => f.pick <= 3)
      .slice(0, 8)
      .map(f => ({
        overall: f.overall,
        manager: f.manager,
        likelyDirection: f.topTargets[0]?.position || 'WR',
        topName: f.topTargets[0]?.player || 'TBD',
      }))

    return NextResponse.json({
      ok: true,
      simulations,
      rounds,
      league: { id: league.id, name: league.name, size: teamCount },
      forecasts,
      userGuidance,
      adpAdjustments: adjusted.adjustments.slice(0, 20),
      signalSources: adjusted.sourcesUsed,
    })
  } catch (err: any) {
    console.error('[mock-draft/predict-board] error', err)
    return NextResponse.json({ error: err?.message || 'Failed to predict draft board' }, { status: 500 })
  }
}
