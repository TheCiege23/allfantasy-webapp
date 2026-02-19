import { z } from 'zod'

export const TRADE_DECISION_CONTEXT_VERSION = '1.0.0' as const

const LeagueConfigSchema = z.object({
  leagueId: z.string().nullable(),
  name: z.string(),
  platform: z.string().nullable(),
  scoringType: z.string(),
  numTeams: z.number().int().min(2),
  isSF: z.boolean(),
  isTEP: z.boolean(),
  tepBonus: z.number(),
  rosterPositions: z.array(z.string()),
  starterSlots: z.number().int(),
  benchSlots: z.number().int(),
  taxiSlots: z.number().int(),
  scoringSettings: z.record(z.string(), z.number()),
}).strict()

const ValuationSourceSchema = z.object({
  source: z.string(),
  valuedAt: z.string(),
}).strict()

const AssetValuationSchema = z.object({
  name: z.string(),
  type: z.enum(['PLAYER', 'PICK', 'FAAB']),
  position: z.string(),
  age: z.number().nullable(),
  team: z.string().nullable(),
  marketValue: z.number(),
  impactValue: z.number(),
  vorpValue: z.number(),
  volatility: z.number(),
  valuationSource: ValuationSourceSchema,
  adp: z.object({
    rank: z.number(),
    positionalRank: z.string().nullable(),
    value: z.number().nullable(),
    fetchedAt: z.string(),
  }).strict().nullable(),
  isCornerstone: z.boolean(),
  cornerstoneReason: z.string(),
}).strict()

const PlayerRiskMarkerSchema = z.object({
  playerName: z.string(),
  ageBucket: z.enum(['prime', 'ascending', 'declining', 'cliff', 'unknown']),
  currentAge: z.number().nullable(),
  injuryStatus: z.object({
    status: z.string(),
    type: z.string().nullable(),
    description: z.string().nullable(),
    reportDate: z.string().nullable(),
    recencyDays: z.number().nullable(),
    missedGames: z.number().nullable(),
    reinjuryRisk: z.enum(['low', 'moderate', 'high', 'unknown']),
  }).strict().nullable(),
  analytics: z.object({
    athleticGrade: z.number().nullable(),
    collegeProductionGrade: z.number().nullable(),
    weeklyVolatility: z.number().nullable(),
    breakoutAge: z.number().nullable(),
    comparablePlayers: z.string().nullable(),
  }).strict().nullable(),
}).strict()

const ManagerPreferenceVectorSchema = z.object({
  sampleSize: z.number().int(),
  starterPremium: z.number(),
  positionBias: z.object({
    QB: z.number(),
    RB: z.number(),
    WR: z.number(),
    TE: z.number(),
    PICK: z.number(),
  }).strict(),
  riskTolerance: z.number(),
  consolidationBias: z.number(),
  overpayThreshold: z.number(),
  fairnessTolerance: z.number(),
  computedAt: z.string(),
}).strict()

const TeamSnapshotSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  assets: z.array(AssetValuationSchema),
  totalValue: z.number(),
  riskMarkers: z.array(PlayerRiskMarkerSchema),
  rosterComposition: z.object({
    size: z.number().int(),
    pickCount: z.number().int(),
    youngAssetCount: z.number().int(),
    starterStrengthIndex: z.number(),
  }).strict(),
  needs: z.array(z.string()),
  surplus: z.array(z.string()),
  contenderTier: z.enum(['champion', 'contender', 'middle', 'rebuild']),
  managerPreferences: ManagerPreferenceVectorSchema.nullable(),
}).strict()

const CompetitorSnapshotSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  contenderTier: z.enum(['champion', 'contender', 'middle', 'rebuild']),
  starterStrengthIndex: z.number(),
  needs: z.array(z.string()),
  surplus: z.array(z.string()),
}).strict()

