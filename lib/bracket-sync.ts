import { prisma } from "@/lib/prisma"

type TheSportsDbEvent = {
  idEvent: string
  idLeague?: string | null
  strLeague?: string | null
  strSport?: string | null
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
  const s = raw.trim().toUpperCase()

  if (s === "FT" || s === "AOT") return "final"
  if (s === "NS" || s === "POST" || s === "CANC") return "scheduled"

  const lower = raw.trim().toLowerCase()
  if (lower === "final" || lower === "completed" || lower.includes("final"))
    return "final"
  if (lower.includes("in progress") || lower.includes("live"))
    return "in_progress"

  return "unknown"
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
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


function* eachDayIso(start: Date, end: Date) {
  const d = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  )
  const endUtc = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  )
  while (d <= endUtc) {
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
    const dd = String(d.getUTCDate()).padStart(2, "0")
    yield `${yyyy}-${mm}-${dd}`
    d.setUTCDate(d.getUTCDate() + 1)
  }
}

export async function fetchTournamentEvents(
  season: number
): Promise<TheSportsDbEvent[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY
  const leagueId = process.env.THESPORTSDB_NCAAM_LEAGUE_ID || NCAAM_LEAGUE_ID

  const effectiveKey =
    apiKey ?? (process.env.NODE_ENV === "development" ? "3" : null)
  if (!effectiveKey) {
    throw new Error("Missing THESPORTSDB_API_KEY (required in production)")
  }

  const start = new Date(Date.UTC(season, 2, 1))
  const end = new Date(Date.UTC(season, 3, 20))

  const byId = new Map<string, TheSportsDbEvent>()
  let days = 0
  let okDays = 0
  let failedDays = 0

  for (const day of eachDayIso(start, end)) {
    days++
    const url = `https://www.thesportsdb.com/api/v1/json/${effectiveKey}/eventsday.php?d=${day}`

    try {
      const res = await fetch(url, { cache: "no-store" })
      if (!res.ok) {
        failedDays++
        console.warn(`[TheSportsDB] ${day} HTTP ${res.status}`)
        continue
      }

      okDays++
      const json = await res.json()
      const events: TheSportsDbEvent[] = Array.isArray(json?.events)
        ? json.events
        : []

      for (const ev of events) {
        if (!ev?.idEvent) continue
        if (String(ev.idLeague ?? "") !== String(leagueId)) continue
        if (!byId.has(ev.idEvent)) byId.set(ev.idEvent, ev)
      }
    } catch (e: any) {
      failedDays++
      console.warn(`[TheSportsDB] ${day} fetch error: ${e?.message ?? e}`)
      continue
    }

    await sleep(120)
  }

  const results = Array.from(byId.values())
  console.log(
    `[TheSportsDB] fetchTournamentEvents season=${season} days=${days} okDays=${okDays} failedDays=${failedDays} events=${results.length}`
  )

  return results
}

