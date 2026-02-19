import { prisma } from '../prisma'
import { priceAssets, pricePlayer, pricePick, type PricedAsset, type ValuationContext, type AssetsInput, type PickInput } from '../hybrid-valuation'
import { getPlayerAnalyticsBatch, type PlayerAnalytics } from '../player-analytics'
import { buildManagerProfile, type ManagerTendencyProfile } from './manager-tendency-engine'
import {
  computeNeedsSurplus,
  computeStarterStrengthIndex,
  classifyCornerstone,
} from './league-intelligence'
import { type Asset, type LeagueSettings, DEFAULT_THRESHOLDS } from './types'
import { getPlayerADP, type ADPEntry } from '../adp-data'

export interface TradeParty {
  name: string
  assets: string[]
}

export interface LeagueContextInput {
  leagueId?: string
  leagueName?: string
  scoringType?: string
  numTeams?: number
  isSF?: boolean
  isTEP?: boolean
  tepBonus?: number
  rosterPositions?: string[]
  starterSlots?: number
  benchSlots?: number
  taxiSlots?: number
  scoringSettings?: Record<string, number>
}

export interface PlayerFact {
  name: string
  position: string
  age: number | null
  team: string | null
  marketValue: number
  impactValue: number
  vorpValue: number
  volatility: number
  source: string
  adp: { rank: number; position: string; value: number | null } | null
  injuryStatus: { status: string; type: string | null; description: string | null; date: string | null } | null
  analytics: {
    athleticGrade: number | null
    collegeProductionGrade: number | null
    weeklyVolatility: number | null
    breakoutAge: number | null
    comparablePlayers: string | null
  } | null
  isCornerstone: boolean
  cornerstoneReason: string
}

export interface ManagerFact {
  managerId: string
  managerName: string
  tendencies: ManagerTendencyProfile | null
  contenderTier: string
  needs: string[]
  surplus: string[]
  starterStrengthIndex: number
  rosterSize: number
  pickCount: number
  youngAssetCount: number
}

export interface TradeContextSnapshot {
  assembledAt: string
  version: string

  league: {
    name: string
    scoringType: string
    numTeams: number
    isSF: boolean
    isTEP: boolean
    tepBonus: number
    starterSlots: number
    rosterPositions: string[]
    scoringSettings: Record<string, number>
  }

  sideA: {
    assets: PlayerFact[]
    totalValue: number
    manager: ManagerFact | null
  }

  sideB: {
    assets: PlayerFact[]
    totalValue: number
    manager: ManagerFact | null
  }

  valueDelta: {
    absoluteDiff: number
    percentageDiff: number
    favoredSide: 'A' | 'B' | 'Even'
  }

  leagueTradeHistory: {
    totalTrades: number
    recentTrades: number
    avgValueDelta: number
  }

  dataQuality: {
    playersCovered: number
    playersTotal: number
    adpHitRate: number
    injuryDataAvailable: boolean
    analyticsAvailable: boolean
    warnings: string[]
  }
}

function extractPlayerNames(assets: string[]): string[] {
  return assets
    .map(s => s.trim())
    .filter(s => s.length > 2 && !/^\d{4}\s/.test(s) && !/pick/i.test(s))
}

function isPickAsset(asset: string): boolean {
  return /pick|round|1st|2nd|3rd|4th/i.test(asset.toLowerCase())
}

function parsePickFromString(asset: string): PickInput {
  const yearMatch = asset.match(/(\d{4})/)
  const roundMatch = asset.match(/(\d)(st|nd|rd|th)/i)
  const currentYear = new Date().getFullYear()

  let round = 1
  if (roundMatch) {
    round = parseInt(roundMatch[1])
  } else if (/2nd|second/i.test(asset)) {
    round = 2
  } else if (/3rd|third/i.test(asset)) {
    round = 3
  } else if (/4th|fourth/i.test(asset)) {
    round = 4
  }

  const tierMatch = asset.toLowerCase()
  let tier: 'early' | 'mid' | 'late' | null = null
  if (tierMatch.includes('early')) tier = 'early'
  else if (tierMatch.includes('late')) tier = 'late'
  else if (tierMatch.includes('mid')) tier = 'mid'

  return {
    year: yearMatch ? parseInt(yearMatch[1]) : currentYear + 1,
    round,
    tier,
  }
}

