import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { DEFAULT_RISK_PROFILE, generateMultiBracketPlan, shouldUpset, type RiskProfile } from "@/lib/brackets/intelligence/strategy-engine"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const tournamentId = String(body.tournamentId || "")
  const leagueId = String(body.leagueId || "")
  const count = Math.min(10, Math.max(1, Number(body.count) || 3))

  if (!tournamentId || !leagueId) {
    return NextResponse.json({ error: "Missing tournamentId or leagueId" }, { status: 400 })
  }

  const member = await prisma.bracketLeagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: auth.userId } },
  })
  if (!member) {
    return NextResponse.json({ error: "Not a league member" }, { status: 403 })
  }

  const savedProfile = await prisma.bracketRiskProfile.findUnique({
    where: { userId: auth.userId },
  })
  const profile: RiskProfile = savedProfile
    ? {
        riskTolerance: savedProfile.riskTolerance as RiskProfile["riskTolerance"],
        poolCount: savedProfile.poolCount,
        poolSizeEstimate: savedProfile.poolSizeEstimate,
        goal: savedProfile.goal as RiskProfile["goal"],
      }
    : DEFAULT_RISK_PROFILE

  const plan = generateMultiBracketPlan(profile, count)

  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId },
    orderBy: [{ round: "asc" }, { slot: "asc" }],
  })

  const seedMap = new Map<string, number>()
  for (const n of nodes) {
    if (n.round === 1) {
      if (n.homeTeamName && n.seedHome != null) seedMap.set(n.homeTeamName, n.seedHome)
      if (n.awayTeamName && n.seedAway != null) seedMap.set(n.awayTeamName, n.seedAway)
    }
  }

  const generatedBrackets = plan.brackets.map((bracketPlan) => {
    const picks: Array<{ nodeId: string; pickedTeamName: string; round: number }> = []

    const effective = new Map<string, { home: string | null; away: string | null }>()
    for (const n of nodes) {
      effective.set(n.id, { home: n.homeTeamName, away: n.awayTeamName })
    }

    const sorted = [...nodes].sort((a, b) => a.round - b.round)

    for (const n of sorted) {
      const eff = effective.get(n.id)
      if (!eff) continue

      const home = eff.home
      const away = eff.away
      if (!home && !away) continue

      let pick: string | null = null

      if (home && !away) {
        pick = home
      } else if (!home && away) {
        pick = away
      } else if (home && away) {
        const homeSeed = seedMap.get(home) ?? 99
        const awaySeed = seedMap.get(away) ?? 99

        if (homeSeed === awaySeed) {
          pick = Math.random() > 0.5 ? home : away
        } else {
          const favorite = homeSeed <= awaySeed ? home : away
          const underdog = homeSeed <= awaySeed ? away : home
          const favSeed = Math.min(homeSeed, awaySeed)
          const undSeed = Math.max(homeSeed, awaySeed)

          if (shouldUpset(favSeed, undSeed, bracketPlan.upsetFrequency, n.round)) {
            pick = underdog
          } else {
            pick = favorite
          }
        }
      }

      if (pick) {
        picks.push({ nodeId: n.id, pickedTeamName: pick, round: n.round })

        if (n.nextNodeId && n.nextNodeSide) {
          const cur = effective.get(n.nextNodeId)
          if (cur) {
            if (n.nextNodeSide === "home") {
              effective.set(n.nextNodeId, { ...cur, home: pick })
            } else {
              effective.set(n.nextNodeId, { ...cur, away: pick })
            }
          }
        }
      }
    }

    const upsetCount = picks.filter(p => {
      const pickedSeed = seedMap.get(p.pickedTeamName) ?? 0
      return pickedSeed > 8
    }).length

    return {
      style: bracketPlan.style,
      label: bracketPlan.label,
      description: bracketPlan.description,
      picks,
      stats: {
        totalPicks: picks.length,
        upsetPicks: upsetCount,
        upsetRate: picks.length > 0 ? Math.round((upsetCount / picks.length) * 100) : 0,
      },
    }
  })

  return NextResponse.json({
    ok: true,
    profile,
    plan: { count: plan.count, styles: plan.brackets.map(b => b.style) },
    brackets: generatedBrackets,
  })
}
