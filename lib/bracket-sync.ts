import { prisma } from "./prisma"

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

function normalizeTeamName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/^THE\s+/i, "")
    .replace(/\bUNIVERSITY\b|\bUNIV\.?\b|\bCOLLEGE\b|\bOF\b/gi, "")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenSetSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTeamName(a).split(" ").filter(Boolean))
  const tokensB = new Set(normalizeTeamName(b).split(" ").filter(Boolean))

  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }

  const union = new Set([...tokensA, ...tokensB]).size
  return intersection / union
}

const MATCH_THRESHOLD = 0.6

function teamsMatchScore(
  eventHome: string,
  eventAway: string,
  nodeHome: string,
  nodeAway: string
): number {
  const fwdHome = tokenSetSimilarity(eventHome, nodeHome)
  const fwdAway = tokenSetSimilarity(eventAway, nodeAway)
  const fwdScore = Math.min(fwdHome, fwdAway)

  const revHome = tokenSetSimilarity(eventHome, nodeAway)
  const revAway = tokenSetSimilarity(eventAway, nodeHome)
  const revScore = Math.min(revHome, revAway)

  return Math.max(fwdScore, revScore)
}

function daysDiff(a: Date | null, b: Date | null): number {
  if (!a || !b) return Infinity
  return Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000)
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

  const marchStart = new Date(tournament.season, 2, 1)
  const aprilEnd = new Date(tournament.season, 3, 15)

  const games = await prisma.sportsGame.findMany({
    where: {
      sport: SPORT_KEY,
      source: SOURCE,
      startTime: { gte: marchStart, lte: aprilEnd },
    },
  })

  const linkedGameIds = new Set<string>()
  let matched = 0
  let skipped = 0
  const errors: string[] = []

  for (const node of nodes) {
    if (node.sportsGameId) {
      linkedGameIds.add(node.sportsGameId)
      skipped++
      continue
    }

    let bestMatch: typeof games[0] | null = null
    let bestScore = 0

    for (const game of games) {
      if (linkedGameIds.has(game.id)) continue

      const score = teamsMatchScore(
        game.homeTeam,
        game.awayTeam,
        node.homeTeamName!,
        node.awayTeamName!
      )

      if (score < MATCH_THRESHOLD) continue

      const dateDist = daysDiff(game.startTime, null)

      if (score > bestScore || (score === bestScore && bestMatch && dateDist < daysDiff(bestMatch.startTime, null))) {
        bestMatch = game
        bestScore = score
      }
    }

    if (bestMatch) {
      try {
        await prisma.bracketNode.update({
          where: { id: node.id },
          data: { sportsGameId: bestMatch.id },
        })
        linkedGameIds.add(bestMatch.id)
        matched++
      } catch (err: any) {
        errors.push(`Failed to link node ${node.slot}: ${err.message}`)
      }
    } else {
      skipped++
    }
  }

  return { matched, skipped, errors }
}

export async function runBracketSync(season: number): Promise<BracketSyncResult> {
  const errors: string[] = []

  const events = await fetchTournamentEvents(season)

  const upserted = await upsertEventsToSportsGame(events)

  const tournament = await prisma.bracketTournament.findFirst({
    where: { sport: SPORT_KEY, season },
  })

  if (!tournament) {
    return {
      eventsFetched: events.length,
      tournamentEvents: events.length,
      eventsUpserted: upserted,
      nodesMatched: 0,
      nodesSkipped: 0,
      errors: [`No bracket tournament found for ${SPORT_KEY} ${season}. Run bracket init first.`],
    }
  }

  const matchResult = await matchEventsToNodes(tournament.id)
  errors.push(...matchResult.errors)

  return {
    eventsFetched: events.length,
    tournamentEvents: events.length,
    eventsUpserted: upserted,
    nodesMatched: matchResult.matched,
    nodesSkipped: matchResult.skipped,
    errors,
  }
}
