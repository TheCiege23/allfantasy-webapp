import { prisma } from '@/lib/prisma'
import { fetchFantasyCalcValues, findPlayerByName } from '@/lib/fantasycalc'
import { fetchNewsContext, fetchRollingInsights } from '@/lib/upstream-apis'
import type { TradeDecisionContextV1 } from './trade-decision-context'

export type TradeAnalyzerIntelDeps = {
  fetchNewsContext: typeof fetchNewsContext
  fetchRollingInsights: typeof fetchRollingInsights
  fetchFantasyCalcValues: typeof fetchFantasyCalcValues
  findPlayerByName: typeof findPlayerByName
  findLatestRookieClass: (args?: any) => Promise<any>
  findTopRookieRankings: (args?: any) => Promise<any[]>
}

function toPlayerNames(ctx: TradeDecisionContextV1): string[] {
  return [
    ...ctx.sideA.assets.filter(a => a.type === 'PLAYER').map(a => a.name),
    ...ctx.sideB.assets.filter(a => a.type === 'PLAYER').map(a => a.name),
  ]
}

function toTeamAbbrevs(ctx: TradeDecisionContextV1): string[] {
  return [...new Set([
    ...ctx.sideA.assets.map(a => a.team).filter((t): t is string => Boolean(t)),
    ...ctx.sideB.assets.map(a => a.team).filter((t): t is string => Boolean(t)),
  ])]
}

const defaultDeps: TradeAnalyzerIntelDeps = {
  fetchNewsContext: (deps: any, params: any) => fetchNewsContext(deps, params),
  fetchRollingInsights: (deps: any, params: any) => fetchRollingInsights(deps, params),
  fetchFantasyCalcValues,
  findPlayerByName,
  findLatestRookieClass: () => prisma.rookieClass.findFirst({ orderBy: { year: 'desc' } }),
  findTopRookieRankings: () => prisma.rookieRanking.findMany({ orderBy: [{ year: 'desc' }, { rank: 'asc' }], take: 20 }),
}

export async function buildTradeAnalyzerIntelPrompt(ctx: TradeDecisionContextV1, deps: TradeAnalyzerIntelDeps = defaultDeps): Promise<string> {
  const playerNames = toPlayerNames(ctx).slice(0, 20)
  const teamAbbrevs = toTeamAbbrevs(ctx).slice(0, 12)

  const [news, rolling, fantasyCalc, rookieClass, rookieRanks] = await Promise.all([
    deps.fetchNewsContext({ prisma, newsApiKey: process.env.NEWS_API_KEY }, {
      playerNames,
      teamAbbrevs,
      sport: 'NFL',
      hoursBack: 120,
      limit: 25,
    }).catch(() => null),
    deps.fetchRollingInsights({ prisma }, {
      playerNames,
      teamAbbrevs,
      sport: 'NFL',
      includeStats: true,
    }).catch(() => null),
    deps.fetchFantasyCalcValues({
      isDynasty: true,
      numQbs: ctx.leagueConfig.isSF ? 2 : 1,
      numTeams: [10, 12, 14, 16].includes(ctx.leagueConfig.numTeams) ? (ctx.leagueConfig.numTeams as 10 | 12 | 14 | 16) : 12,
      ppr: 1,
    }).catch(() => []),
    deps.findLatestRookieClass().catch(() => null),
    deps.findTopRookieRankings().catch(() => []),
  ])

  const fcLines = playerNames
    .map(n => ({ name: n, v: deps.findPlayerByName(fantasyCalc, n) }))
    .filter(r => r.v)
    .slice(0, 14)
    .map(r => `- ${r.name}: value=${r.v!.value}, rank=#${r.v!.overallRank}, posRank=${r.v!.positionRank}, trend30d=${r.v!.trend30Day}`)

  const newsLines = (news?.items || []).slice(0, 10).map((n: any) => `- [${n.relevance}] ${n.title} (${n.source}, ${n.publishedAt?.slice(0, 10) || 'unknown'})`)
  const rollingLines = (rolling?.players || []).slice(0, 10).map((p: any) => `- ${p.name} (${p.position || '?'}/${p.team || '?'}): status=${p.status || 'unknown'}, fpg=${p.fantasyPointsPerGame ?? 'n/a'}, games=${p.gamesPlayed ?? 'n/a'}`)

  const rookieLines = (rookieRanks || []).slice(0, 10).map((r: any) => `- ${r.year} #${r.rank}: ${r.name} (${r.position})${r.dynastyValue ? ` value=${r.dynastyValue}` : ''}`)

  const parts: string[] = []
  parts.push('--- EXTERNAL TRADE INTELLIGENCE LAYER ---')
  parts.push(`News: ${news?.items?.length || 0} items | sources=${news?.sources?.join(', ') || 'none'} | fetched=${news?.fetchedAt || 'n/a'}`)
  if (newsLines.length) parts.push(newsLines.join('\n'))
  parts.push(`Rolling Insights: players=${rolling?.players?.length || 0}, teams=${rolling?.teams?.length || 0}, source=${rolling?.source || 'n/a'}, fetched=${rolling?.fetchedAt || 'n/a'}`)
  if (rollingLines.length) parts.push(rollingLines.join('\n'))
  parts.push(`FantasyCalc matches: ${fcLines.length}/${playerNames.length}`)
  if (fcLines.length) parts.push(fcLines.join('\n'))
  if (rookieClass) {
    parts.push(`Rookie Class ${rookieClass.year}: strength=${rookieClass.strength.toFixed(2)}, QB=${rookieClass.qbDepth.toFixed(2)}, RB=${rookieClass.rbDepth.toFixed(2)}, WR=${rookieClass.wrDepth.toFixed(2)}, TE=${rookieClass.teDepth.toFixed(2)}`)
  }
  if (rookieLines.length) {
    parts.push('Top Rookie Rankings:')
    parts.push(rookieLines.join('\n'))
  }
  parts.push('Interpretation rules: prioritize data recency, account for manager windows (win-now/rebuild/middle), and use injuries/news/team context to adjust conviction.')
  parts.push('--- END EXTERNAL TRADE INTELLIGENCE LAYER ---')

  return parts.join('\n')
}
