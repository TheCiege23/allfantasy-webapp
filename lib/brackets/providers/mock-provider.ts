import type {
  BracketDataProvider,
  CapabilityScore,
  NcaabGame,
  NcaabTeamSeed,
  PlayByPlayEvent,
  TournamentField,
} from "./types"

const MOCK_TEAMS: NcaabTeamSeed[] = [
  { teamName: "Connecticut", seed: 1, region: "East" },
  { teamName: "Iowa State", seed: 1, region: "South" },
  { teamName: "Houston", seed: 1, region: "West" },
  { teamName: "Purdue", seed: 1, region: "Midwest" },
  { teamName: "Marquette", seed: 2, region: "East" },
  { teamName: "Tennessee", seed: 2, region: "South" },
  { teamName: "Arizona", seed: 2, region: "West" },
  { teamName: "Duke", seed: 2, region: "Midwest" },
  { teamName: "Baylor", seed: 3, region: "East" },
  { teamName: "Creighton", seed: 3, region: "South" },
  { teamName: "Illinois", seed: 3, region: "West" },
  { teamName: "Kentucky", seed: 3, region: "Midwest" },
  { teamName: "Auburn", seed: 4, region: "East" },
  { teamName: "Kansas", seed: 4, region: "South" },
  { teamName: "Gonzaga", seed: 4, region: "West" },
  { teamName: "North Carolina", seed: 4, region: "Midwest" },
  { teamName: "San Diego State", seed: 5, region: "East" },
  { teamName: "Wisconsin", seed: 5, region: "South" },
  { teamName: "Saint Mary's", seed: 5, region: "West" },
  { teamName: "Clemson", seed: 5, region: "Midwest" },
  { teamName: "BYU", seed: 6, region: "East" },
  { teamName: "Texas Tech", seed: 6, region: "South" },
  { teamName: "Dayton", seed: 6, region: "West" },
  { teamName: "South Carolina", seed: 6, region: "Midwest" },
  { teamName: "Texas", seed: 7, region: "East" },
  { teamName: "Florida", seed: 7, region: "South" },
  { teamName: "Washington State", seed: 7, region: "West" },
  { teamName: "Nevada", seed: 7, region: "Midwest" },
  { teamName: "Northwestern", seed: 8, region: "East" },
  { teamName: "Utah State", seed: 8, region: "South" },
  { teamName: "Memphis", seed: 8, region: "West" },
  { teamName: "Mississippi State", seed: 8, region: "Midwest" },
  { teamName: "Michigan State", seed: 9, region: "East" },
  { teamName: "TCU", seed: 9, region: "South" },
  { teamName: "Florida Atlantic", seed: 9, region: "West" },
  { teamName: "Oregon", seed: 9, region: "Midwest" },
  { teamName: "Drake", seed: 10, region: "East" },
  { teamName: "Virginia", seed: 10, region: "South" },
  { teamName: "Colorado State", seed: 10, region: "West" },
  { teamName: "New Mexico", seed: 10, region: "Midwest" },
  { teamName: "NC State", seed: 11, region: "East" },
  { teamName: "Oregon State", seed: 11, region: "South" },
  { teamName: "Pittsburgh", seed: 11, region: "West" },
  { teamName: "McNeese State", seed: 11, region: "Midwest" },
  { teamName: "Grand Canyon", seed: 12, region: "East" },
  { teamName: "James Madison", seed: 12, region: "South" },
  { teamName: "UAB", seed: 12, region: "West" },
  { teamName: "Samford", seed: 12, region: "Midwest" },
  { teamName: "Vermont", seed: 13, region: "East" },
  { teamName: "Yale", seed: 13, region: "South" },
  { teamName: "Charleston", seed: 13, region: "West" },
  { teamName: "Akron", seed: 13, region: "Midwest" },
  { teamName: "Colgate", seed: 14, region: "East" },
  { teamName: "Morehead State", seed: 14, region: "South" },
  { teamName: "Oakland", seed: 14, region: "West" },
  { teamName: "Grambling State", seed: 14, region: "Midwest" },
  { teamName: "Long Beach State", seed: 15, region: "East" },
  { teamName: "South Dakota State", seed: 15, region: "South" },
  { teamName: "Montana State", seed: 15, region: "West" },
  { teamName: "Stetson", seed: 15, region: "Midwest" },
  { teamName: "Wagner", seed: 16, region: "East" },
  { teamName: "Longwood", seed: 16, region: "South" },
  { teamName: "Howard", seed: 16, region: "West" },
  { teamName: "FDU", seed: 16, region: "Midwest" },
]

const R64_MATCHUPS = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15],
]

function generateMockGames(season: number): NcaabGame[] {
  const games: NcaabGame[] = []
  const regions = ["East", "South", "West", "Midwest"]
  const baseDate = new Date(Date.UTC(season, 2, 21, 16, 0, 0))

  for (const region of regions) {
    const regionTeams = MOCK_TEAMS.filter((t) => t.region === region)
    const bySeed = new Map(regionTeams.map((t) => [t.seed, t]))

    for (let i = 0; i < R64_MATCHUPS.length; i++) {
      const [seedH, seedA] = R64_MATCHUPS[i]
      const home = bySeed.get(seedH)
      const away = bySeed.get(seedA)
      if (!home || !away) continue

      const gameDate = new Date(baseDate.getTime() + i * 2.5 * 60 * 60 * 1000)

      games.push({
        externalId: `mock-${season}-${region}-r64-${i + 1}`,
        homeTeam: home.teamName,
        awayTeam: away.teamName,
        homeSeed: seedH,
        awaySeed: seedA,
        homeScore: null,
        awayScore: null,
        status: "scheduled",
        startTime: gameDate,
        round: 1,
        region,
      })
    }
  }

  return games
}

export class MockProvider implements BracketDataProvider {
  readonly name = "Mock JSON Provider"
  readonly id = "mock"

  async capabilities(): Promise<CapabilityScore> {
    return {
      bracket_seeding: true,
      schedule: true,
      live_scores: true,
      play_by_play: true,
      team_stats: false,
      injuries: false,
      odds: false,
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
    return true
  }

  async getTournamentField(season: number): Promise<TournamentField> {
    const lockTime = new Date(Date.UTC(season, 2, 21, 16, 0, 0))
    return {
      season,
      teams: MOCK_TEAMS,
      isFieldSet: true,
      lockTime,
    }
  }

  async getSchedule(season: number): Promise<NcaabGame[]> {
    return generateMockGames(season)
  }

  async getLiveScores(gameIds?: string[]): Promise<NcaabGame[]> {
    const games = generateMockGames(new Date().getFullYear())
    if (!gameIds) return games
    return games.filter((g) => gameIds.includes(g.externalId))
  }

  async getPlayByPlay(gameId: string): Promise<PlayByPlayEvent[]> {
    return [
      {
        gameId,
        timestamp: new Date(),
        clock: "19:45",
        period: 1,
        eventType: "score",
        description: "Three-pointer by Guard #3",
        homeScore: 3,
        awayScore: 0,
        team: "Home",
        player: "Guard #3",
      },
      {
        gameId,
        timestamp: new Date(),
        clock: "19:20",
        period: 1,
        eventType: "score",
        description: "Layup by Forward #22",
        homeScore: 3,
        awayScore: 2,
        team: "Away",
        player: "Forward #22",
      },
    ]
  }
}