const TradeHistoryStatsSchema = z.object({
  totalTrades: z.number().int(),
  recentTrades: z.number().int(),
  recencyWindowDays: z.number().int(),
  avgValueDelta: z.number(),
  leagueTradeFrequency: z.enum(['low', 'medium', 'high']).nullable(),
  computedAt: z.string(),
}).strict()

const MissingDataFlagsSchema = z.object({
  valuationsMissing: z.array(z.string()),
  adpMissing: z.array(z.string()),
  analyticsMissing: z.array(z.string()),
  injuryDataStale: z.boolean(),
  valuationDataStale: z.boolean(),
  adpDataStale: z.boolean(),
  analyticsDataStale: z.boolean(),
  tradeHistoryStale: z.boolean(),
  managerTendenciesUnavailable: z.array(z.string()),
  competitorDataUnavailable: z.boolean(),
  tradeHistoryInsufficient: z.boolean(),
}).strict()

const DataQualitySchema = z.object({
  assetsCovered: z.number().int(),
  assetsTotal: z.number().int(),
  coveragePercent: z.number(),
  adpHitRate: z.number(),
  injuryDataAvailable: z.boolean(),
  analyticsAvailable: z.boolean(),
  warnings: z.array(z.string()),
}).strict()

export const TradeDecisionContextV1Schema = z.object({
  version: z.literal(TRADE_DECISION_CONTEXT_VERSION),
  assembledAt: z.string(),
  contextId: z.string(),

  leagueConfig: LeagueConfigSchema,

  sideA: TeamSnapshotSchema,
  sideB: TeamSnapshotSchema,

  competitors: z.array(CompetitorSnapshotSchema),

  valueDelta: z.object({
    absoluteDiff: z.number(),
    percentageDiff: z.number(),
    favoredSide: z.enum(['A', 'B', 'Even']),
  }).strict(),

  tradeHistoryStats: TradeHistoryStatsSchema,

  missingData: MissingDataFlagsSchema,
  dataQuality: DataQualitySchema,

  dataSources: z.object({
    valuationFetchedAt: z.string(),
    adpFetchedAt: z.string().nullable(),
    injuryFetchedAt: z.string().nullable(),
    analyticsFetchedAt: z.string().nullable(),
    rostersFetchedAt: z.string().nullable(),
    tradeHistoryFetchedAt: z.string().nullable(),
  }).strict(),
}).strict()

export type TradeDecisionContextV1 = z.infer<typeof TradeDecisionContextV1Schema>

export type LeagueConfig = z.infer<typeof LeagueConfigSchema>
export type AssetValuation = z.infer<typeof AssetValuationSchema>
export type PlayerRiskMarker = z.infer<typeof PlayerRiskMarkerSchema>
export type ManagerPreferenceVector = z.infer<typeof ManagerPreferenceVectorSchema>
export type TeamSnapshot = z.infer<typeof TeamSnapshotSchema>
export type CompetitorSnapshot = z.infer<typeof CompetitorSnapshotSchema>
export type TradeHistoryStats = z.infer<typeof TradeHistoryStatsSchema>
export type MissingDataFlags = z.infer<typeof MissingDataFlagsSchema>
export type DataQuality = z.infer<typeof DataQualitySchema>

export function classifyAgeBucket(age: number | null, position: string): PlayerRiskMarker['ageBucket'] {
  if (age == null) return 'unknown'

  const thresholds: Record<string, { ascending: number; prime: number; declining: number }> = {
    QB: { ascending: 25, prime: 32, declining: 37 },
    RB: { ascending: 23, prime: 27, declining: 30 },
    WR: { ascending: 24, prime: 30, declining: 33 },
    TE: { ascending: 24, prime: 30, declining: 33 },
  }

  const t = thresholds[position] || thresholds.WR
  if (age < t.ascending) return 'ascending'
  if (age <= t.prime) return 'prime'
  if (age <= t.declining) return 'declining'
  return 'cliff'
}
