import type {
  BracketDataProvider,
  CapabilityScore,
  NcaabGame,
  PlayByPlayEvent,
  TournamentField,
} from "./types"

type HttpProviderConfig = {
  name: string
  id: string
  baseUrl: string
  apiKey?: string
  endpoints: {
    tournamentField?: string
    schedule?: string
    liveScores?: string
    playByPlay?: string
    teamStats?: string
    injuries?: string
    odds?: string
  }
  headers?: Record<string, string>
  parseField?: (data: any, season: number) => TournamentField | null
  parseSchedule?: (data: any, season: number) => NcaabGame[]
  parseLiveScores?: (data: any) => NcaabGame[]
  parsePlayByPlay?: (data: any, gameId: string) => PlayByPlayEvent[]
}

function defaultParseField(data: any, season: number): TournamentField | null {
  if (!data?.teams || !Array.isArray(data.teams)) return null
  return {
    season,
    teams: data.teams.map((t: any) => ({
      teamName: t.name || t.teamName || t.team || "",
      seed: Number(t.seed || 0),
      region: t.region || "",
    })),
    isFieldSet: data.teams.length >= 64,
    lockTime: data.lockTime ? new Date(data.lockTime) : null,
  }
}

function defaultParseSchedule(data: any): NcaabGame[] {
  const games = data?.games || data?.schedule || data?.events || []
  if (!Array.isArray(games)) return []
  return games.map((g: any) => ({
    externalId: String(g.id || g.externalId || g.gameId || ""),
    homeTeam: g.homeTeam || g.home?.name || "",
    awayTeam: g.awayTeam || g.away?.name || "",
    homeSeed: g.homeSeed ?? g.home?.seed ?? null,
    awaySeed: g.awaySeed ?? g.away?.seed ?? null,
    homeScore: g.homeScore ?? g.home?.score ?? null,
    awayScore: g.awayScore ?? g.away?.score ?? null,
    status: normalizeStatus(g.status || g.state || ""),
    startTime: g.startTime ? new Date(g.startTime) : null,
    round: g.round ?? null,
    region: g.region ?? null,
    venue: g.venue ?? null,
  }))
}

function normalizeStatus(raw: string): NcaabGame["status"] {
  const s = raw.toLowerCase().trim()
  if (["final", "ft", "completed", "closed"].includes(s)) return "final"
  if (["live", "in_progress", "inprogress", "active"].includes(s)) return "in_progress"
  if (["scheduled", "ns", "pre", "upcoming"].includes(s)) return "scheduled"
  return "unknown"
}

export class HttpProvider implements BracketDataProvider {
  readonly name: string
  readonly id: string
  private config: HttpProviderConfig

  constructor(config: HttpProviderConfig) {
    this.name = config.name
    this.id = config.id
    this.config = config
  }

  async capabilities(): Promise<CapabilityScore> {
    const ep = this.config.endpoints
    return {
      bracket_seeding: !!ep.tournamentField,
      schedule: !!ep.schedule,
      live_scores: !!ep.liveScores,
      play_by_play: !!ep.playByPlay,
      team_stats: !!ep.teamStats,
      injuries: !!ep.injuries,
      odds: !!ep.odds,
    }
  }

  async capabilityScore(): Promise<number> {
    const caps = await this.capabilities()
    let score = 0
    if (caps.bracket_seeding) score += 30
    if (caps.schedule) score += 20
    if (caps.live_scores) score += 25
    if (caps.play_by_play) score += 15
    if (caps.team_stats) score += 5
    if (caps.injuries) score += 3
    if (caps.odds) score += 2
    return score
  }

  async checkHealth(): Promise<boolean> {
    try {
      const url = this.config.endpoints.schedule
        ? `${this.config.baseUrl}${this.config.endpoints.schedule}`
        : this.config.baseUrl
      const res = await fetch(url, {
        method: "HEAD",
        headers: this.buildHeaders(),
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async getTournamentField(season: number): Promise<TournamentField | null> {
    const ep = this.config.endpoints.tournamentField
    if (!ep) return null
    const url = `${this.config.baseUrl}${ep}`.replace("{season}", String(season))
    const data = await this.fetchJson(url)
    if (!data) return null
    const parser = this.config.parseField || defaultParseField
    return parser(data, season)
  }

  async getSchedule(season: number): Promise<NcaabGame[]> {
    const ep = this.config.endpoints.schedule
    if (!ep) return []
    const url = `${this.config.baseUrl}${ep}`.replace("{season}", String(season))
    const data = await this.fetchJson(url)
    if (!data) return []
    const parser = this.config.parseSchedule || defaultParseSchedule
    return parser(data, season)
  }

  async getLiveScores(gameIds?: string[]): Promise<NcaabGame[]> {
    const ep = this.config.endpoints.liveScores
    if (!ep) return []
    let url = `${this.config.baseUrl}${ep}`
    if (gameIds?.length) url += `?ids=${gameIds.join(",")}`
    const data = await this.fetchJson(url)
    if (!data) return []
    const parser = this.config.parseLiveScores || defaultParseSchedule
    return parser(data)
  }

  async getPlayByPlay(gameId: string): Promise<PlayByPlayEvent[]> {
    const ep = this.config.endpoints.playByPlay
    if (!ep) return []
    const url = `${this.config.baseUrl}${ep}`.replace("{gameId}", gameId)
    const data = await this.fetchJson(url)
    if (!data) return []
    const parser = this.config.parsePlayByPlay
    if (!parser) return []
    return parser(data, gameId)
  }

  private buildHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      "Accept": "application/json",
      ...this.config.headers,
    }
    if (this.config.apiKey) {
      h["x-api-key"] = this.config.apiKey
    }
    return h
  }

  private async fetchJson(url: string): Promise<any> {
    try {
      const res = await fetch(url, {
        headers: this.buildHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.warn(`[${this.id}] HTTP ${res.status} from ${url}`)
        return null
      }
      return await res.json()
    } catch (e: any) {
      console.warn(`[${this.id}] fetch error: ${e?.message}`)
      return null
    }
  }
}
