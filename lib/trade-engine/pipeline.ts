// lib/trade-engine/pipeline.ts
// Unified pipeline that wires all Phase 2 modules together

import { TradeCandidate, LeagueIntelligence, Asset, ManagerProfile } from './types'
import { computeVetoLikelihood, VetoAnalysis } from './vetoLikelihood'
import { evaluateCommissionerAlerts, buildAlertContext, CommissionerAlert } from './commissionerAlerts'
import { buildManagerReputation, getArchetypeTraits, ManagerReputation, ReputationInput } from './crossLeagueReputation'
import { adjustIdpValue, computeLeagueIdpScarcity } from './idpTuning'
import { withCache, getCacheKey, invalidateLeagueCache } from './caching'

export type EnrichedTradeCandidate = TradeCandidate & {
  vetoAnalysis: VetoAnalysis
  commissionerAlerts: CommissionerAlert[]
  targetReputation?: ManagerReputation
  targetTraits?: ReturnType<typeof getArchetypeTraits>
}

export type PipelineConfig = {
  leagueVetoRate?: number
  enableCommissionerAlerts?: boolean
  enableReputationLookup?: boolean
  reputationLookup?: (userId: string) => Promise<ReputationInput | null>
}

export async function enrichTradesWithPipeline(
  trades: TradeCandidate[],
  intelligence: LeagueIntelligence,
  config: PipelineConfig = {}
): Promise<EnrichedTradeCandidate[]> {
  const enriched: EnrichedTradeCandidate[] = []

  for (const trade of trades) {
    const fromProfile = intelligence.managerProfiles[trade.fromRosterId]
    const toProfile = intelligence.managerProfiles[trade.toRosterId]

    const vetoAnalysis = computeVetoLikelihood({
      fairnessScore: trade.fairnessScore,
      valueRatio: trade.valueRatio,
      championReceivesCornerstone:
        (toProfile?.isChampion ?? false) && trade.receive.some(a => a.isCornerstone),
      leagueVetoRate: config.leagueVetoRate,
    })

    let commissionerAlerts: CommissionerAlert[] = []
    if (config.enableCommissionerAlerts !== false && fromProfile && toProfile) {
      const alertCtx = buildAlertContext(
        trade.offerId ?? '',
        trade.fairnessScore,
        trade.give,
        trade.receive,
        fromProfile,
        toProfile,
        toProfile.starterStrengthIndex || 0,
        (toProfile.starterStrengthIndex || 0) + sumValue(trade.receive)
      )
      commissionerAlerts = evaluateCommissionerAlerts(alertCtx)
    }

    let targetReputation: ManagerReputation | undefined
    let targetTraits: ReturnType<typeof getArchetypeTraits> | undefined

    if (config.enableReputationLookup && config.reputationLookup && toProfile) {
      const repInput = await config.reputationLookup(toProfile.userId)
      if (repInput) {
        targetReputation = buildManagerReputation(repInput)
        targetTraits = getArchetypeTraits(targetReputation.archetype)
      }
    }

    enriched.push({
      ...trade,
      vetoAnalysis,
      commissionerAlerts,
      targetReputation,
      targetTraits,
    })
  }

  return enriched
}

function sumValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + (a.value || 0), 0)
}

export function applyIdpAdjustments(
  assets: Asset[],
  rosterPositions: string[],
  numTeams: number,
  idpEnabled: boolean
): Asset[] {
  if (!idpEnabled) return assets

  const scarcityList = computeLeagueIdpScarcity(rosterPositions, numTeams)

  return assets.map(asset => {
    if (!asset.isIdp || asset.type !== 'PLAYER') return asset

    const scarcity = scarcityList.find(s => s.position === asset.pos)
    if (!scarcity) return asset

    const adjustedValue = adjustIdpValue(asset.value, asset.pos ?? 'IDP', scarcity.scarcityIndex)
    return { ...asset, value: adjustedValue }
  })
}

export async function getLeagueIntelligenceWithCache<T>(
  leagueId: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 15 * 60 * 1000
): Promise<T> {
  const key = getCacheKey('intel', leagueId)
  return withCache(key, ttlMs, fetcher)
}

export function invalidateOnTradeAccepted(leagueId: string): void {
  invalidateLeagueCache(leagueId)
}

export function invalidateOnWaiverProcessed(leagueId: string): void {
  invalidateLeagueCache(leagueId)
}

// ============================================
// SNAPSHOT BUILDER (FOR ROUTE INTEGRATION)
// ============================================

import { LeagueContext, ManagerRoster, LeagueSettings } from './types'
import { buildLeagueIntel, SleeperRosterInput } from './league-intelligence'
import { cacheGet, cacheSet } from './caching'

export async function buildLeagueIntelSnapshot(params: {
  league: LeagueContext
  userRoster: ManagerRoster
  rosters: ManagerRoster[]
  fantasyCalcValueMap: Record<string, { value: number; overallRank?: number; trend30Day?: number }>
  tradeBlockEntries?: Array<{ rosterId: number; assetId: string }>
  prisma?: any
}) {
  const key = `league:${params.league.leagueId || params.league.leagueName}:intel:v2`
  const cached = cacheGet<any>(key)
  if (cached) return cached

  const settings: LeagueSettings = {
    ...params.league,
    startingQB: 1,
    startingRB: 2,
    startingWR: 2,
    startingTE: 1,
    startingFlex: 2,
    ppr: params.league.scoringType === 'PPR' ? 1 : params.league.scoringType === 'Half PPR' ? 0.5 : 0,
  }

  const sleeperRosters: SleeperRosterInput[] = params.rosters.map(r => ({
    rosterId: r.rosterId,
    ownerId: r.userId,
    ownerUsername: r.username,
    ownerName: r.displayName,
    avatar: r.avatar,
    players: r.players.map(p => ({
      id: p.id,
      name: p.name,
      pos: p.pos,
      team: p.team,
      age: p.age,
      slot: p.slot,
    })),
    picks: [],
    faabRemaining: r.faab,
    wins: typeof r.record === 'string' ? parseInt(r.record.split('-')[0] || '0', 10) : 0,
    losses: typeof r.record === 'string' ? parseInt(r.record.split('-')[1] || '0', 10) : 0,
    pointsFor: r.pointsFor,
  }))

  const snapshot = await buildLeagueIntel({
    rosters: sleeperRosters,
    fantasyCalcValues: params.fantasyCalcValueMap,
    settings,
    tradeBlockEntries: params.tradeBlockEntries?.map(e => ({ ...e, source: 'legacy' as const })),
  })

  const result = {
    league: params.league,
    ...snapshot,
    idpConfig: {
      enabled: settings.idpEnabled || false,
      startersRequired: settings.idpStarterSlots || 0,
      poolEstimate: 250,
      scoringWeight: 0.35,
    },
    pickFutures: { enabled: true, daysToDraft: 120 },
  }

  cacheSet(key, result, 10 * 60 * 1000)
  return result
}
