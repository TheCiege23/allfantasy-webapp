import {
  Asset,
  NegotiationToolkit,
} from './types'
import {
  computeTradeDrivers,
  type TradeDriverData,
} from './trade-engine'
import {
  buildInstantNegotiationToolkit,
  buildNegotiationToolkit,
  type NegotiationBuilderInput,
} from './negotiation-builder'
import {
  buildGptInputContract,
  type GptInputContract,
} from './gpt-input-contract'
import {
  buildNegotiationGptContract,
  type NegotiationGptContract,
} from './negotiation-gpt-contract'
import {
  getCalibratedWeights,
  calibrateAcceptProbability,
  type CalibratedWeights,
  type SegmentContext,
} from './accept-calibration'
import type { ManagerProfile, ManagerTendencyData } from './types'

export type GoalIntent = 'win_now' | 'rebuild' | 'consolidate' | 'depth' | 'picks' | 'balanced'

export type CoreEngineMode = 'instant' | 'structured' | 'proposal'

export interface CoreEngineInput {
  mode: CoreEngineMode

  give: Asset[]
  receive: Asset[]

  leagueSettings: {
    isSuperFlex: boolean
    isTEP: boolean
    numTeams?: number
    scoringType?: string
    leagueFormat?: string
  }

  rosters?: {
    yourRoster: Asset[]
    theirRoster: Asset[]
    rosterPositions: string[]
  }

  managers?: {
    from: ManagerProfile | null
    to: ManagerProfile | null
    fromTendency?: ManagerTendencyData | null
    toTendency?: ManagerTendencyData | null
    allTendencies?: Record<number, ManagerTendencyData> | null
  }

  goalIntent?: GoalIntent

  context?: {
    isDeadlineWindow?: boolean
    availableBenchAssets?: Asset[]
    availablePicks?: Asset[]
    userFaabRemaining?: number
  }
}

export interface ValuationReport {
  giveTotal: number
  receiveTotal: number
  marketDeltaPct: number
  giveBreakdown: Array<{ name: string; value: number; type: string }>
  receiveBreakdown: Array<{ name: string; value: number; type: string }>
}

export interface LineupImpactReport {
  hasLineupData: boolean
  deltaYou: number
  deltaThem: number
  beforeYou: number
  afterYou: number
  beforeThem: number
  afterThem: number
  slotDeltas?: Record<string, number>
  needFitPPG?: number
}

export interface AcceptModel {
  acceptProbability: number
  rawAcceptProbability?: number
  isotonicApplied?: boolean
  drivers: TradeDriverData['acceptDrivers']
  confidenceDrivers: TradeDriverData['confidenceDrivers']
  confidenceScore: number
  confidenceRating: string
  caps: {
    maxProbability: number
    minProbability: number
  }
}

export interface TradeLabels {
  verdict: string
  lean: string
  labels: string[]
  riskFlags: string[]
  dominantDriver: string
}

export interface CoreEngineOutput {
  mode: CoreEngineMode

  valuationReport: ValuationReport
  lineupImpact: LineupImpactReport
  acceptModel: AcceptModel
  tradeLabels: TradeLabels

  negotiationBlock: NegotiationToolkit | null

  explainers: {
    driverNarrative: string
    acceptBullets: string[]
    sensitivitySentence: string
  }

  scores: {
    lineupImpactScore: number
    vorpScore: number
    marketScore: number
    behaviorScore: number
    totalScore: number
    fairnessDelta: number
    fairnessScore: number
    scoringMode: string
  }

  gptContracts: {
    narrative: GptInputContract
    negotiation: NegotiationGptContract
  }

  raw: TradeDriverData

  calibration: {
    b0: number
    segmentUsed: string | null
  }
}

function buildValuationReport(give: Asset[], receive: Asset[]): ValuationReport {
  const giveTotal = give.reduce((s, a) => s + (a.marketValue ?? a.value ?? 0), 0)
  const receiveTotal = receive.reduce((s, a) => s + (a.marketValue ?? a.value ?? 0), 0)
  const maxVal = Math.max(giveTotal, receiveTotal, 1)
  const marketDeltaPct = Math.round(((receiveTotal - giveTotal) / maxVal) * 100)

  return {
    giveTotal,
    receiveTotal,
    marketDeltaPct,
    giveBreakdown: give.map(a => ({
      name: a.name ?? a.displayName ?? a.id,
      value: a.marketValue ?? a.value ?? 0,
      type: a.type,
    })),
    receiveBreakdown: receive.map(a => ({
      name: a.name ?? a.displayName ?? a.id,
      value: a.marketValue ?? a.value ?? 0,
      type: a.type,
    })),
  }
}

