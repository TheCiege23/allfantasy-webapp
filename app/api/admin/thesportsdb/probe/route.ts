import { NextResponse } from "next/server"
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function marchWindow(season: number) {
  const start = new Date(Date.UTC(season, 2, 1))
  const end = new Date(Date.UTC(season, 3, 15))
  return { start, end }
}

function parseStartTime(
  dateEvent?: string | null,
  strTime?: string | null
): Date | null {
  if (!dateEvent) return null
  const time = strTime?.trim() ? strTime.trim() : "00:00:00"
  const iso = `${dateEvent}T${time}Z`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: Request) {
  if (!isAuthorizedRequest(req)) return adminUnauthorized()

  const url = new URL(req.url)
  const season = Number(
    url.searchParams.get("season") || new Date().getUTCFullYear()
  )

  const apiKey = process.env.THESPORTSDB_API_KEY || "3"
  const leagueId = process.env.THESPORTSDB_NCAAM_LEAGUE_ID || "4607"

  const seasonStr = `${season - 1}-${season}`
  const fetchUrl = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsseason.php?id=${leagueId}&s=${seasonStr}`

  const res = await fetch(fetchUrl, { cache: "no-store" })
  if (!res.ok) {
    return NextResponse.json(
      { error: "TheSportsDB fetch failed", status: res.status, fetchUrl },
      { status: 502 }
    )
  }

  const json = await res.json()
  const events: any[] = Array.isArray(json?.events) ? json.events : []

  const statusCounts: Record<string, number> = {}
  const samples: Record<string, any[]> = {}

  for (const ev of events) {
    const st = (ev?.strStatus ?? "NULL").toString()
    statusCounts[st] = (statusCounts[st] ?? 0) + 1

    if (!samples[st]) samples[st] = []
    if (samples[st].length < 3) {
      samples[st].push({
        idEvent: ev?.idEvent,
        strEvent: ev?.strEvent,
        dateEvent: ev?.dateEvent,
        strTime: ev?.strTime,
        home: ev?.strHomeTeam,
        away: ev?.strAwayTeam,
        homeScore: ev?.intHomeScore,
        awayScore: ev?.intAwayScore,
      })
    }
  }

  const { start, end } = marchWindow(season)
  const marchEvents = events.filter((ev) => {
    const dt = parseStartTime(ev?.dateEvent ?? null, ev?.strTime ?? null)
    return dt && dt >= start && dt <= end
  })

  const marchStatusCounts: Record<string, number> = {}
  for (const ev of marchEvents) {
    const st = (ev?.strStatus ?? "NULL").toString()
    marchStatusCounts[st] = (marchStatusCounts[st] ?? 0) + 1
  }

  const dateRange =
    events.length > 0
      ? {
          earliest: events
            .map((e: any) => e.dateEvent)
            .filter(Boolean)
            .sort()[0],
          latest: events
            .map((e: any) => e.dateEvent)
            .filter(Boolean)
            .sort()
            .pop(),
        }
      : null

  return NextResponse.json({
    ok: true,
    season,
    seasonStr,
    leagueId,
    totalEvents: events.length,
    dateRange,
    inMarchWindow: marchEvents.length,
    marchStatusCounts,
    distinctStatuses: Object.keys(statusCounts).length,
    statusCounts,
    samples,
    note: "Read-only probe. Does not write to DB.",
  })
}