export async function upsertEventsToSportsGame(
  events: TheSportsDbEvent[],
  season?: number
): Promise<{ upserted: number }> {
  const now = new Date()

  const makeExpiresAt = (status: string) => {
    const s = status as "in_progress" | "scheduled" | "final" | "unknown"
    let minutes = 60

    if (s === "in_progress") minutes = 2
    else if (s === "scheduled") minutes = 6 * 60
    else if (s === "final") minutes = 14 * 24 * 60

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

        const base = {
          homeTeam: ev.strHomeTeam ?? "",
          awayTeam: ev.strAwayTeam ?? "",
          homeScore: safeHome,
          awayScore: safeAway,
          status,
          venue: ev.strVenue ?? null,
          fetchedAt: now,
          expiresAt: makeExpiresAt(status),
          ...(season != null ? { season } : {}),
        }

        return prisma.sportsGame.upsert({
          where: {
            sport_externalId_source: {
              sport: SPORT,
              externalId: String(ev.idEvent),
              source: SOURCE,
            },
          },
          update: {
            ...base,
            ...(startTime ? { startTime } : {}),
          },
          create: {
            sport: SPORT,
            externalId: String(ev.idEvent),
            source: SOURCE,
            ...base,
            ...(startTime ? { startTime } : {}),
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

export async function matchEventsToGames(
  tournamentId: string
): Promise<{ updated: number }> {
  const tournament = await prisma.bracketTournament.findUnique({
    where: { id: tournamentId },
    select: { season: true },
  })
  if (!tournament) return { updated: 0 }

  const games = await (prisma as any).marchMadnessGame.findMany({
    where: {
      tournamentId,
      winnerId: null,
      team1: { not: null },
      team2: { not: null },
    },
    select: {
      id: true,
      team1: true,
      team2: true,
    },
  })

  const { start, end } = marchMadnessWindow(tournament.season)
  const sportsGames = await prisma.sportsGame.findMany({
    where: {
      sport: SPORT,
      source: SOURCE,
      status: "final",
      startTime: { gte: start, lte: end },
    },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      homeScore: true,
      awayScore: true,
      startTime: true,
    },
    orderBy: { startTime: "asc" },
    take: 2500,
  })

  const pairToGame = new Map<string, typeof sportsGames[0]>()
  for (const sg of sportsGames) {
    const a = normalizeTeamName(sg.homeTeam)
    const b = normalizeTeamName(sg.awayTeam)
    if (!a || !b) continue
    const key1 = `${a}|${b}`
    const key2 = `${b}|${a}`
    if (!pairToGame.has(key1)) pairToGame.set(key1, sg)
    if (!pairToGame.has(key2)) pairToGame.set(key2, sg)
  }

  let updated = 0

  for (const g of games) {
    if (isPlaceholderTeam(g.team1) || isPlaceholderTeam(g.team2)) continue
    const key = `${normalizeTeamName(g.team1)}|${normalizeTeamName(g.team2)}`
    const match = pairToGame.get(key)
    if (!match) continue

    const winner = winnerFromScores(
      match.homeTeam,
      match.awayTeam,
      match.homeScore,
      match.awayScore
    )
    if (!winner) continue

    const normalizedWinner = normalizeTeamName(winner)
    let winnerId: string
    if (normalizeTeamName(g.team1) === normalizedWinner) {
      winnerId = g.team1
    } else if (normalizeTeamName(g.team2) === normalizedWinner) {
      winnerId = g.team2
    } else {
      continue
    }

    await (prisma as any).marchMadnessGame.update({
      where: { id: g.id },
      data: { winnerId },
    })
    updated++
  }

  return { updated }
}

export async function scoreAndAdvanceFinals(
  tournamentId: string
): Promise<{ finalized: number; seeded: number }> {
  const games = await (prisma as any).marchMadnessGame.findMany({
    where: { tournamentId, winnerId: { not: null } },
    select: {
      id: true,
      round: true,
      team1: true,
      team2: true,
      winnerId: true,
    },
  })

  let finalized = 0
  let seeded = 0

  for (const game of games) {
    if (!game.team1 || !game.team2 || !game.winnerId) continue

    const winner = game.winnerId
    const pts = pointsForRound(game.round)

    await (prisma as any).marchMadnessPick.updateMany({
      where: { gameId: game.id, winnerTeam: winner },
      data: { isCorrect: true, points: pts },
    })

    await (prisma as any).marchMadnessPick.updateMany({
      where: {
        gameId: game.id,
        winnerTeam: { not: null },
        NOT: { winnerTeam: winner },
      },
      data: { isCorrect: false, points: 0 },
    })

    finalized++
  }

  return { finalized, seeded }
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
  const { upserted } = await upsertEventsToSportsGame(events, season)
  const { updated } = await matchEventsToGames(tournament.id)
  const { finalized, seeded } = await scoreAndAdvanceFinals(
    tournament.id
  )

  return {
    ok: true as const,
    season,
    tournamentId: tournament.id,
    fetched: events.length,
    upserted,
    updated,
    finalized,
    seeded,
  }
}
