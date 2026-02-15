import { prisma } from '@/lib/prisma'
import { fetchGameWeather, isTeamDome, getVenueForTeam } from '@/lib/openweathermap'
import { normalizeTeamAbbrev } from '@/lib/team-abbrev'

export interface ChatDataSources {
  news: { title: string; source: string; publishedAt: string; teams: string[] }[]
  injuries: { playerName: string; team: string; status: string; description: string }[]
  weather: { team: string; venue: string; isDome: boolean; temp?: number; wind?: number; impact?: string }[]
  playerStats: { name: string; position: string; team: string; stats: Record<string, any> }[]
  liveScores: { homeTeam: string; awayTeam: string; homeScore: number; awayScore: number; status: string; quarter?: string; clock?: string }[]
}

function extractPlayerAndTeamMentions(message: string): { players: string[]; teams: string[] } {
  const teamPatterns = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
    'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS',
    'Cardinals', 'Falcons', 'Ravens', 'Bills', 'Panthers', 'Bears',
    'Bengals', 'Browns', 'Cowboys', 'Broncos', 'Lions', 'Packers',
    'Texans', 'Colts', 'Jaguars', 'Chiefs', 'Raiders', 'Chargers',
    'Rams', 'Dolphins', 'Vikings', 'Patriots', 'Saints', 'Giants',
    'Jets', 'Eagles', 'Steelers', '49ers', 'Seahawks', 'Buccaneers',
    'Titans', 'Commanders',
  ]

  const teamNameToAbbrev: Record<string, string> = {
    'cardinals': 'ARI', 'falcons': 'ATL', 'ravens': 'BAL', 'bills': 'BUF',
    'panthers': 'CAR', 'bears': 'CHI', 'bengals': 'CIN', 'browns': 'CLE',
    'cowboys': 'DAL', 'broncos': 'DEN', 'lions': 'DET', 'packers': 'GB',
    'texans': 'HOU', 'colts': 'IND', 'jaguars': 'JAX', 'chiefs': 'KC',
    'raiders': 'LV', 'chargers': 'LAC', 'rams': 'LAR', 'dolphins': 'MIA',
    'vikings': 'MIN', 'patriots': 'NE', 'saints': 'NO', 'giants': 'NYG',
    'jets': 'NYJ', 'eagles': 'PHI', 'steelers': 'PIT', '49ers': 'SF',
    'seahawks': 'SEA', 'buccaneers': 'TB', 'titans': 'TEN', 'commanders': 'WAS',
  }

  const foundTeams: Set<string> = new Set()
  const upper = message.toUpperCase()
  const lower = message.toLowerCase()

  for (const t of teamPatterns) {
    if (t.length <= 3) {
      const regex = new RegExp(`\\b${t}\\b`, 'i')
      if (regex.test(message)) {
        foundTeams.add(normalizeTeamAbbrev(t) || t.toUpperCase())
      }
    } else {
      if (lower.includes(t.toLowerCase())) {
        const abbrev = teamNameToAbbrev[t.toLowerCase()]
        if (abbrev) foundTeams.add(abbrev)
      }
    }
  }

  const players: string[] = []
  const words = message.split(/\s+/)
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].replace(/[^a-zA-Z']/g, '')
    const w2 = words[i + 1].replace(/[^a-zA-Z']/g, '')
    if (w1.length >= 2 && w2.length >= 2 && /^[A-Z]/.test(w1) && /^[A-Z]/.test(w2)) {
      players.push(`${w1} ${w2}`)
    }
  }

  return { players, teams: Array.from(foundTeams) }
}

export interface ChatEnrichmentAudit {
  sourcesUsed: string[]
  partialData: boolean
  missingSources: string[]
  errors: string[]
}

export async function enrichChatWithData(
  userMessage: string,
  options?: {
    leagueId?: string
    sleeperUsername?: string
    includeWeather?: boolean
    includeLiveScores?: boolean
  }
): Promise<{ context: string; sources: ChatDataSources; audit: ChatEnrichmentAudit }> {
  const { players, teams } = extractPlayerAndTeamMentions(userMessage)
  const lower = userMessage.toLowerCase()

  const sources: ChatDataSources = {
    news: [],
    injuries: [],
    weather: [],
    playerStats: [],
    liveScores: [],
  }

  const contextParts: string[] = []
  const enrichErrors: string[] = []
  const enrichMissing: string[] = []
  const enrichSourcesUsed: string[] = []

  const wantsNews = lower.includes('news') || lower.includes('update') || lower.includes('latest') || lower.includes('report') || teams.length > 0 || players.length > 0
  const wantsWeather = lower.includes('weather') || lower.includes('start') || lower.includes('sit') || lower.includes('lineup') || lower.includes('game day') || lower.includes('gameday')
  const wantsInjury = lower.includes('injur') || lower.includes('hurt') || lower.includes('out') || lower.includes('questionable') || lower.includes('doubtful') || lower.includes('health')
  const wantsScores = lower.includes('score') || lower.includes('game') || lower.includes('live') || lower.includes('playing') || lower.includes('winning') || lower.includes('losing')
  const wantsStats = lower.includes('stat') || lower.includes('yards') || lower.includes('touchdown') || lower.includes('point') || lower.includes('average') || lower.includes('how') || players.length > 0

  const tasks: Promise<void>[] = []

  if (wantsNews || teams.length > 0) {
    tasks.push((async () => {
      try {
        const whereClause: any = {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
        if (teams.length > 0) {
          whereClause.OR = teams.map(t => ({
            team: t
          }))
        }

        const newsArticles = await prisma.sportsNews.findMany({
          where: whereClause,
          orderBy: { publishedAt: 'desc' },
          take: 8,
        })

        if (newsArticles.length > 0) {
          enrichSourcesUsed.push('news')
          sources.news = newsArticles.map(a => ({
            title: a.title,
            source: a.source,
            publishedAt: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
            teams: a.team ? [a.team] : [],
          }))

          contextParts.push(`\n## LATEST NEWS (from ESPN + NewsAPI)\n${newsArticles.map(a =>
            `- [${a.source}] ${a.title} (${a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : 'recent'})`
          ).join('\n')}`)
        }
      } catch (err) {
        enrichErrors.push(`news: ${String(err)}`)
        enrichMissing.push('news')
        console.warn('[ChatEnrich] News fetch failed:', err)
      }
    })())
  }

  if (wantsInjury || teams.length > 0) {
    tasks.push((async () => {
      try {
        const whereClause: any = {
          status: { not: 'Active' },
        }
        if (teams.length > 0) {
          whereClause.team = { in: teams }
        }
        if (players.length > 0 && teams.length === 0) {
          whereClause.playerName = {
            in: players.map(p => p),
          }
        }

        const injuries = await prisma.sportsInjury.findMany({
          where: whereClause,
          orderBy: { updatedAt: 'desc' },
          take: 10,
        })

        if (injuries.length > 0) {
          enrichSourcesUsed.push('injuries')
          sources.injuries = injuries.map(i => ({
            playerName: i.playerName,
            team: i.team || 'Unknown',
            status: i.status || 'Unknown',
            description: i.description || '',
          }))

          contextParts.push(`\n## INJURY REPORT (from API-Sports)\n${injuries.map(i =>
            `- ${i.playerName} (${i.team}): ${i.status}${i.description ? ' - ' + i.description : ''}`
          ).join('\n')}`)
        }
      } catch (err) {
        enrichErrors.push(`injuries: ${String(err)}`)
        enrichMissing.push('injuries')
        console.warn('[ChatEnrich] Injury fetch failed:', err)
      }
    })())
  }

  if ((wantsWeather || options?.includeWeather) && teams.length > 0) {
    tasks.push((async () => {
      try {
        const weatherResults = await Promise.all(
          teams.slice(0, 4).map(async (team) => {
            const venue = getVenueForTeam(team)
            const isDome = isTeamDome(team)
            if (isDome) {
              return {
                team,
                venue: venue || 'Unknown',
                isDome: true,
                impact: 'Indoor stadium — no weather impact',
              }
            }
            const gw = await fetchGameWeather(team)
            if (!gw) return null
            return {
              team,
              venue: gw.venue,
              isDome: false,
              temp: gw.weather.temp,
              wind: gw.weather.windSpeed,
              impact: gw.weather.fantasyImpact,
            }
          })
        )

        const validWeather = weatherResults.filter(Boolean) as NonNullable<typeof weatherResults[number]>[]
        if (validWeather.length > 0) {
          enrichSourcesUsed.push('weather')
          sources.weather = validWeather
          contextParts.push(`\n## GAME-DAY WEATHER (from OpenWeatherMap)\n${validWeather.map(w =>
            `- ${w.team} at ${w.venue}: ${w.isDome ? 'DOME (no weather impact)' : `${Math.round(w.temp!)}°F, ${Math.round(w.wind!)} mph wind`}${w.impact ? ' — ' + w.impact : ''}`
          ).join('\n')}`)
        }
      } catch (err) {
        enrichErrors.push(`weather: ${String(err)}`)
        enrichMissing.push('weather')
        console.warn('[ChatEnrich] Weather fetch failed:', err)
      }
    })())
  }

  if (wantsScores || options?.includeLiveScores) {
    tasks.push((async () => {
      try {
        const today = new Date()
        const startOfDay = new Date(today)
        startOfDay.setHours(0, 0, 0, 0)

        const games = await prisma.sportsGame.findMany({
          where: {
            source: 'espn_live',
            startTime: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { startTime: 'desc' },
          take: 16,
        })

        if (games.length > 0) {
          enrichSourcesUsed.push('live_scores')
          sources.liveScores = games.map(g => ({
            homeTeam: g.homeTeam,
            awayTeam: g.awayTeam,
            homeScore: g.homeScore ?? 0,
            awayScore: g.awayScore ?? 0,
            status: g.status || 'Scheduled',
          }))

          contextParts.push(`\n## LIVE/RECENT SCORES (from ESPN)\n${games.map(g =>
            `- ${g.awayTeam} ${g.awayScore ?? 0} @ ${g.homeTeam} ${g.homeScore ?? 0} (${g.status || 'Scheduled'})`
          ).join('\n')}`)
        }
      } catch (err) {
        enrichErrors.push(`live_scores: ${String(err)}`)
        enrichMissing.push('live_scores')
        console.warn('[ChatEnrich] Scores fetch failed:', err)
      }
    })())
  }

  if (wantsStats && players.length > 0) {
    tasks.push((async () => {
      try {
        for (const playerName of players.slice(0, 3)) {
          const [firstName, ...rest] = playerName.split(' ')
          const lastName = rest.join(' ')

          const identity = await prisma.playerIdentityMap.findFirst({
            where: {
              OR: [
                { canonicalName: { contains: lastName, mode: 'insensitive' } },
                { canonicalName: { equals: playerName, mode: 'insensitive' } },
              ],
            },
          })

          if (identity) {
            const seasonStats = await prisma.playerSeasonStats.findFirst({
              where: {
                playerId: identity.rollingInsightsId || identity.sleeperId || '',
                sport: 'NFL',
              },
              orderBy: { season: 'desc' },
            })

            if (seasonStats?.stats && typeof seasonStats.stats === 'object') {
              const s = seasonStats.stats as Record<string, any>
              sources.playerStats.push({
                name: identity.canonicalName,
                position: identity.position || 'Unknown',
                team: identity.currentTeam || 'FA',
                stats: {
                  season: seasonStats.season,
                  gamesPlayed: s.games_played ?? null,
                  passingYards: s.passing_yards ?? null,
                  rushingYards: s.rushing_yards ?? null,
                  receivingYards: s.receiving_yards ?? null,
                  touchdowns: (s.passing_touchdowns ?? 0) + (s.rushing_touchdowns ?? 0) + (s.receiving_touchdowns ?? 0),
                  receptions: s.receptions ?? null,
                },
              })
            }
          }
        }

        if (sources.playerStats.length > 0) {
          enrichSourcesUsed.push('player_stats')
          contextParts.push(`\n## PLAYER STATS (from Rolling Insights / API-Sports)\n${sources.playerStats.map(p => {
            const s = p.stats
            const statLines: string[] = []
            if (s.passingYards) statLines.push(`${s.passingYards} pass yds`)
            if (s.rushingYards) statLines.push(`${s.rushingYards} rush yds`)
            if (s.receivingYards) statLines.push(`${s.receivingYards} rec yds`)
            if (s.receptions) statLines.push(`${s.receptions} rec`)
            if (s.touchdowns) statLines.push(`${s.touchdowns} TDs`)
            return `- ${p.name} (${p.position}, ${p.team}) [${s.season}]: ${statLines.join(', ') || 'No stats available'} in ${s.gamesPlayed ?? '?'} games`
          }).join('\n')}`)
        }
      } catch (err) {
        enrichErrors.push(`player_stats: ${String(err)}`)
        enrichMissing.push('player_stats')
        console.warn('[ChatEnrich] Stats fetch failed:', err)
      }
    })())
  }

  await Promise.all(tasks)

  const context = contextParts.length > 0
    ? `\n\n## REAL-TIME DATA CONTEXT\nThe following data was pulled from your integrated data sources to help answer this question. Cite this data in your response — be specific about where it came from.\n${contextParts.join('\n')}`
    : ''

  const audit: ChatEnrichmentAudit = {
    sourcesUsed: enrichSourcesUsed,
    partialData: enrichMissing.length > 0,
    missingSources: enrichMissing,
    errors: enrichErrors,
  }

  return { context, sources, audit }
}

export function buildDataSourcesSummary(sources: ChatDataSources): string[] {
  const summary: string[] = []
  if (sources.news.length > 0) summary.push(`${sources.news.length} news articles (ESPN, NewsAPI)`)
  if (sources.injuries.length > 0) summary.push(`${sources.injuries.length} injury reports (API-Sports)`)
  if (sources.weather.length > 0) summary.push(`${sources.weather.length} weather reports (OpenWeatherMap)`)
  if (sources.playerStats.length > 0) summary.push(`${sources.playerStats.length} player stat profiles (Rolling Insights)`)
  if (sources.liveScores.length > 0) summary.push(`${sources.liveScores.length} game scores (ESPN)`)
  return summary
}
