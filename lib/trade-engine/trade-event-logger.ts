import { prisma } from '../prisma'
import { createHash } from 'crypto'

export const CURRENT_MODEL_VERSION = 'v2.1.0'

export type TradeOfferMode = 'INSTANT' | 'STRUCTURED' | 'TRADE_IDEAS' | 'PROPOSAL_GENERATOR'

export interface SegmentParts {
  isSuperflex: boolean
  isTEPremium: boolean
  leagueSize: number | null
  opponentTradeSampleSize: number | null
}

export interface TradeOfferEventInput {
  leagueId?: string | null
  season?: number | null
  week?: number | null
  senderUserId?: string | null
  opponentUserId?: string | null
  assetsGiven: Array<{ name: string; value?: number; type?: string }>
  assetsReceived: Array<{ name: string; value?: number; type?: string }>
  features?: {
    lineupImpact?: number
    vorp?: number
    market?: number
    behavior?: number
    demand?: number
    weights?: number[]
    capsApplied?: string[]
  } | null
  segmentParts?: SegmentParts | null
  acceptProb?: number | null
  rawAcceptProb?: number | null
  isotonicApplied?: boolean | null
  verdict?: string | null
  grade?: string | null
  confidenceScore?: number | null
  driverSet?: Array<{ id: string; evidence?: string }> | null
  mode: TradeOfferMode
  isSuperFlex?: boolean | null
  leagueFormat?: string | null
  scoringType?: string | null
}

function computeInputHash(input: TradeOfferEventInput): string {
  const payload = JSON.stringify({
    g: input.assetsGiven.map(a => a.name).sort(),
    r: input.assetsReceived.map(a => a.name).sort(),
    m: input.mode,
    l: input.leagueId,
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

export async function logTradeOfferEvent(input: TradeOfferEventInput): Promise<string | null> {
  try {
    const featuresJson: Record<string, any> = { ...(input.features ?? {}) }
    if (input.segmentParts) {
      featuresJson.segmentParts = input.segmentParts
    }
    if (input.isotonicApplied != null) {
      featuresJson.isotonicApplied = input.isotonicApplied
      if (input.rawAcceptProb != null) {
        featuresJson.rawAcceptProb = input.rawAcceptProb
      }
    }

    const driversJson = input.driverSet ?? []
    const confidenceDriversJson = input.confidenceScore != null
      ? [{ score: input.confidenceScore }]
      : []

    const inputHash = computeInputHash(input)

    const event = await prisma.tradeOfferEvent.create({
      data: {
        leagueId: input.leagueId ?? null,
        season: input.season ?? null,
        week: input.week ?? null,
        senderUserId: input.senderUserId ?? null,
        opponentUserId: input.opponentUserId ?? null,
        assetsGiven: input.assetsGiven,
        assetsReceived: input.assetsReceived,
        featuresJson,
        driversJson,
        confidenceDriversJson,
        inputHash,
        acceptProb: input.acceptProb ?? 0,
        verdict: input.verdict ?? 'UNKNOWN',
        lean: input.verdict ?? 'NEUTRAL',
        grade: input.grade ?? null,
        confidenceScore: input.confidenceScore ?? null,
        mode: input.mode,
        isSuperFlex: input.isSuperFlex ?? null,
        leagueFormat: input.leagueFormat ?? null,
        scoringType: input.scoringType ?? null,
        modelVersion: CURRENT_MODEL_VERSION,
      },
    })
    return event.id
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return null
    }
    console.error('[TradeEventLogger] Failed to log trade offer event:', err)
    return null
  }
}

export type TradeOutcomeStatus = 'accepted' | 'rejected' | 'expired' | 'countered' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COUNTERED'

export interface TradeOutcomeEventInput {
  offerEventId?: string | null
  leagueId?: string | null
  week?: number | null
  season?: number | null
  outcome: TradeOutcomeStatus
  timeToDecisionMinutes?: number | null
  finalTradeId?: string | null
}

export async function logTradeOutcomeEvent(input: TradeOutcomeEventInput): Promise<string | null> {
  try {
    const event = await prisma.tradeOutcomeEvent.create({
      data: {
        offerEventId: input.offerEventId ?? null,
        leagueId: input.leagueId ?? null,
        week: input.week ?? null,
        season: input.season ?? null,
        outcome: input.outcome.toUpperCase() as 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'COUNTERED',
        timeToDecisionMin: input.timeToDecisionMinutes ?? null,
        leagueTradeId: input.finalTradeId ?? null,
      },
    })
    return event.id
  } catch (err) {
    console.error('[TradeEventLogger] Failed to log trade outcome event:', err)
    return null
  }
}

export async function logAcceptedTradesAsOutcomes(
  season: number = 2025,
): Promise<number> {
  try {
    const trades = await prisma.leagueTrade.findMany({
      where: {
        analyzed: true,
        season,
        valueGiven: { not: null },
        valueReceived: { not: null },
      },
      select: {
        id: true,
        historyId: true,
        week: true,
        season: true,
        tradeDate: true,
        createdAt: true,
      },
    })

    const existingOutcomes = await prisma.tradeOutcomeEvent.findMany({
      where: {
        leagueTradeId: { in: trades.map(t => t.id) },
      },
      select: { leagueTradeId: true },
    })
    const existingIds = new Set(existingOutcomes.map((o: { leagueTradeId: string | null }) => o.leagueTradeId))

    const newTrades = trades.filter(t => !existingIds.has(t.id))
    if (newTrades.length === 0) return 0

    const history = await prisma.leagueTradeHistory.findMany({
      where: {
        id: { in: [...new Set(newTrades.map(t => t.historyId))] },
      },
      select: { id: true, sleeperLeagueId: true },
    })
    const historyMap = new Map(history.map(h => [h.id, h]))

    let logged = 0
    for (const trade of newTrades) {
      const h = historyMap.get(trade.historyId)
      await logTradeOutcomeEvent({
        leagueId: h?.sleeperLeagueId ?? null,
        week: trade.week,
        season: trade.season,
        outcome: 'accepted',
        finalTradeId: trade.id,
      })
      logged++
    }

    if (logged > 0) {
      console.log(`[TradeEventLogger] Logged ${logged} accepted trade outcomes from imported LeagueTrade records`)
    }

    return logged
  } catch (err) {
    console.error('[TradeEventLogger] Failed to backfill trade outcomes:', err)
    return 0
  }
}