async function fetchInjuries(playerNames: string[]): Promise<Map<string, { status: string; type: string | null; description: string | null; date: string | null }>> {
  const result = new Map<string, { status: string; type: string | null; description: string | null; date: string | null }>()
  if (playerNames.length === 0) return result

  try {
    const injuries = await prisma.sportsInjury.findMany({
      where: {
        playerName: { in: playerNames },
        sport: 'NFL',
      },
      orderBy: { fetchedAt: 'desc' },
    })

    for (const inj of injuries) {
      if (!result.has(inj.playerName)) {
        result.set(inj.playerName, {
          status: inj.status || 'Unknown',
          type: inj.type,
          description: inj.description,
          date: inj.date ? inj.date.toISOString().split('T')[0] : null,
        })
      }
    }
  } catch (e) {
    console.warn('[trade-context] Injury fetch failed:', e)
  }

  return result
}

async function fetchManagerContext(
  leagueId: string | undefined,
  partyName: string,
  settings: LeagueSettings
): Promise<ManagerFact | null> {
  if (!leagueId) return null

  try {
    const league = await prisma.league.findFirst({
      where: { platformLeagueId: leagueId },
      include: { rosters: true },
    })

    if (!league) return null

    const partyLower = partyName.toLowerCase()
    const roster = league.rosters.find(r => {
      const pd = r.playerData as any
      const ownerName = pd?.ownerDisplayName || pd?.displayName || ''
      return ownerName.toLowerCase().includes(partyLower)
    }) || league.rosters[0]

    if (!roster) return null

    const playerData = Array.isArray(roster.playerData)
      ? (roster.playerData as any[])
      : ((roster.playerData as any)?.players || [])

    const rosterAssets: Asset[] = playerData.map((p: any, idx: number) => ({
      id: `${roster.id}-${idx}`,
      name: p.fullName || p.playerName || p.full_name || 'Unknown',
      type: 'PLAYER' as const,
      pos: p.position || 'UNKNOWN',
      value: p.marketValue || p.value || 0,
      age: p.age || null,
    }))

    let tendencies: ManagerTendencyProfile | null = null
    try {
      const tradeNotifs = await prisma.tradeNotification.findMany({
        where: { userId: league.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      if (tradeNotifs.length >= 3) {
        const normalizedTrades = tradeNotifs.map(t => {
          const data = (t as any).tradeData || {}
          return {
            sideA: Array.isArray(data.sideA) ? data.sideA : [],
            sideB: Array.isArray(data.sideB) ? data.sideB : [],
          }
        })
        const profile = buildManagerProfile(normalizedTrades as any)
        tendencies = {
          managerId: String(roster.id),
          managerName: partyName,
          computedAt: Date.now(),
          ...profile,
        }
      }
    } catch {
    }

    const { needs, surplus } = computeNeedsSurplus(rosterAssets, settings)
    const starterIdx = computeStarterStrengthIndex(rosterAssets, settings.starterSlots || 8)
    const youngAssets = rosterAssets.filter(a => a.age != null && (a.age as number) <= 25).length
    const picks = rosterAssets.filter(a => a.type === 'PICK').length

    return {
      managerId: String(roster.id),
      managerName: partyName,
      tendencies,
      contenderTier: 'middle',
      needs,
      surplus,
      starterStrengthIndex: starterIdx,
      rosterSize: rosterAssets.length,
      pickCount: picks,
      youngAssetCount: youngAssets,
    }
  } catch (e) {
    console.warn('[trade-context] Manager context fetch failed:', e)
    return null
  }
}

async function fetchLeagueTradeHistory(leagueId: string | undefined): Promise<{ totalTrades: number; recentTrades: number; avgValueDelta: number }> {
  if (!leagueId) return { totalTrades: 0, recentTrades: 0, avgValueDelta: 0 }

  try {
    const league = await prisma.league.findFirst({ where: { platformLeagueId: leagueId } })
    if (!league) return { totalTrades: 0, recentTrades: 0, avgValueDelta: 0 }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [total, recent] = await Promise.all([
      prisma.tradeNotification.count({ where: { userId: league.userId } }),
      prisma.tradeNotification.count({ where: { userId: league.userId, createdAt: { gte: thirtyDaysAgo } } }),
    ])

    return { totalTrades: total, recentTrades: recent, avgValueDelta: 0 }
  } catch {
    return { totalTrades: 0, recentTrades: 0, avgValueDelta: 0 }
  }
}

export async function assembleTradeContext(
  sideA: TradeParty,
  sideB: TradeParty,
  leagueInput: LeagueContextInput
): Promise<TradeContextSnapshot> {
  const warnings: string[] = []

  const leagueSettings: LeagueSettings = {
    leagueName: leagueInput.leagueName || 'Unknown League',
    scoringType: (leagueInput.scoringType as any) || 'PPR',
    numTeams: leagueInput.numTeams || 12,
    isTEP: leagueInput.isTEP || false,
    tepBonus: leagueInput.tepBonus || 0,
    isSF: leagueInput.isSF || false,
    rosterPositions: leagueInput.rosterPositions || ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'FLEX'],
    starterSlots: leagueInput.starterSlots || 8,
    benchSlots: leagueInput.benchSlots || 6,
    taxiSlots: leagueInput.taxiSlots || 0,
    startingQB: leagueInput.isSF ? 2 : 1,
    startingRB: 2,
    startingWR: 2,
    startingTE: 1,
    startingFlex: 2,
    ppr: leagueInput.scoringType === 'Standard' ? 0 : leagueInput.scoringType === 'Half PPR' ? 0.5 : 1,
  }

  const allAssetNames = [...sideA.assets, ...sideB.assets]
  const allPlayerNames = extractPlayerNames(allAssetNames)

  const valuationCtx: ValuationContext = {
    asOfDate: new Date().toISOString().split('T')[0],
    isSuperFlex: leagueSettings.isSF ?? false,
    numTeams: leagueSettings.numTeams,
  }

  const playerNames: string[] = []
  const pickInputs: PickInput[] = []
  for (const name of allAssetNames) {
    if (isPickAsset(name)) {
      pickInputs.push(parsePickFromString(name))
    } else {
      playerNames.push(name.trim())
    }
  }

  const assetsInput: AssetsInput = {
    players: playerNames,
    picks: pickInputs,
  }

  const [pricedResult, analyticsMap, injuryMap, adpResults, managerA, managerB, tradeHistory] = await Promise.all([
    priceAssets(assetsInput, valuationCtx).catch(e => {
      warnings.push(`Valuation failed: ${e.message}`)
      return { total: 0, compositeTotal: 0, items: [] as PricedAsset[], stats: { playersFromExcel: 0, playersFromFantasyCalc: 0, playersUnknown: 0, picksFromExcel: 0, picksFromCurve: 0 } }
    }),
    getPlayerAnalyticsBatch(allPlayerNames).catch(e => {
      warnings.push(`Analytics fetch failed: ${e.message}`)
      return new Map<string, PlayerAnalytics>()
    }),
    fetchInjuries(allPlayerNames),
    Promise.all(
      allPlayerNames.slice(0, 20).map(name => getPlayerADP(name).catch(() => null))
    ),
    fetchManagerContext(leagueInput.leagueId, sideA.name, leagueSettings),
    fetchManagerContext(leagueInput.leagueId, sideB.name, leagueSettings),
    fetchLeagueTradeHistory(leagueInput.leagueId),
  ])

  const pricedItems = pricedResult.items

  const adpMap = new Map<string, ADPEntry>()
  for (const entry of adpResults) {
    if (entry) adpMap.set(entry.name.toLowerCase(), entry)
  }

  const pricedMap = new Map<string, PricedAsset>()
  for (const p of pricedItems) {
    pricedMap.set(p.name.toLowerCase(), p)
  }

  function buildPlayerFact(assetName: string): PlayerFact {
    const nameLower = assetName.trim().toLowerCase()
    const priced = pricedMap.get(nameLower)
    const analytics = analyticsMap.get(assetName.trim()) || null
    const injury = injuryMap.get(assetName.trim()) || null
    const adp = adpMap.get(nameLower)

    const asset: Asset = {
      id: `ctx-${nameLower.replace(/\s+/g, '-')}`,
      name: assetName.trim(),
      type: isPickAsset(assetName) ? 'PICK' : 'PLAYER',
      pos: priced?.position || 'UNKNOWN',
      value: priced?.value || 0,
      age: priced?.age || null,
    }

    const classified = classifyCornerstone(asset, leagueSettings, DEFAULT_THRESHOLDS)

    return {
      name: assetName.trim(),
      position: priced?.position || 'UNKNOWN',
      age: priced?.age || null,
      team: null,
      marketValue: priced?.assetValue?.marketValue || 0,
      impactValue: priced?.assetValue?.impactValue || 0,
      vorpValue: priced?.assetValue?.vorpValue || 0,
      volatility: priced?.assetValue?.volatility || 0,
      source: priced?.source || 'unknown',
      adp: adp ? { rank: adp.adp, position: adp.position, value: adp.value } : null,
      injuryStatus: injury,
      analytics: analytics ? {
        athleticGrade: analytics.combine?.athleticismScore ?? null,
        collegeProductionGrade: analytics.college?.dominatorRating ?? null,
        weeklyVolatility: analytics.weeklyVolatility ?? null,
        breakoutAge: analytics.college?.breakoutAge ?? null,
        comparablePlayers: analytics.comparablePlayers?.join(', ') ?? null,
      } : null,
      isCornerstone: classified.isCornerstone || false,
      cornerstoneReason: classified.cornerstoneReason || '',
    }
  }

  const sideAFacts = sideA.assets.map(buildPlayerFact)
  const sideBFacts = sideB.assets.map(buildPlayerFact)

  const totalA = sideAFacts.reduce((sum, f) => sum + f.marketValue, 0)
  const totalB = sideBFacts.reduce((sum, f) => sum + f.marketValue, 0)
  const absDiff = Math.abs(totalA - totalB)
  const maxVal = Math.max(totalA, totalB, 1)
  const pctDiff = Math.round((absDiff / maxVal) * 100)

  const adpHits = allPlayerNames.filter(n => adpMap.has(n.toLowerCase())).length
  const playersCovered = allPlayerNames.filter(n => pricedMap.has(n.toLowerCase())).length + pickInputs.length

  return {
    assembledAt: new Date().toISOString(),
    version: '2.0.0',

    league: {
      name: leagueSettings.leagueName,
      scoringType: leagueSettings.scoringType,
      numTeams: leagueSettings.numTeams,
      isSF: leagueSettings.isSF ?? false,
      isTEP: leagueSettings.isTEP,
      tepBonus: leagueSettings.tepBonus,
      starterSlots: leagueSettings.starterSlots,
      rosterPositions: leagueSettings.rosterPositions,
      scoringSettings: leagueInput.scoringSettings || {},
    },

    sideA: {
      assets: sideAFacts,
      totalValue: totalA,
      manager: managerA,
    },

    sideB: {
      assets: sideBFacts,
      totalValue: totalB,
      manager: managerB,
    },

    valueDelta: {
      absoluteDiff: absDiff,
      percentageDiff: pctDiff,
      favoredSide: pctDiff <= 5 ? 'Even' : totalA > totalB ? 'A' : 'B',
    },

    leagueTradeHistory: tradeHistory,

    dataQuality: {
      playersCovered,
      playersTotal: allPlayerNames.length + pickInputs.length,
      adpHitRate: allPlayerNames.length > 0 ? Math.round((adpHits / allPlayerNames.length) * 100) : 0,
      injuryDataAvailable: injuryMap.size > 0,
      analyticsAvailable: analyticsMap.size > 0,
      warnings,
    },
  }
}

export function contextToPrompt(ctx: TradeContextSnapshot): string {
  const lines: string[] = []

  lines.push(`=== DETERMINISTIC FACT LAYER (Stage A) ===`)
  lines.push(`Assembled: ${ctx.assembledAt} | Version: ${ctx.version}`)
  lines.push(`Data Quality: ${ctx.dataQuality.playersCovered}/${ctx.dataQuality.playersTotal} players valued, ${ctx.dataQuality.adpHitRate}% ADP hit rate`)
  if (ctx.dataQuality.warnings.length > 0) {
    lines.push(`Warnings: ${ctx.dataQuality.warnings.join('; ')}`)
  }
  lines.push('')

  lines.push(`--- LEAGUE FORMAT ---`)
  lines.push(`${ctx.league.name} | ${ctx.league.scoringType} | ${ctx.league.numTeams} teams`)
  lines.push(`SF: ${ctx.league.isSF} | TEP: ${ctx.league.isTEP} (bonus: ${ctx.league.tepBonus})`)
  lines.push(`Starters: ${ctx.league.starterSlots} | Positions: ${ctx.league.rosterPositions.join(', ')}`)
  lines.push('')

  for (const [label, side] of [['SIDE A', ctx.sideA], ['SIDE B', ctx.sideB]] as const) {
    lines.push(`--- ${label} (Total Value: ${side.totalValue}) ---`)
    for (const a of side.assets) {
      let line = `  ${a.name} [${a.position}] — Market: ${a.marketValue}, Impact: ${a.impactValue}, VORP: ${a.vorpValue}, Vol: ${(a.volatility * 100).toFixed(0)}%`
      if (a.age) line += `, Age: ${a.age}`
      if (a.adp) line += `, ADP: #${a.adp.rank} (${a.adp.position}), Val: ${a.adp.value ?? 'N/A'}`
      if (a.injuryStatus) line += ` | INJURY: ${a.injuryStatus.status}${a.injuryStatus.type ? ` (${a.injuryStatus.type})` : ''}`
      if (a.isCornerstone) line += ` | CORNERSTONE: ${a.cornerstoneReason}`
      if (a.analytics) {
        const parts: string[] = []
        if (a.analytics.athleticGrade != null) parts.push(`Athletic: ${a.analytics.athleticGrade.toFixed(1)}`)
        if (a.analytics.collegeProductionGrade != null) parts.push(`CollegeProd: ${a.analytics.collegeProductionGrade.toFixed(1)}`)
        if (a.analytics.breakoutAge != null) parts.push(`BreakoutAge: ${a.analytics.breakoutAge}`)
        if (parts.length) line += ` | Analytics: ${parts.join(', ')}`
      }
      lines.push(line)
    }

    if (side.manager) {
      const m = side.manager
      lines.push(`  Manager: ${m.managerName} | Tier: ${m.contenderTier} | Roster: ${m.rosterSize} | Picks: ${m.pickCount} | Young: ${m.youngAssetCount}`)
      lines.push(`  Needs: ${m.needs.join(', ') || 'None'} | Surplus: ${m.surplus.join(', ') || 'None'}`)
      if (m.tendencies) {
        lines.push(`  Tendencies: StarterPrem=${m.tendencies.starterPremium.toFixed(2)}, Risk=${m.tendencies.riskTolerance.toFixed(2)}, Consol=${m.tendencies.consolidationBias.toFixed(2)}, Overpay=${m.tendencies.overpayThreshold.toFixed(2)}`)
        const bias = m.tendencies.positionBias
        lines.push(`  PosBias: QB=${bias.QB.toFixed(2)} RB=${bias.RB.toFixed(2)} WR=${bias.WR.toFixed(2)} TE=${bias.TE.toFixed(2)} PICK=${bias.PICK.toFixed(2)}`)
      }
    }
    lines.push('')
  }

  lines.push(`--- VALUE DELTA ---`)
  lines.push(`Absolute: ${ctx.valueDelta.absoluteDiff} | Percentage: ${ctx.valueDelta.percentageDiff}% | Favored: Side ${ctx.valueDelta.favoredSide}`)
  lines.push('')

  if (ctx.leagueTradeHistory.totalTrades > 0) {
    lines.push(`--- LEAGUE TRADE HISTORY ---`)
    lines.push(`Total: ${ctx.leagueTradeHistory.totalTrades} | Last 30 days: ${ctx.leagueTradeHistory.recentTrades}`)
    lines.push('')
  }

  lines.push(`=== END FACT LAYER ===`)

  return lines.join('\n')
}