function buildLineupImpact(drivers: TradeDriverData): LineupImpactReport {
  if (!drivers.lineupDelta || !drivers.lineupDelta.hasLineupData) {
    return {
      hasLineupData: false,
      deltaYou: 0,
      deltaThem: 0,
      beforeYou: 0,
      afterYou: 0,
      beforeThem: 0,
      afterThem: 0,
    }
  }

  const ld = drivers.lineupDelta
  return {
    hasLineupData: true,
    deltaYou: ld.deltaYou,
    deltaThem: ld.deltaThem,
    beforeYou: ld.beforeYou,
    afterYou: ld.afterYou,
    beforeThem: ld.beforeThem,
    afterThem: ld.afterThem,
  }
}

async function buildAcceptModel(drivers: TradeDriverData): Promise<AcceptModel> {
  const { calibrated, isotonicApplied } = await calibrateAcceptProbability(drivers.acceptProbability)

  return {
    acceptProbability: calibrated,
    rawAcceptProbability: isotonicApplied ? drivers.acceptProbability : undefined,
    isotonicApplied,
    drivers: drivers.acceptDrivers,
    confidenceDrivers: drivers.confidenceDrivers,
    confidenceScore: drivers.confidenceScore,
    confidenceRating: drivers.confidenceRating,
    caps: {
      maxProbability: 0.95,
      minProbability: 0.02,
    },
  }
}

function buildTradeLabels(drivers: TradeDriverData): TradeLabels {
  return {
    verdict: drivers.verdict,
    lean: drivers.lean,
    labels: drivers.labels,
    riskFlags: drivers.riskFlags,
    dominantDriver: drivers.dominantDriver,
  }
}

function buildExplainers(drivers: TradeDriverData) {
  return {
    driverNarrative: drivers.driverNarrative,
    acceptBullets: drivers.acceptBullets,
    sensitivitySentence: drivers.sensitivitySentence,
  }
}

function buildScores(drivers: TradeDriverData) {
  return {
    lineupImpactScore: drivers.lineupImpactScore,
    vorpScore: drivers.vorpScore,
    marketScore: drivers.marketScore,
    behaviorScore: drivers.behaviorScore,
    totalScore: drivers.totalScore,
    fairnessDelta: drivers.fairnessDelta,
    fairnessScore: drivers.fairnessScore,
    scoringMode: drivers.scoringMode,
  }
}

export async function runCoreEngine(input: CoreEngineInput): Promise<CoreEngineOutput> {
  const segment: SegmentContext = {
    isSuperFlex: input.leagueSettings.isSuperFlex,
    scoringType: input.leagueSettings.scoringType,
  }

  const calWeights = await getCalibratedWeights(undefined, segment)

  const rosterCtx = input.rosters ? {
    yourRoster: input.rosters.yourRoster,
    theirRoster: input.rosters.theirRoster,
    rosterPositions: input.rosters.rosterPositions,
  } : undefined

  const drivers = computeTradeDrivers(
    input.give,
    input.receive,
    input.managers?.from ?? null,
    input.managers?.to ?? null,
    input.leagueSettings.isSuperFlex,
    input.leagueSettings.isTEP,
    rosterCtx,
    input.managers?.fromTendency ?? null,
    input.managers?.toTendency ?? null,
    input.context?.isDeadlineWindow ?? false,
    input.managers?.allTendencies ?? null,
    calWeights,
  )

  let negotiation: NegotiationToolkit | null = null

  if (input.mode === 'instant') {
    negotiation = buildInstantNegotiationToolkit(drivers, input.give, input.receive)
  } else if (input.mode === 'structured' || input.mode === 'proposal') {
    if (input.context?.availableBenchAssets || input.context?.availablePicks) {
      const negInput: NegotiationBuilderInput = {
        drivers,
        give: input.give,
        receive: input.receive,
        availableBenchAssets: input.context?.availableBenchAssets ?? [],
        availablePicks: input.context?.availablePicks ?? [],
        userFaabRemaining: input.context?.userFaabRemaining ?? 0,
      }
      negotiation = buildNegotiationToolkit(negInput)
    } else {
      negotiation = buildInstantNegotiationToolkit(drivers, input.give, input.receive)
    }
  }

  const narrativeContract = buildGptInputContract(
    input.mode === 'instant' ? 'INSTANT' : 'TRADE_EVALUATOR',
    drivers,
  )

  const negotiationContract = buildNegotiationGptContract(drivers)

  return {
    mode: input.mode,
    valuationReport: buildValuationReport(input.give, input.receive),
    lineupImpact: buildLineupImpact(drivers),
    acceptModel: await buildAcceptModel(drivers),
    tradeLabels: buildTradeLabels(drivers),
    negotiationBlock: negotiation,
    explainers: buildExplainers(drivers),
    scores: buildScores(drivers),
    gptContracts: {
      narrative: narrativeContract,
      negotiation: negotiationContract,
    },
    raw: drivers,
    calibration: {
      b0: calWeights.b0,
      segmentUsed: calWeights.segmentUsed ?? null,
    },
  }
}
