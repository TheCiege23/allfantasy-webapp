import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreAndAdvanceFinals } from "@/lib/bracket-sync"

export const runtime = "nodejs"

function requireDevSecret(req: Request) {
  const secret = process.env.BRACKET_DEV_SECRET
  if (!secret) return true
  const provided = req.headers.get("x-dev-secret") ?? ""
  return provided === secret
}

function seededScore(gameId: string, side: "home" | "away"): number {
  let hash = 0
  const key = `${gameId}-${side}`
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return 60 + Math.abs(hash % 30)
}

function seededWinner(gameId: string): boolean {
  let hash = 0
  for (let i = 0; i < gameId.length; i++) {
    hash = ((hash << 5) - hash + gameId.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 2) === 0
}

function pointsForRound(round: number): number {
  switch (round) {
    case 1: return 1
    case 2: return 2
    case 3: return 4
    case 4: return 8
    case 5: return 16
    case 6: return 32
    default: return 0
  }
}

interface RoundResult {
  round: number
  roundName: string
  gamesSimulated: number
  results: string[]
  scoring: { finalized: number; seeded: number }
}

const ROUND_NAMES: Record<number, string> = {
  0: "First Four",
  1: "Round of 64",
  2: "Round of 32",
  3: "Sweet 16",
  4: "Elite 8",
  5: "Final Four",
  6: "Championship",
}

async function simulateRound(
  tournamentId: string,
  round: number,
  season: number
): Promise<RoundResult | null> {
  const games = await (prisma as any).marchMadnessGame.findMany({
    where: {
      tournamentId,
      round,
      team1: { not: null },
      team2: { not: null },
    },
    orderBy: { gameNumber: "asc" },
  })

  if (games.length === 0) return null

  const results: string[] = []

  for (const g of games) {
    if (!g.team1 || !g.team2) continue

    const team1Wins = seededWinner(g.id)
    const winScore = seededScore(g.id, "home")
    const loseScore = Math.max(40, winScore - 5 - (seededScore(g.id, "away") % 15))
    const team1Score = team1Wins ? winScore : loseScore
    const team2Score = team1Wins ? loseScore : winScore

    const winner = team1Wins ? g.team1 : g.team2

    await (prisma as any).marchMadnessGame.update({
      where: { id: g.id },
      data: { winnerId: winner },
    })

    results.push(`${g.team1} ${team1Score}-${team2Score} ${g.team2} → ${winner}`)
  }

  const scoring = await scoreAndAdvanceFinals(tournamentId)

  return {
    round,
    roundName: ROUND_NAMES[round] ?? `Round ${round}`,
    gamesSimulated: results.length,
    results,
    scoring,
  }
}

async function runDbAssertions(tournamentId: string, isFullMode: boolean) {
  const assertions: { name: string; pass: boolean; detail: string }[] = []

  const picksScored = await (prisma as any).marchMadnessPick.findMany({
    where: {
      game: { tournamentId },
      isCorrect: { not: null },
    },
    select: { points: true, isCorrect: true, gameId: true, bracketId: true },
  })

  const correctPicks = picksScored.filter((p: any) => p.isCorrect === true)
  const incorrectPicks = picksScored.filter((p: any) => p.isCorrect === false)

  assertions.push({
    name: "Correct picks have positive points",
    pass: correctPicks.length === 0 || correctPicks.every((p: any) => p.points > 0),
    detail: `${correctPicks.length} correct picks checked`,
  })

  assertions.push({
    name: "Incorrect picks have 0 points",
    pass: incorrectPicks.every((p: any) => p.points === 0),
    detail: `${incorrectPicks.length} incorrect picks checked`,
  })

  const gameRounds = await (prisma as any).marchMadnessGame.findMany({
    where: { tournamentId },
    select: { id: true, round: true },
  })
  const roundByGame = new Map(gameRounds.map((g: any) => [g.id, g.round]))
  const pointsMismatch = correctPicks.filter((p: any) => {
    const round = roundByGame.get(p.gameId)
    return round !== undefined && p.points !== pointsForRound(round as number)
  })
  assertions.push({
    name: "Points match pointsForRound for correct picks",
    pass: pointsMismatch.length === 0,
    detail: pointsMismatch.length > 0
      ? `${pointsMismatch.length} mismatches found`
      : `All ${correctPicks.length} correct picks match expected round points`,
  })

  const entries = await (prisma as any).bracketEntry.findMany({
    where: { league: { tournamentId } },
    select: {
      id: true,
      name: true,
      picks: { select: { points: true } },
    },
  })

  const leaderboard = entries.map((e: any) => ({
    entry: e.name,
    entryId: e.id,
    totalPoints: e.picks.reduce((s: number, p: any) => s + p.points, 0),
    picksCount: e.picks.length,
  })).sort((a: any, b: any) => b.totalPoints - a.totalPoints)

  if (leaderboard.length > 0) {
    const picksByEntry = new Map<string, number>()
    for (const p of picksScored) {
      picksByEntry.set(p.bracketId, (picksByEntry.get(p.bracketId) ?? 0) + p.points)
    }
    const mismatches = leaderboard.filter((e: any) => {
      const dbSum = picksByEntry.get(e.entryId) ?? 0
      return e.totalPoints !== dbSum
    })
    assertions.push({
      name: "Leaderboard totals match sum of individual pick points",
      pass: mismatches.length === 0,
      detail: mismatches.length > 0
        ? `${mismatches.length} entries have mismatched totals`
        : `${leaderboard.length} entries verified — totals match`,
    })
  } else {
    assertions.push({
      name: "Leaderboard totals match sum of individual pick points",
      pass: true,
      detail: "No entries exist yet (create entries and make picks to verify)",
    })
  }

  const championGame = await (prisma as any).marchMadnessGame.findFirst({
    where: { tournamentId, round: 6 },
  })

  let champion: string | null = null
  if (championGame?.winnerId) {
    champion = championGame.winnerId
  }

  if (isFullMode) {
    assertions.push({
      name: "Champion crowned after full tournament simulation",
      pass: champion !== null,
      detail: champion
        ? `Champion: ${champion}`
        : "No champion determined — championship game may not have both teams or a winner",
    })
  }

  const gamesWithTeams = await (prisma as any).marchMadnessGame.findMany({
    where: {
      tournamentId,
      round: { gte: 2 },
      OR: [
        { team1: { not: null } },
        { team2: { not: null } },
      ],
    },
    select: { round: true, team1: true, team2: true },
  })

  const teamsByRound: Record<string, number> = {}
  for (const g of gamesWithTeams) {
    const key = ROUND_NAMES[g.round] ?? `Round ${g.round}`
    const filled = (g.team1 ? 1 : 0) + (g.team2 ? 1 : 0)
    teamsByRound[key] = (teamsByRound[key] ?? 0) + filled
  }

  assertions.push({
    name: "Games in later rounds have teams assigned",
    pass: Object.keys(teamsByRound).length > 0,
    detail: JSON.stringify(teamsByRound),
  })

  const idempotencyBefore = await (prisma as any).marchMadnessPick.aggregate({
    where: { game: { tournamentId }, isCorrect: { not: null } },
    _sum: { points: true },
    _count: true,
  })

  await scoreAndAdvanceFinals(tournamentId)

  const idempotencyAfter = await (prisma as any).marchMadnessPick.aggregate({
    where: { game: { tournamentId }, isCorrect: { not: null } },
    _sum: { points: true },
    _count: true,
  })

  assertions.push({
    name: "Scoring is idempotent (re-run produces identical totals)",
    pass:
      idempotencyBefore._sum.points === idempotencyAfter._sum.points &&
      idempotencyBefore._count === idempotencyAfter._count,
    detail: `Before: ${idempotencyBefore._sum.points ?? 0} pts / ${idempotencyBefore._count} scored → After: ${idempotencyAfter._sum.points ?? 0} pts / ${idempotencyAfter._count} scored`,
  })

  return { assertions, leaderboard, champion }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 })
  }
  if (!requireDevSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const season = body.season ?? new Date().getUTCFullYear()
  const mode = body.mode ?? "single"
  const roundToSimulate = body.round ?? 1

  const tournament = await (prisma as any).bracketTournament.findUnique({
    where: { sport_season: { sport: "ncaam", season } },
    select: { id: true, name: true },
  })

  if (!tournament) {
    return NextResponse.json(
      { error: "Tournament not found. Seed it first via admin init." },
      { status: 404 }
    )
  }

  if (mode === "full") {
    const roundResults: RoundResult[] = []
    const skippedRounds: number[] = []

    for (let r = 1; r <= 6; r++) {
      const result = await simulateRound(tournament.id, r, season)
      if (result) {
        roundResults.push(result)
      } else {
        skippedRounds.push(r)
      }
    }

    const dbCheck = await runDbAssertions(tournament.id, true)
    const allPass = dbCheck.assertions.every((a) => a.pass)

    return NextResponse.json({
      ok: true,
      mode: "full",
      tournament: tournament.name,
      rounds: roundResults,
      skippedRounds: skippedRounds.length > 0
        ? skippedRounds.map((r) => `${ROUND_NAMES[r] ?? `Round ${r}`} — no games with both teams`)
        : [],
      totalGamesSimulated: roundResults.reduce((s, r) => s + r.gamesSimulated, 0),
      champion: dbCheck.champion,
      leaderboard: dbCheck.leaderboard,
      dbAssertions: dbCheck.assertions,
      allAssertionsPass: allPass,
      verdict: allPass
        ? "ALL CHECKS PASSED — bracket system is working correctly."
        : "SOME CHECKS FAILED — review dbAssertions for details.",
    })
  }

  const result = await simulateRound(tournament.id, roundToSimulate, season)

  if (!result) {
    return NextResponse.json(
      { error: `No games with teams assigned for round ${roundToSimulate}. Make sure bracket is seeded.` },
      { status: 404 }
    )
  }

  const dbCheck = await runDbAssertions(tournament.id, false)

  return NextResponse.json({
    ok: true,
    mode: "single",
    tournament: tournament.name,
    ...result,
    leaderboard: dbCheck.leaderboard,
    dbAssertions: dbCheck.assertions,
    allAssertionsPass: dbCheck.assertions.every((a) => a.pass),
    nextStep: "Refresh your bracket page to see updated scores, picks scored, and winners.",
  })
}
