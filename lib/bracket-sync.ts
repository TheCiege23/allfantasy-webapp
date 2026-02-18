import { prisma } from "@/lib/prisma"

type TheSportsDbEvent = {
  idEvent: string
  strEvent?: string | null
  strHomeTeam?: string | null
  strAwayTeam?: string | null
  intHomeScore?: string | null
  intAwayScore?: string | null
  strStatus?: string | null
  dateEvent?: string | null
  strTime?: string | null
  strVenue?: string | null
}

const SPORT = "ncaam"
const SOURCE = "thesportsdb"
const NCAAM_LEAGUE_ID = "4607"

function normalizeTeamName(name?: string | null): string {
  if (!name) return ""
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

function isPlaceholderTeam(name?: string | null): boolean {
  if (!name) return true
  const n = name.toLowerCase().trim()
  return n.startsWith("winner of") || n === "tbd" || n === "tba"
}

function normalizeStatus(
  raw?: string | null
): "scheduled" | "in_progress" | "final" | "unknown" {
  if (!raw) return "unknown"
  const s = raw.toLowerCase().trim()
  if (
    s === "ft" ||
    s === "aot" ||
    s === "aet" ||
    s.includes("final") ||
    s === "match finished"
  )
    return "final"
  if (
    s.includes("in progress") ||
    s.includes("live") ||
    s.includes("playing") ||
    /^\d/.test(s)
  )
    return "in_progress"
  if (
    s === "ns" ||
    s === "post" ||
    s === "canc" ||
    s.includes("not started") ||
    s.includes("scheduled") ||
    s.includes("postponed") ||
    s.includes("cancelled") ||
    s.includes("time")
  )
    return "scheduled"
  return "unknown"
}

function parseStartTime(
  dateEvent?: string | null,
  strTime?: string | null
): Date | null {
  if (!dateEvent) return null
  const time =
    strTime && strTime.trim() && strTime.trim() !== "00:00:00"
      ? strTime.trim()
      : "00:00:00"
  const iso = `${dateEvent}T${time}Z`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function pointsForRound(round: number): number {
  switch (round) {
    case 0:
      return 0
    case 1:
      return 1
    case 2:
      return 2
    case 3:
      return 4
    case 4:
      return 8
    case 5:
      return 16
    case 6:
      return 32
    default:
      return 0
  }
}

function winnerFromScores(
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null
): string | null {
  if (homeScore == null || awayScore == null) return null
  if (homeScore === awayScore) return null
  return homeScore > awayScore ? homeTeam : awayTeam
}

function marchMadnessWindow(season: number) {
  const start = new Date(Date.UTC(season, 2, 1))
  const end = new Date(Date.UTC(season, 3, 15))
  return { start, end }
}


export async function fetchTournamentEvents(
  season: number
): Promise<TheSportsDbEvent[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY || "3"
  const leagueId = process.env.THESPORTSDB_NCAAM_LEAGUE_ID || NCAAM_LEAGUE_ID

  const seasonStr = `${season - 1}-${season}`
  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${leagueId}&s=${seasonStr}`

  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok)
    throw new Error(`TheSportsDB fetch failed: ${res.status}`)

  const json = await res.json()
  const events: TheSportsDbEvent[] = Array.isArray(json?.events)
    ? json.events
    : []
  if (!events.length) return []

  const { start, end } = marchMadnessWindow(season)

  return events.filter((ev) => {
    const dt = parseStartTime(ev.dateEvent ?? null, ev.strTime ?? null)
    if (!dt) return false
    if (dt < start || dt > end) return false
    return true
  })
}

export async function upsertEventsToSportsGame(
  events: TheSportsDbEvent[]
): Promise<{ upserted: number }> {
  const now = new Date()

  const makeExpiresAt = (status: string) => {
    const minutes = status === "in_progress" ? 2 : 60
    return new Date(now.getTime() + minutes * 60 * 1000)
  }

  const chunkSize = 100
  let upserted = 0

  for (let i = 0; i < events.length; i += chunkSize) {
    const batch = events.slice(i, i + chunkSize)

    const tx = batch
      .filter((ev) => ev.idEvent && ev.strHomeTeam && ev.strAwayTeam)
      .map((ev) => {
        const status = normalizeStatus(ev.strStatus ?? null)
        const startTime = parseStartTime(
          ev.dateEvent ?? null,
          ev.strTime ?? null
        )
        const homeScore =
          ev.intHomeScore != null ? Number(ev.intHomeScore) : null
        const awayScore =
          ev.intAwayScore != null ? Number(ev.intAwayScore) : null

        const safeHome = Number.isFinite(homeScore as number)
          ? homeScore
          : null
        const safeAway = Number.isFinite(awayScore as number)
          ? awayScore
          : null

        return prisma.sportsGame.upsert({
          where: {
            sport_externalId_source: {
              sport: SPORT,
              externalId: String(ev.idEvent),
              source: SOURCE,
            },
          },
          update: {
            homeTeam: ev.strHomeTeam ?? "",
            awayTeam: ev.strAwayTeam ?? "",
            homeScore: safeHome,
            awayScore: safeAway,
            status,
            startTime: startTime ?? undefined,
            venue: ev.strVenue ?? null,
            fetchedAt: now,
            expiresAt: makeExpiresAt(status),
          },
          create: {
            sport: SPORT,
            externalId: String(ev.idEvent),
            source: SOURCE,
            homeTeam: ev.strHomeTeam ?? "",
            awayTeam: ev.strAwayTeam ?? "",
            homeScore: safeHome,
            awayScore: safeAway,
            status,
            startTime: startTime ?? undefined,
            venue: ev.strVenue ?? null,
            fetchedAt: now,
            expiresAt: makeExpiresAt(status),
          },
        })
      })

    if (tx.length) {
      const res = await prisma.$transaction(tx)
      upserted += res.length
    }
  }

  return { upserted }
}

export async function matchEventsToNodes(
  tournamentId: string
): Promise<{ linked: number }> {
  const tournament = await prisma.bracketTournament.findUnique({
    where: { id: tournamentId },
    select: { season: true },
  })
  if (!tournament) return { linked: 0 }

  const nodes = await prisma.bracketNode.findMany({
    where: {
      tournamentId,
      sportsGameId: null,
      homeTeamName: { not: null },
      awayTeamName: { not: null },
    },
    select: {
      id: true,
      homeTeamName: true,
      awayTeamName: true,
    },
  })

  const { start, end } = marchMadnessWindow(tournament.season)
  const games = await prisma.sportsGame.findMany({
    where: {
      sport: SPORT,
      source: SOURCE,
      startTime: { gte: start, lte: end },
    },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      startTime: true,
    },
    orderBy: { startTime: "asc" },
    take: 2500,
  })

  const pairToGameId = new Map<string, string>()
  for (const g of games) {
    const a = normalizeTeamName(g.homeTeam)
    const b = normalizeTeamName(g.awayTeam)
    if (!a || !b) continue
    const key1 = `${a}|${b}`
    const key2 = `${b}|${a}`
    if (!pairToGameId.has(key1)) pairToGameId.set(key1, g.id)
    if (!pairToGameId.has(key2)) pairToGameId.set(key2, g.id)
  }

  const updates: ReturnType<typeof prisma.bracketNode.update>[] = []

  for (const n of nodes) {
    if (isPlaceholderTeam(n.homeTeamName) || isPlaceholderTeam(n.awayTeamName))
      continue
    const key = `${normalizeTeamName(n.homeTeamName)}|${normalizeTeamName(n.awayTeamName)}`
    const gameId = pairToGameId.get(key)
    if (!gameId) continue

    updates.push(
      prisma.bracketNode.update({
        where: { id: n.id },
        data: { sportsGameId: gameId },
      })
    )
  }

  if (!updates.length) return { linked: 0 }
  await prisma.$transaction(updates)
  return { linked: updates.length }
}

export async function scoreAndAdvanceFinals(
  tournamentId: string
): Promise<{ finalized: number; advanced: number; seeded: number }> {
  const nodes = await prisma.bracketNode.findMany({
    where: { tournamentId, sportsGameId: { not: null } },
    select: {
      id: true,
      round: true,
      homeTeamName: true,
      awayTeamName: true,
      sportsGameId: true,
      nextNodeId: true,
      nextNodeSide: true,
    },
  })

  const gameIds = nodes
    .map((n) => n.sportsGameId!)
    .filter(Boolean)
  const games = await prisma.sportsGame.findMany({
    where: { id: { in: gameIds } },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
      status: true,
    },
  })
  const gameById = new Map(games.map((g) => [g.id, g]))

  let finalized = 0
  let advanced = 0
  let seeded = 0

  for (const node of nodes) {
    const g = gameById.get(node.sportsGameId!)
    if (!g) continue

    if (!node.homeTeamName && g.homeTeam) {
      await prisma.bracketNode.update({
        where: { id: node.id },
        data: { homeTeamName: g.homeTeam },
      })
      node.homeTeamName = g.homeTeam
      seeded++
    }
    if (!node.awayTeamName && g.awayTeam) {
      await prisma.bracketNode.update({
        where: { id: node.id },
        data: { awayTeamName: g.awayTeam },
      })
      node.awayTeamName = g.awayTeam
      seeded++
    }

    if (normalizeStatus(g.status) !== "final") continue

    const rawWinner = winnerFromScores(
      g.homeTeam,
      g.awayTeam,
      g.homeScore,
      g.awayScore
    )
    if (!rawWinner) continue
    if (!node.homeTeamName || !node.awayTeamName) continue

    const normalizedWinner = normalizeTeamName(rawWinner)
    let winner: string
    if (normalizeTeamName(node.homeTeamName) === normalizedWinner) {
      winner = node.homeTeamName
    } else if (normalizeTeamName(node.awayTeamName) === normalizedWinner) {
      winner = node.awayTeamName
    } else {
      continue
    }

    const pts = pointsForRound(node.round)

    await prisma.bracketPick.updateMany({
      where: { nodeId: node.id, pickedTeamName: winner },
      data: { isCorrect: true, points: pts },
    })

    await prisma.bracketPick.updateMany({
      where: {
        nodeId: node.id,
        pickedTeamName: { not: null },
        NOT: { pickedTeamName: winner },
      },
      data: { isCorrect: false, points: 0 },
    })

    finalized++

    if (node.nextNodeId && node.nextNodeSide) {
      const next = await prisma.bracketNode.findUnique({
        where: { id: node.nextNodeId },
        select: { id: true, homeTeamName: true, awayTeamName: true },
      })
      if (!next) continue

      const current =
        node.nextNodeSide === "HOME"
          ? next.homeTeamName
          : next.awayTeamName

      if (isPlaceholderTeam(current) || !current) {
        await prisma.bracketNode.update({
          where: { id: next.id },
          data:
            node.nextNodeSide === "HOME"
              ? { homeTeamName: winner }
              : { awayTeamName: winner },
        })
        advanced++
      }
    }
  }

  return { finalized, advanced, seeded }
}

export async function runBracketSync(season: number) {
  const tournament = await prisma.bracketTournament.findUnique({
    where: { sport_season: { sport: SPORT, season } },
    select: { id: true },
  })
  if (!tournament) {
    return {
      ok: false as const,
      error: `BracketTournament not found for sport=${SPORT} season=${season}. Seed it first.`,
    }
  }

  const events = await fetchTournamentEvents(season)
  const { upserted } = await upsertEventsToSportsGame(events)
  const { linked } = await matchEventsToNodes(tournament.id)
  const { finalized, advanced, seeded } = await scoreAndAdvanceFinals(
    tournament.id
  )

  return {
    ok: true as const,
    season,
    tournamentId: tournament.id,
    fetched: events.length,
    upserted,
    linked,
    finalized,
    advanced,
    seeded,
  }
}
