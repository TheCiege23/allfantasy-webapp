import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import {
  computeWinProbability,
  computePickDistribution,
  computeSleeperScore,
  computeLeverage,
} from "@/lib/brackets/intelligence/data-engine"
import {
  recommendPick,
  DEFAULT_RISK_PROFILE,
  type RiskProfile,
} from "@/lib/brackets/intelligence/strategy-engine"
import { narrateMatchup } from "@/lib/brackets/intelligence/ai-narrator"

export const runtime = "nodejs"

function buildAnalysis(
  teamA: string,
  teamB: string,
  seedA: number | null,
  seedB: number | null,
  round: number
): { analysis: string; claims: Array<{ claim: string; source: string | null }>; confidence: number } {
  const claims: Array<{ claim: string; source: string | null }> = []
  let analysis = ""

  if (seedA != null && seedB != null) {
    const favored = seedA < seedB ? teamA : teamB
    const underdog = seedA < seedB ? teamB : teamA
    const fSeed = Math.min(seedA, seedB)
    const uSeed = Math.max(seedA, seedB)
    const gap = uSeed - fSeed

    claims.push({
      claim: `${favored} is the #${fSeed} seed; ${underdog} is the #${uSeed} seed.`,
      source: null,
    })

    if (gap >= 8) {
      analysis = `${favored} (${fSeed}) is a heavy favorite over ${underdog} (${uSeed}). Historically, matchups with this seed differential result in the higher seed winning over 90% of the time in the NCAA Tournament.`
      claims.push({
        claim: `Seeds 1-4 win against seeds 13-16 approximately 93% of the time historically.`,
        source: "https://www.ncaa.com/news/basketball-men/bracketiq/history-bracket-upsets",
      })
    } else if (gap >= 4) {
      analysis = `${favored} (${fSeed}) is favored but ${underdog} (${uSeed}) has upset potential. This is a classic upset-watch matchup in March Madness. The 5-12 seed matchup in particular sees upsets roughly 35% of the time.`
      claims.push({
        claim: `The 5-vs-12 seed matchup historically produces upsets ~35% of the time.`,
        source: "https://www.ncaa.com/news/basketball-men/bracketiq/history-bracket-upsets",
      })
    } else {
      analysis = `This is a competitive matchup between ${teamA} (${seedA}) and ${teamB} (${seedB}). Close seed matchups in the NCAA Tournament are often decided by a few possessions.`
      claims.push({
        claim: `Matchups with 1-3 seed difference are decided by 5 or fewer points approximately 40% of the time.`,
        source: "https://www.sports-reference.com/cbb/",
      })
    }

    if (round >= 4) {
      analysis += ` In the ${round >= 5 ? "Final Four" : "Elite Eight"}, experience and depth become crucial factors.`
      claims.push({
        claim: `Teams in the ${round >= 5 ? "Final Four" : "Elite Eight"} with prior tournament experience win at a higher rate.`,
        source: "https://www.ncaa.com/march-madness-schedule",
      })
    }
  } else {
    analysis = `Matchup between ${teamA} and ${teamB}. Seed data is unavailable for complete analysis. Check team records and recent form for more context.`
  }

  const confidence = seedA != null && seedB != null
    ? Math.max(45, Math.min(80, 55 + Math.abs((seedA ?? 0) - (seedB ?? 0)) * 2))
    : 40

  return { analysis, claims, confidence }
}

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({} as any))
  const { teamA, teamB, round, seedA, seedB, nodeId, tournamentId, withNarrative } = body

  if (!teamA || !teamB) {
    return NextResponse.json({ error: "Missing teamA or teamB" }, { status: 400 })
  }

  const winProb = computeWinProbability(seedA ?? null, seedB ?? null)
  const { analysis, claims, confidence } = buildAnalysis(
    teamA, teamB, seedA ?? null, seedB ?? null, round ?? 1
  )

  let pickDistribution: { publicPctA: number; publicPctB: number } | null = null
  let leverage = null
  let sleeper = null
  let strategy = null
  let aiNarrative: string | undefined

  if (tournamentId && nodeId) {
    const distributions = await computePickDistribution(tournamentId, [nodeId])
    const dist = distributions.get(nodeId)

    if (dist) {
      const totalPicks = dist.total
      const pctA = totalPicks > 0 ? (dist.picks[teamA] ?? 0) / totalPicks : 0.5
      const pctB = totalPicks > 0 ? (dist.picks[teamB] ?? 0) / totalPicks : 0.5

      pickDistribution = { publicPctA: Math.round(pctA * 100) / 100, publicPctB: Math.round(pctB * 100) / 100 }

      leverage = computeLeverage(
        nodeId, teamA, teamB,
        { ...dist, publicPctA: pctA, publicPctB: pctB },
        round ?? 1
      )

      const sleeperA = computeSleeperScore(teamA, seedA ?? null, seedB ?? null, pctA)
      const sleeperB = computeSleeperScore(teamB, seedB ?? null, seedA ?? null, pctB)
      sleeper = sleeperA.score > sleeperB.score ? sleeperA : sleeperB.score > 0 ? sleeperB : null

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

      strategy = recommendPick(
        teamA, teamB,
        seedA ?? null, seedB ?? null,
        pctA, pctB,
        profile, round ?? 1
      )

      if (withNarrative) {
        aiNarrative = await narrateMatchup({
          teamA, teamB,
          winProbA: winProb.teamA,
          winProbB: winProb.teamB,
          publicPickPctA: pctA,
          publicPickPctB: pctB,
          seedA: seedA ?? null,
          seedB: seedB ?? null,
          round: round ?? 1,
          leverageScore: leverage.score,
        })
      }
    }
  }

  const sources = claims
    .filter((c) => c.source)
    .map((c) => ({ title: c.claim.slice(0, 60) + "...", url: c.source! }))

  return NextResponse.json({
    ok: true,
    nodeId,
    teamA,
    teamB,
    round: round ?? 1,
    winProbability: {
      home: Math.round(winProb.teamA * 100),
      away: Math.round(winProb.teamB * 100),
    },
    pickDistribution,
    leverage,
    sleeper,
    strategy,
    analysis,
    aiNarrative,
    claims,
    confidence,
    sources,
    lastUpdated: new Date().toISOString(),
    dataDisclaimer: "Analysis based on historical seed performance data and pool pick distribution.",
  })
}
