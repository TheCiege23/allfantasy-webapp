import { prisma } from "./prisma"
import { scoreBracket, type BracketScoringResult } from "./bracket-scoring"
import { normalizeTeamName as sharedNormalize, isPlaceholderTeam } from "./brackets/normalize"

const NCAAM_LEAGUE_ID = "4607"
const SPORT_KEY = "ncaam"
const SOURCE = "thesportsdb"
const CACHE_TTL_MS = 5 * 60 * 1000

const MARCH_MADNESS_START_MONTH = 2
const MARCH_MADNESS_END_MONTH = 3
const TOURNAMENT_KEYWORDS = [
  "ncaa", "march madness", "tournament", "first four",
  "round of 64", "round of 32", "sweet 16", "elite 8",
  "final four", "championship"
]

type TSDBEvent = {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string | null
  dateEvent: string
  strTime: string | null
  strVenue: string | null
  strSeason: string | null
  intRound: string | null
  strLeague: string | null
  strDescriptionEN: string | null
}

export type BracketSyncResult = {
  eventsFetched: number
  tournamentEvents: number
  eventsUpserted: number
  nodesMatched: number
  nodesSkipped: number
  scoring: BracketScoringResult | null
  errors: string[]
}

function getApiKey(): string {
  return process.env.THESPORTSDB_API_KEY || "3"
}

function formatSeason(year: number): string {
  return `${year - 1}-${year}`
}

function isTournamentEvent(ev: TSDBEvent, season: number): boolean {
  const eventDate = new Date(ev.dateEvent)
  const month = eventDate.getMonth()
  const year = eventDate.getFullYear()

  if (year !== season) return false
  if (month < MARCH_MADNESS_START_MONTH || month > MARCH_MADNESS_END_MONTH) return false

  const eventText = `${ev.strEvent || ""} ${ev.strDescriptionEN || ""}`.toLowerCase()
  for (const kw of TOURNAMENT_KEYWORDS) {
    if (eventText.includes(kw)) return true
  }

  if (month === 2 && eventDate.getDate() >= 14) return true
  if (month === 3) return true

  return false
}

export async function fetchTournamentEvents(season: number): Promise<TSDBEvent[]> {
  const apiKey = getApiKey()
  const seasonStr = formatSeason(season)
  const url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${NCAAM_LEAGUE_ID}&s=${seasonStr}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`TheSportsDB returned ${res.status}: ${await res.text().catch(() => "")}`)
  }

  const data = await res.json()
  const allEvents: TSDBEvent[] = data?.events || []

  return allEvents.filter((ev) => isTournamentEvent(ev, season))
}

function parseEventDate(dateStr: string, timeStr: string | null): Date | null {
  try {
    if (timeStr && timeStr !== "00:00:00") {
      return new Date(`${dateStr}T${timeStr}Z`)
    }
    return new Date(`${dateStr}T00:00:00Z`)
  } catch {
    return null
  }
}

function mapStatus(tsdbStatus: string | null): string {
  if (!tsdbStatus) return "scheduled"
  const s = tsdbStatus.toLowerCase().trim()
  if (s === "match finished" || s === "ft" || s === "aet") return "final"
  if (s === "not started" || s === "ns") return "scheduled"
  if (s.includes("live") || s.includes("progress") || /^\d/.test(s)) return "in_progress"
  if (s === "postponed" || s === "pst") return "postponed"
  if (s === "cancelled" || s === "canc") return "cancelled"
  return s
}

export async function upsertEventsToSportsGame(events: TSDBEvent[]): Promise<number> {
  let count = 0
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS)

  for (const ev of events) {
    const startTime = parseEventDate(ev.dateEvent, ev.strTime)
    const homeScore = ev.intHomeScore != null ? parseInt(ev.intHomeScore, 10) : null
    const awayScore = ev.intAwayScore != null ? parseInt(ev.intAwayScore, 10) : null

    await prisma.sportsGame.upsert({
      where: {
        sport_externalId_source: {
          sport: SPORT_KEY,
          externalId: ev.idEvent,
          source: SOURCE,
        },
      },
      update: {
        homeTeam: ev.strHomeTeam,
        awayTeam: ev.strAwayTeam,
        homeScore: isNaN(homeScore as number) ? null : homeScore,
        awayScore: isNaN(awayScore as number) ? null : awayScore,
        status: mapStatus(ev.strStatus),
        startTime,
        venue: ev.strVenue,
        fetchedAt: now,
        expiresAt,
      },
      create: {
        sport: SPORT_KEY,
        externalId: ev.idEvent,
        source: SOURCE,
        homeTeam: ev.strHomeTeam,
        awayTeam: ev.strAwayTeam,
        homeScore: isNaN(homeScore as number) ? null : homeScore,
        awayScore: isNaN(awayScore as number) ? null : awayScore,
        status: mapStatus(ev.strStatus),
        startTime,
        venue: ev.strVenue,
        fetchedAt: now,
        expiresAt,
      },
    })
    count++
  }

  return count
}

export async function matchEventsToNodes(tournamentId: string): Promise<{ matched: number; skipped: number; errors: string[] }> {
  const nodes = await prisma.bracketNode.findMany({
    where: {
      tournamentId,
      homeTeamName: { not: null },
      awayTeamName: { not: null },
    },
  })

  const tournament = await prisma.bracketTournament.findUnique({ where: { id: tournamentId } })
  if (!tournament) {
    return { matched: 0, skipped: 0, errors: ["Tournament not found"] }
  }

  const games = await prisma.sportsGame.findMany({
    where: {
      sport: SPORT_KEY,
      source: SOURCE,
      season: tournament.season,
    },
  })

  const mapTeamsToGame = new Map<string, typeof games[0]>()
  for (const g of games) {
    const a = sharedNormalize(g.homeTeam)
    const b = sharedNormalize(g.awayTeam)
    if (!mapTeamsToGame.has(`${a}|${b}`)) mapTeamsToGame.set(`${a}|${b}`, g)
    if (!mapTeamsToGame.has(`${b}|${a}`)) mapTeamsToGame.set(`${b}|${a}`, g)
  }

  let matched = 0
  let skipped = 0
  const errors: string[] = []
  const linkTx: any[] = []

  for (const node of nodes) {
    if (node.sportsGameId) {
      skipped++
      continue
    }

    if (isPlaceholderTeam(node.homeTeamName) || isPlaceholderTeam(node.awayTeamName)) {
      skipped++
      continue
    }

    const key = `${sharedNormalize(node.homeTeamName)}|${sharedNormalize(node.awayTeamName)}`
    const match = mapTeamsToGame.get(key)
    if (!match) {
      skipped++
      continue
    }

    linkTx.push(
      prisma.bracketNode.update({
        where: { id: node.id },
        data: { sportsGameId: match.id },
      })
    )
  }

  if (linkTx.length > 0) {
    try {
      await prisma.$transaction(linkTx)
      matched = linkTx.length
    } catch (err: any) {
      errors.push(`Batch link failed: ${err.message}`)
    }
  }

  return { matched, skipped, errors }
}

export async function runBracketSync(season: number): Promise<BracketSyncResult> {
  const errors: string[] = []

  const events = await fetchTournamentEvents(season)

  const upserted = await upsertEventsToSportsGame(events)

  const tournament = await prisma.bracketTournament.findUnique({
    where: { sport_season: { sport: SPORT_KEY, season } },
  })

  if (!tournament) {
    return {
      eventsFetched: events.length,
      tournamentEvents: events.length,
      eventsUpserted: upserted,
      nodesMatched: 0,
      nodesSkipped: 0,
      scoring: null,
      errors: [`No bracket tournament found for ${SPORT_KEY} ${season}. Run bracket init first.`],
    }
  }

  const matchResult = await matchEventsToNodes(tournament.id)
  errors.push(...matchResult.errors)

  const scoringResult = await scoreBracket(tournament.id)
  errors.push(...scoringResult.errors)

  return {
    eventsFetched: events.length,
    tournamentEvents: events.length,
    eventsUpserted: upserted,
    nodesMatched: matchResult.matched,
    nodesSkipped: matchResult.skipped,
    scoring: scoringResult,
    errors,
  }
}
