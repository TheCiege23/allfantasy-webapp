import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  STRUCTURED_TRADE_EVAL_SYSTEM_PROMPT,
  StructuredTradeEvalResponseSchema,
  NEGOTIATION_USER_INSTRUCTION,
} from '@/lib/trade-evaluator-prompt'
import {
  buildFaabSteps,
  buildScarcityNotes,
  clampNegotiationToAllowed,
} from '@/lib/trade-finder/negotiation-helpers'
import { openaiChatJson, parseJsonContentFromChatCompletion } from '@/lib/openai-client'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { buildHistoricalTradeContext, getDataInfo, calculateTradeConfidence, computeDualModeGrades } from '@/lib/historical-values'
import { pricePlayer, pricePick, compositeScore, compositeTotal, ValuationContext, type PricedAsset } from '@/lib/hybrid-valuation'
import { computeLineupDelta, computeLineupFairness, computeValueFairness, type LineupPlayer, type RosterSlots, type LineupDelta } from '@/lib/lineup-optimizer'
import { parseSleeperRosterPositions } from '@/lib/trade-engine/sleeper-converter'
import { computeTradeDrivers } from '@/lib/trade-engine/trade-engine'
import { buildNegotiationToolkit, negotiationToolkitToLegacy } from '@/lib/trade-engine/negotiation-builder'
import { buildNegotiationGptContract, buildNegotiationGptUserPrompt, validateNegotiationGptOutput, shouldSkipNegotiationGpt, NEGOTIATION_GPT_SYSTEM_PROMPT } from '@/lib/trade-engine/negotiation-gpt-contract'
import { buildGptInputContract, buildGptUserPrompt, validateGptNarrativeOutput, shouldSkipGpt, AI_OUTPUT_INVALID_FALLBACK, GPT_NARRATIVE_SYSTEM_PROMPT } from '@/lib/trade-engine/gpt-input-contract'
import type { Asset } from '@/lib/trade-engine/types'
import { getCalibratedWeights } from '@/lib/trade-engine/accept-calibration'
import { parsePickLabel } from '@/lib/parsePickLabel'
import { logTradeOfferEvent } from '@/lib/trade-engine/trade-event-logger'
import { logNarrativeValidation } from '@/lib/trade-engine/narrative-validation-logger'
import { detectTradeLabels, getPositiveLabels, getWarningLabels, TradeAsset, TradeLabel } from '@/lib/trade-labels'
import { evaluateVeto, VetoResult } from '@/lib/trade-veto'
import { buildLeagueDecisionContext, summarizeLeagueDecisionContext, LeagueDecisionContext } from '@/lib/league-decision-context'
import { getLeagueInfo, getLeagueRosters, getTradedDraftPicks } from '@/lib/sleeper-client'

const PlayerInputSchema = z.object({
  name: z.string(),
  position: z.string().optional(),
  team: z.string().optional(),
  age: z.number().optional(),
  value_notes: z.string().optional(),
})

const PickInputSchema = z.object({
  year: z.number(),
  round: z.number(),
  projected_range: z.enum(['early', 'mid', 'late', 'unknown']).optional(),
})

const TeamInputSchema = z.object({
  team_id: z.string().optional(),
  manager_name: z.string(),
  is_af_pro: z.boolean().optional().default(false),
  record_or_rank: z.string().optional(),
  roster: z.array(z.any()).optional(),
  picks_owned: z.array(PickInputSchema).optional(),
  faab_remaining: z.number().optional(),
  gives_players: z.array(z.union([z.string(), PlayerInputSchema])),
  gives_picks: z.array(z.union([z.string(), PickInputSchema])).optional().default([]),
  gives_faab: z.number().optional().default(0),
})

const LeagueContextSchema = z.object({
  format: z.enum(['redraft', 'dynasty', 'keeper']).optional(),
  sport: z.string().optional(),
  scoring_summary: z.string().optional(),
  qb_format: z.enum(['1qb', 'sf']).optional().default('sf'),
  idp_enabled: z.boolean().optional().default(false),
  roster_requirements: z.string().optional(),
  waiver_type: z.string().optional(),
  trade_deadline: z.string().optional(),
  playoff_weeks: z.string().optional(),
  standings_summary: z.string().optional(),
  contender_notes: z.string().optional(),
  scarcity_notes: z.string().optional(),
  market_notes: z.string().optional(),
})

const SleeperUserSchema = z.object({
  username: z.string().min(1),
  userId: z.string().min(1),
}).optional()

const TradeRequestSchema = z.object({
  trade_id: z.string().optional(),
  league_id: z.string().optional(),
  sleeperUser: SleeperUserSchema,
  sender: TeamInputSchema,
  receiver: TeamInputSchema,
  league: LeagueContextSchema.optional(),
  asOfDate: z.string().optional().nullable(),
})

const valueToTier = (value: number): string => {
  if (value >= 9000) return 'Tier0_Untouchable'
  if (value >= 7500) return 'Tier1_Cornerstone'
  if (value >= 5500) return 'Tier2_HighEnd'
  if (value >= 3500) return 'Tier3_Starter'
  if (value >= 1500) return 'Tier4_Depth'
  return 'Tier5_Filler'
}

function resolvePlayerName(p: string | { name: string }): string {
  return typeof p === 'string' ? p : p.name
}

function resolvePickData(p: string | { year: number; round: number; projected_range?: string }) {
  if (typeof p === 'string') {
    const parsed = parsePickLabel(p)
    return {
      year: parsed?.year ?? 2025,
      round: parsed?.round ?? 1,
      tier: parsed?.bucket as 'early' | 'mid' | 'late' | undefined,
      label: p,
    }
  }
  return {
    year: p.year,
    round: p.round,
    tier: (p.projected_range === 'unknown' ? undefined : p.projected_range) as 'early' | 'mid' | 'late' | undefined,
    label: `${p.year} Round ${p.round}${p.projected_range ? ` (${p.projected_range})` : ''}`,
  }
}

export const POST = withApiUsage({ endpoint: "/api/trade-evaluator", tool: "TradeEvaluator" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const data = TradeRequestSchema.parse(body)

    const ip = getClientIp(request)

    const sId = (data.sender.team_id || data.sender.manager_name || '').trim().toLowerCase()
    const rId = (data.receiver.team_id || data.receiver.manager_name || '').trim().toLowerCase()
    const evalPair = [sId, rId].sort()
    const leaguePart = data.league_id ? `:${data.league_id.trim()}` : ''
    const evalKey = `trade_eval${leaguePart}:${evalPair[0]}:${evalPair[1]}`

    const rl = consumeRateLimit({
      scope: 'ai',
      action: 'trade_eval',
      sleeperUsername: evalKey,
      ip,
      maxRequests: 12,
      windowMs: 60_000,
      includeIpInKey: true,
    })

    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', retryAfterSec: rl.retryAfterSec, remaining: rl.remaining },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      )
    }

    const isSF = data.league?.qb_format === 'sf'
    const biasMode = data.sender.is_af_pro && data.receiver.is_af_pro ? 'neutral' : 'protect_receiver'

    const senderPlayerNames = data.sender.gives_players.map(resolvePlayerName)
    const receiverPlayerNames = data.receiver.gives_players.map(resolvePlayerName)
    const senderPicksData = (data.sender.gives_picks as any[]).map(resolvePickData)
    const receiverPicksData = (data.receiver.gives_picks as any[]).map(resolvePickData)

    let rosterConfigForVorp: import('@/lib/vorp-engine').LeagueRosterConfig | undefined
    if (data.league_id) {
      try {
        const sleeperLeagueForConfig = await getLeagueInfo(data.league_id)
        if (sleeperLeagueForConfig?.roster_positions) {
          const parsed = parseSleeperRosterPositions(sleeperLeagueForConfig.roster_positions)
          rosterConfigForVorp = {
            numTeams: sleeperLeagueForConfig.total_rosters || 12,
            startingQB: parsed.startingQB,
            startingRB: parsed.startingRB,
            startingWR: parsed.startingWR,
            startingTE: parsed.startingTE,
            startingFlex: parsed.startingFlex,
            superflex: parsed.superflex,
          }
        }
      } catch { /* use defaults */ }
    }

    const labelCtx: ValuationContext = {
      asOfDate: data.asOfDate || new Date().toISOString().split('T')[0],
      isSuperFlex: isSF,
      numTeams: 12,
      rosterConfig: rosterConfigForVorp,
    }

    const [senderPlayerPrices, receiverPlayerPrices, senderPickPrices, receiverPickPrices] = await Promise.all([
      Promise.all(senderPlayerNames.map(name => pricePlayer(name, labelCtx))),
      Promise.all(receiverPlayerNames.map(name => pricePlayer(name, labelCtx))),
      Promise.all(senderPicksData.map(p => pricePick({ year: p.year, round: p.round, tier: p.tier || null }, labelCtx))),
      Promise.all(receiverPicksData.map(p => pricePick({ year: p.year, round: p.round, tier: p.tier || null }, labelCtx))),
    ])

    const senderGivenAssetsList = [...senderPlayerPrices, ...senderPickPrices]
    const senderReceivedAssetsList = [...receiverPlayerPrices, ...receiverPickPrices]

    const senderGivenComposite = compositeTotal(senderGivenAssetsList) + (data.sender.gives_faab ?? 0)
    const senderReceivedComposite = compositeTotal(senderReceivedAssetsList) + (data.receiver.gives_faab ?? 0)

    const senderGivenMarket = senderGivenAssetsList.reduce((s, p) => s + p.assetValue.marketValue, 0)
      + (data.sender.gives_faab ?? 0)
    const senderReceivedMarket = senderReceivedAssetsList.reduce((s, p) => s + p.assetValue.marketValue, 0)
      + (data.receiver.gives_faab ?? 0)

    const senderGivenTotal = senderGivenComposite
    const senderReceivedTotal = senderReceivedComposite

    const teamANetValue = senderReceivedComposite - senderGivenComposite
    const teamBNetValue = senderGivenComposite - senderReceivedComposite

    const buildAssetDetail = (
      name: string,
      priced: { value: number; source: string; assetValue: { marketValue: number; impactValue: number; vorpValue: number; volatility: number } },
      position?: string,
      age?: number
    ) => ({
      name,
      value: compositeScore(priced.assetValue),
      marketValue: priced.assetValue.marketValue,
      assetValue: priced.assetValue,
      tier: valueToTier(priced.assetValue.marketValue),
      source: priced.source,
      ...(position && { position }),
      ...(age && { age }),
    })

    const teamAGives = [
      ...senderPlayerNames.map((name, i) => {
        const p = data.sender.gives_players[i]
        const pos = typeof p === 'object' ? p.position : undefined
        const age = typeof p === 'object' ? p.age : undefined
        return buildAssetDetail(name, senderPlayerPrices[i], pos, age)
      }),
      ...senderPicksData.map((p, i) => ({
        name: p.label,
        value: senderPickPrices[i].value,
        tier: valueToTier(senderPickPrices[i].value),
        source: senderPickPrices[i].source,
        isPick: true,
      })),
    ]

    const teamAReceives = [
      ...receiverPlayerNames.map((name, i) => {
        const p = data.receiver.gives_players[i]
        const pos = typeof p === 'object' ? p.position : undefined
        const age = typeof p === 'object' ? p.age : undefined
        return buildAssetDetail(name, receiverPlayerPrices[i], pos, age)
      }),
      ...receiverPicksData.map((p, i) => ({
        name: p.label,
        value: receiverPickPrices[i].value,
        tier: valueToTier(receiverPickPrices[i].value),
        source: receiverPickPrices[i].source,
        isPick: true,
      })),
    ]

    const senderPlayerAssets: TradeAsset[] = senderPlayerNames.map((name, i) => {
      const p = data.sender.gives_players[i]
      return {
        name,
        isPick: false,
        value: compositeScore(senderPlayerPrices[i].assetValue),
        assetValue: senderPlayerPrices[i].assetValue,
        tier: valueToTier(senderPlayerPrices[i].assetValue.marketValue) as any,
        ...(typeof p === 'object' && p.position && { position: p.position }),
        ...(typeof p === 'object' && p.age && { age: p.age }),
      }
    })

    const receiverPlayerAssets: TradeAsset[] = receiverPlayerNames.map((name, i) => {
      const p = data.receiver.gives_players[i]
      return {
        name,
        isPick: false,
        value: compositeScore(receiverPlayerPrices[i].assetValue),
        assetValue: receiverPlayerPrices[i].assetValue,
        tier: valueToTier(receiverPlayerPrices[i].assetValue.marketValue) as any,
        ...(typeof p === 'object' && p.position && { position: p.position }),
        ...(typeof p === 'object' && p.age && { age: p.age }),
      }
    })

    const senderPickAssets: TradeAsset[] = senderPicksData.map((p, i) => ({
      name: p.label,
      isPick: true,
      pickRound: p.round,
      pickYear: p.year,
      value: compositeScore(senderPickPrices[i].assetValue),
      assetValue: senderPickPrices[i].assetValue,
    }))

    const receiverPickAssets: TradeAsset[] = receiverPicksData.map((p, i) => ({
      name: p.label,
      isPick: true,
      pickRound: p.round,
      pickYear: p.year,
      value: compositeScore(receiverPickPrices[i].assetValue),
      assetValue: receiverPickPrices[i].assetValue,
    }))

    const senderGivenAssets = [...senderPlayerAssets, ...senderPickAssets]
    const receiverGivenAssets = [...receiverPlayerAssets, ...receiverPickAssets]

    let fairnessScore: number
    let lineupDeltas: { sender: LineupDelta; receiver: LineupDelta } | null = null
    let fairnessMethod: 'lineup' | 'composite' = 'composite'

    const senderRoster = data.sender.roster || []
    const receiverRoster = data.receiver.roster || []
    const hasFullRosters = senderRoster.length >= 5 && receiverRoster.length >= 5

    if (hasFullRosters) {
      try {
        const rosterSlots: RosterSlots = rosterConfigForVorp
          ? {
              startingQB: rosterConfigForVorp.startingQB,
              startingRB: rosterConfigForVorp.startingRB,
              startingWR: rosterConfigForVorp.startingWR,
              startingTE: rosterConfigForVorp.startingTE,
              startingFlex: rosterConfigForVorp.startingFlex,
              superflex: rosterConfigForVorp.superflex,
            }
          : {
              startingQB: 1,
              startingRB: 2,
              startingWR: 2,
              startingTE: 1,
              startingFlex: isSF ? 3 : 2,
              superflex: isSF,
            }

        const senderRosterNames: string[] = senderRoster.map((r: any) =>
          typeof r === 'string' ? r : r.name || r.id || String(r)
        )
        const receiverRosterNames: string[] = receiverRoster.map((r: any) =>
          typeof r === 'string' ? r : r.name || r.id || String(r)
        )

        const [senderRosterPriced, receiverRosterPriced] = await Promise.all([
          Promise.all(senderRosterNames.map(name => pricePlayer(name, labelCtx))),
          Promise.all(receiverRosterNames.map(name => pricePlayer(name, labelCtx))),
        ])

        function pricedToLineup(names: string[], priced: PricedAsset[]): LineupPlayer[] {
          return names.map((name, i) => ({
            name: priced[i].name || name,
            position: priced[i].position || 'WR',
            impactValue: priced[i].assetValue.impactValue,
            vorpValue: priced[i].assetValue.vorpValue,
          }))
        }

        const senderLineupPlayers = pricedToLineup(senderRosterNames, senderRosterPriced)
        const receiverLineupPlayers = pricedToLineup(receiverRosterNames, receiverRosterPriced)

        const senderReceivesAsLineup: LineupPlayer[] = receiverPlayerNames.map((name, i) => {
          const p = data.receiver.gives_players[i]
          const pos = typeof p === 'object' ? p.position : receiverPlayerPrices[i].position
          return {
            name,
            position: pos || 'WR',
            impactValue: receiverPlayerPrices[i].assetValue.impactValue,
            vorpValue: receiverPlayerPrices[i].assetValue.vorpValue,
          }
        })
        const receiverReceivesAsLineup: LineupPlayer[] = senderPlayerNames.map((name, i) => {
          const p = data.sender.gives_players[i]
          const pos = typeof p === 'object' ? p.position : senderPlayerPrices[i].position
          return {
            name,
            position: pos || 'WR',
            impactValue: senderPlayerPrices[i].assetValue.impactValue,
            vorpValue: senderPlayerPrices[i].assetValue.vorpValue,
          }
        })

        const deltaSender = computeLineupDelta(
          senderLineupPlayers,
          senderPlayerNames,
          senderReceivesAsLineup,
          rosterSlots
        )
        const deltaReceiver = computeLineupDelta(
          receiverLineupPlayers,
          receiverPlayerNames,
          receiverReceivesAsLineup,
          rosterSlots
        )

        lineupDeltas = { sender: deltaSender, receiver: deltaReceiver }
        fairnessScore = computeLineupFairness(deltaSender, deltaReceiver)
        fairnessMethod = 'lineup'
      } catch (lineupErr) {
        console.warn('[TradeEval] Lineup optimization failed, falling back to composite:', (lineupErr as Error)?.message)
        fairnessScore = computeValueFairness(senderReceivedComposite, senderGivenComposite)
      }
    } else {
      fairnessScore = computeValueFairness(senderReceivedComposite, senderGivenComposite)
    }

    const tradeLabels = detectTradeLabels({
      givenAssets: senderGivenAssets,
      receivedAssets: receiverGivenAssets,
      fairnessScore,
      givenValue: senderGivenTotal,
      receivedValue: senderReceivedTotal,
    })

    const hasTierJump = tradeLabels.some(l => l.id === 'tier_jump_win')

    const vetoResult = evaluateVeto({
      givenAssets: senderGivenAssets,
      receivedAssets: receiverGivenAssets,
      fairnessScore,
      leagueType: isSF ? 'SF' : '1QB',
      hasTierJump,
    })

    let confidenceInfo: { confidence: number; confidenceLabel: string; explanation: string } | null = null
    let dualModeGrades: Awaited<ReturnType<typeof computeDualModeGrades>> | null = null
    let historicalData: any = null
    const dataInfo = getDataInfo()

    if (data.asOfDate && dataInfo.loaded) {
      const historicalContext = buildHistoricalTradeContext(
        {
          date: data.asOfDate,
          sideAPlayers: senderPlayerNames,
          sideBPlayers: receiverPlayerNames,
          sideAPicks: senderPicksData,
          sideBPicks: receiverPicksData,
        },
        isSF
      )

      const playerResults = [
        ...senderPlayerPrices.map((priced, i) => ({ name: senderPlayerNames[i], found: priced.source !== 'unknown' })),
        ...receiverPlayerPrices.map((priced, i) => ({ name: receiverPlayerNames[i], found: priced.source !== 'unknown' })),
      ]
      const pickResults = [
        ...senderPickPrices.map(priced => ({ wasAveraged: priced.source === 'curve' })),
        ...receiverPickPrices.map(priced => ({ wasAveraged: priced.source === 'curve' })),
      ]

      const confidence = calculateTradeConfidence(playerResults, pickResults, 'exact')
      confidenceInfo = {
        confidence: confidence.confidence,
        confidenceLabel: confidence.confidenceLabel,
        explanation: confidence.explanation,
      }

      historicalData = {
        hindsightVerdict: historicalContext.hindsightVerdict,
        sideA: historicalContext.sideAContext,
        sideB: historicalContext.sideBContext,
      }

      dualModeGrades = await computeDualModeGrades(
        {
          date: data.asOfDate,
          sideAPlayers: senderPlayerNames,
          sideBPlayers: receiverPlayerNames,
          sideAPicks: senderPicksData,
          sideBPicks: receiverPicksData,
        },
        isSF
      )
    }

    let leagueDecisionCtx: LeagueDecisionContext | null = null
    try {
      if (data.league_id) {
        const [sleeperLeague, sleeperRosters, sleeperTradedPicks] = await Promise.all([
          getLeagueInfo(data.league_id),
          getLeagueRosters(data.league_id),
          getTradedDraftPicks(data.league_id),
        ])
        if (sleeperLeague && sleeperRosters.length > 0) {
          const senderRosterId = data.sender.team_id ? parseInt(data.sender.team_id) : undefined
          leagueDecisionCtx = await buildLeagueDecisionContext({
            league: sleeperLeague,
            rosters: sleeperRosters,
            tradedPicks: sleeperTradedPicks as any,
            userRosterId: senderRosterId,
            isSuperFlex: isSF,
          })
        }
      }
    } catch (ldcErr) {
      console.warn('[TradeEval] League decision context build failed (non-blocking):', (ldcErr as Error)?.message)
    }

    const tierImpactA = teamAGives.map(a => `${a.name}: ${a.tier}`).join(', ')
    const tierImpactB = teamAReceives.map(a => `${a.name}: ${a.tier}`).join(', ')

    const positiveLabels = getPositiveLabels(tradeLabels).map(l => l.id)
    const warningLabelIds = getWarningLabels(tradeLabels).map(l => l.id)

    const structuredPayload: Record<string, any> = {
      trade: {
        teamA: {
          id: data.sender.team_id || data.sender.manager_name,
          managerName: data.sender.manager_name,
          gives: teamAGives,
          receives: teamAReceives,
          faabGiven: data.sender.gives_faab ?? 0,
          faabReceived: data.receiver.gives_faab ?? 0,
        },
        teamB: {
          id: data.receiver.team_id || data.receiver.manager_name,
          managerName: data.receiver.manager_name,
          gives: teamAReceives,
          receives: teamAGives,
          faabGiven: data.receiver.gives_faab ?? 0,
          faabReceived: data.sender.gives_faab ?? 0,
        },
      },
      valuationReport: {
        teamA: {
          totalGiven: senderGivenComposite,
          totalReceived: senderReceivedComposite,
          netValue: teamANetValue,
          fairnessScore,
          fairnessMethod,
          marketGiven: senderGivenMarket,
          marketReceived: senderReceivedMarket,
          tierImpact: tierImpactA,
          labels: positiveLabels,
          warnings: warningLabelIds,
          ...(lineupDeltas && { lineupDelta: lineupDeltas.sender }),
        },
        teamB: {
          totalGiven: senderReceivedComposite,
          totalReceived: senderGivenComposite,
          netValue: teamBNetValue,
          fairnessScore: 100 - fairnessScore,
          fairnessMethod,
          marketGiven: senderReceivedMarket,
          marketReceived: senderGivenMarket,
          tierImpact: tierImpactB,
          labels: [],
          warnings: [],
          ...(lineupDeltas && { lineupDelta: lineupDeltas.receiver }),
        },
      },
      vetoStatus: {
        vetoed: vetoResult.veto,
        vetoReason: vetoResult.vetoReason,
        warning: vetoResult.warning,
        warningText: vetoResult.warningText,
      },
      leagueSettings: {
        format: data.league?.format || 'dynasty',
        sport: data.league?.sport || 'nfl',
        qbFormat: data.league?.qb_format || 'sf',
        idpEnabled: data.league?.idp_enabled || false,
        biasMode,
        ...(data.league?.scoring_summary && { scoringSummary: data.league.scoring_summary }),
        ...(data.league?.roster_requirements && { rosterRequirements: data.league.roster_requirements }),
      },
      analysisMode: {
        timeContext: data.asOfDate ? 'AS_OF_DATE' : 'CURRENT',
        ...(data.asOfDate && { asOfDate: data.asOfDate }),
      },
    }

    if (leagueDecisionCtx) {
      structuredPayload.leagueDecisionContext = {
        summary: summarizeLeagueDecisionContext(leagueDecisionCtx),
        snapshotCompleteness: leagueDecisionCtx.metadata.snapshotCompleteness,
        market: leagueDecisionCtx.market,
        partnerFit: leagueDecisionCtx.partnerFit,
        senderTeam: data.sender.team_id ? leagueDecisionCtx.teams[data.sender.team_id] : undefined,
        receiverTeam: data.receiver.team_id ? leagueDecisionCtx.teams[data.receiver.team_id] : undefined,
      }
    }

    const confidenceInputs: Record<string, number> = { base: 50 }
    if (leagueDecisionCtx?.metadata.snapshotCompleteness === 'FULL') confidenceInputs.snapshotFull = 20
    if (leagueDecisionCtx?.metadata.snapshotCompleteness === 'PARTIAL') confidenceInputs.snapshotPartial = -10
    if (Math.abs(fairnessScore - 50) > 10) confidenceInputs.clearValueDelta = 20
    if (Math.abs(fairnessScore - 50) < 5) confidenceInputs.thinDelta = -10
    if (leagueDecisionCtx && data.sender.team_id && data.receiver.team_id) {
      const sTeam = leagueDecisionCtx.teams[data.sender.team_id]
      const rTeam = leagueDecisionCtx.teams[data.receiver.team_id]
      if (sTeam && rTeam && sTeam.competitiveWindow !== rTeam.competitiveWindow) {
        confidenceInputs.windowAlignment = 15
      }
    }
    if (!data.sender.roster?.length) confidenceInputs.missingRosterInfo = -20

    const computedConfidenceScore = Math.max(0, Math.min(100,
      Object.values(confidenceInputs).reduce((s, v) => s + v, 0)
    ))

    const giveDriverAssets: Asset[] = [
      ...senderPlayerNames.map((name, i) => {
        const p = data.sender.gives_players[i]
        const pos = typeof p === 'object' ? p.position : undefined
        const age = typeof p === 'object' ? p.age : undefined
        return {
          id: name,
          type: 'PLAYER' as const,
          value: compositeScore(senderPlayerPrices[i].assetValue),
          marketValue: senderPlayerPrices[i].assetValue.marketValue,
          impactValue: senderPlayerPrices[i].assetValue.impactValue,
          vorpValue: senderPlayerPrices[i].assetValue.vorpValue,
          volatility: senderPlayerPrices[i].assetValue.volatility,
          name,
          pos,
          age,
        }
      }),
      ...senderPicksData.map((p, i) => ({
        id: p.label,
        type: 'PICK' as const,
        value: compositeScore(senderPickPrices[i].assetValue),
        marketValue: senderPickPrices[i].assetValue.marketValue,
        impactValue: senderPickPrices[i].assetValue.impactValue,
        vorpValue: senderPickPrices[i].assetValue.vorpValue,
        volatility: senderPickPrices[i].assetValue.volatility,
        name: p.label,
        round: p.round as 1 | 2 | 3 | 4,
      })),
    ]
    const receiveDriverAssets: Asset[] = [
      ...receiverPlayerNames.map((name, i) => {
        const p = data.receiver.gives_players[i]
        const pos = typeof p === 'object' ? p.position : undefined
        const age = typeof p === 'object' ? p.age : undefined
        return {
          id: name,
          type: 'PLAYER' as const,
          value: compositeScore(receiverPlayerPrices[i].assetValue),
          marketValue: receiverPlayerPrices[i].assetValue.marketValue,
          impactValue: receiverPlayerPrices[i].assetValue.impactValue,
          vorpValue: receiverPlayerPrices[i].assetValue.vorpValue,
          volatility: receiverPlayerPrices[i].assetValue.volatility,
          name,
          pos,
          age,
        }
      }),
      ...receiverPicksData.map((p, i) => ({
        id: p.label,
        type: 'PICK' as const,
        value: compositeScore(receiverPickPrices[i].assetValue),
        marketValue: receiverPickPrices[i].assetValue.marketValue,
        impactValue: receiverPickPrices[i].assetValue.impactValue,
        vorpValue: receiverPickPrices[i].assetValue.vorpValue,
        volatility: receiverPickPrices[i].assetValue.volatility,
        name: p.label,
        round: p.round as 1 | 2 | 3 | 4,
      })),
    ]

    const calWeights = await getCalibratedWeights()
    const isTEP = data.league?.scoring_summary?.toLowerCase().includes('te premium') || false

    let tradeDriverData: ReturnType<typeof computeTradeDrivers> | null = null
    try {
      tradeDriverData = computeTradeDrivers(
        giveDriverAssets, receiveDriverAssets, null, null,
        isSF, isTEP, undefined, undefined, undefined, undefined, undefined, calWeights,
      )
    } catch (e) {
      console.warn('[trade-evaluator] computeTradeDrivers failed, continuing without accept probability:', e)
    }

    const acceptDrivers = tradeDriverData?.acceptDrivers ?? []
    const confidenceDrivers = tradeDriverData?.confidenceDrivers ?? []

    if (tradeDriverData) {
      confidenceInputs.acceptProbModel = Math.round(tradeDriverData.acceptProbability * 100)
    }

    structuredPayload.confidenceInputs = {
      factors: confidenceInputs,
      computedScore: computedConfidenceScore,
    }

    if (historicalData) {
      structuredPayload.historicalContext = historicalData
    }

    const senderTeamId = data.sender.team_id || data.sender.manager_name
    const receiverTeamId = data.receiver.team_id || data.receiver.manager_name

    const senderTeamCtx = leagueDecisionCtx?.teams[data.sender.team_id || '']
    const receiverTeamCtx = leagueDecisionCtx?.teams[data.receiver.team_id || '']

    const youSendAssets = [
      ...senderPlayerNames.map((name, i) => ({
        id: name,
        label: name,
        kind: 'PLAYER' as const,
        tier: valueToTier(senderPlayerPrices[i].assetValue.marketValue),
        value: compositeScore(senderPlayerPrices[i].assetValue),
        assetValue: senderPlayerPrices[i].assetValue,
      })),
      ...senderPicksData.map((p, i) => ({
        id: p.label,
        label: p.label,
        kind: 'PICK' as const,
        tier: valueToTier(senderPickPrices[i].assetValue.marketValue),
        value: compositeScore(senderPickPrices[i].assetValue),
        assetValue: senderPickPrices[i].assetValue,
      })),
    ]

    const youReceiveAssets = [
      ...receiverPlayerNames.map((name, i) => ({
        id: name,
        label: name,
        kind: 'PLAYER' as const,
        tier: valueToTier(receiverPlayerPrices[i].assetValue.marketValue),
        value: compositeScore(receiverPlayerPrices[i].assetValue),
        assetValue: receiverPlayerPrices[i].assetValue,
      })),
      ...receiverPicksData.map((p, i) => ({
        id: p.label,
        label: p.label,
        kind: 'PICK' as const,
        tier: valueToTier(receiverPickPrices[i].assetValue.marketValue),
        value: compositeScore(receiverPickPrices[i].assetValue),
        assetValue: receiverPickPrices[i].assetValue,
      })),
    ]

    const userRoster = data.sender.roster || []
    const userRosterAllowed = userRoster.map((r: any) => ({
      id: typeof r === 'string' ? r : r.name || r.id || String(r),
      label: typeof r === 'string' ? r : r.name || r.id || String(r),
      kind: 'PLAYER' as const,
    }))
    const userPicksAllowed = (data.sender.picks_owned || []).map((p: any) => ({
      id: `${p.year} Round ${p.round}`,
      label: `${p.year} Round ${p.round}${p.projected_range ? ` (${p.projected_range})` : ''}`,
    }))
    const partnerPicksAllowed = (data.receiver.picks_owned || []).map((p: any) => ({
      id: `${p.year} Round ${p.round}`,
      label: `${p.year} Round ${p.round}${p.projected_range ? ` (${p.projected_range})` : ''}`,
    }))

    const fairnessBandPct = 15
    const latePicks = userPicksAllowed.filter((p: { id: string }) =>
      p.id.includes('Round 3') || p.id.includes('Round 4')
    ).map((p: { id: string }) => p.id)

    const negotiationInput: Record<string, unknown> = {
      negotiationRequest: {
        enabled: true,
        fairnessBandPct,
        maxDmMessages: 5,
        maxCounters: 4,
        maxSweeteners: 3,
        userObjective: senderTeamCtx?.competitiveWindow === 'WIN_NOW'
          ? 'WIN_NOW'
          : senderTeamCtx?.competitiveWindow === 'REBUILD'
            ? 'REBUILD'
            : 'BALANCED',
      },
      candidateTrade: {
        tradeId: data.trade_id || `eval_${Date.now()}`,
        teamAId: senderTeamId,
        teamBId: receiverTeamId,
        youSend: youSendAssets,
        youReceive: youReceiveAssets,
        partnerWindow: receiverTeamCtx?.competitiveWindow || 'MIDDLE',
        reasonCodes: [...positiveLabels, ...warningLabelIds],
      },
      allowedAssets: {
        userAssetsAllowed: [
          ...youSendAssets.map(a => ({ id: a.id, label: a.label, kind: a.kind })),
          ...userRosterAllowed,
        ],
        partnerAssetsAllowed: youReceiveAssets.map(a => ({ id: a.id, label: a.label, kind: a.kind })),
        userPicksAllowed,
        partnerPicksAllowed,
        userFaabRemaining: data.sender.faab_remaining,
        partnerFaabRemaining: data.receiver.faab_remaining,
      },
      fairnessConstraints: {
        currentFairnessScore: fairnessScore,
        bandMinPct: -fairnessBandPct,
        bandMaxPct: fairnessBandPct,
        suggestedFaabSteps: buildFaabSteps(data.sender.faab_remaining),
        suggestedPickSweeteners: latePicks.length > 0 ? latePicks : undefined,
      },
    }

    if (senderTeamCtx && receiverTeamCtx) {
      negotiationInput.leagueNegotiationContext = {
        userNeeds: senderTeamCtx.needs,
        partnerNeeds: receiverTeamCtx.needs,
        userSurpluses: senderTeamCtx.surpluses,
        partnerSurpluses: receiverTeamCtx.surpluses,
        scarcityNotes: buildScarcityNotes(leagueDecisionCtx?.market?.scarcityByPosition as Record<string, number> | undefined),
      }
    }

    structuredPayload.negotiationInput = negotiationInput

    const gptContract = tradeDriverData
      ? buildGptInputContract('TRADE_EVALUATOR', tradeDriverData)
      : null

    const skipGpt = gptContract ? shouldSkipGpt(gptContract) : 'INCOMPLETE_DRIVER_SET'

    let parsed: Record<string, any> | null = null
    let narrativeValid = false

    if (skipGpt !== 'ok') {
      console.warn(`[trade-evaluator] Skipping GPT: ${skipGpt}`)
    } else {
      const gptPayload: Record<string, any> = {
        trade: structuredPayload.trade,
        vetoStatus: structuredPayload.vetoStatus,
        leagueSettings: structuredPayload.leagueSettings,
        analysisMode: structuredPayload.analysisMode,
        negotiationInput,
        ...(structuredPayload.leagueDecisionContext && {
          leagueDecisionContext: structuredPayload.leagueDecisionContext,
        }),
        ...(structuredPayload.confidenceInputs && {
          confidenceInputs: structuredPayload.confidenceInputs,
        }),
        ...(structuredPayload.historicalContext && {
          historicalContext: structuredPayload.historicalContext,
        }),
      }

      const systemPrompt = STRUCTURED_TRADE_EVAL_SYSTEM_PROMPT + '\n\n' + GPT_NARRATIVE_SYSTEM_PROMPT
      const narrativePrompt = gptContract ? buildGptUserPrompt(gptContract) : ''
      const userPayloadStr = narrativePrompt + '\n\n' + JSON.stringify(gptPayload) + '\n\n' + NEGOTIATION_USER_INSTRUCTION

      const result = await openaiChatJson({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayloadStr },
        ],
        temperature: 0.2,
        maxTokens: 6000,
      })

      if (!result.ok) {
        console.error('Trade evaluator OpenAI error:', {
          status: result.status,
          details: result.details.slice(0, 500),
        })
        return NextResponse.json({ error: 'Failed to evaluate trade', details: result.details.slice(0, 500) }, { status: 500 })
      }

      parsed = parseJsonContentFromChatCompletion(result.json)

      if (parsed && gptContract) {
        const driverIds = gptContract.drivers.map(d => d.id)
        const confDriverIds = gptContract.confidenceDrivers.map(d => d.id)
        const narrativeProxy = {
          bullets: [
            parsed.explanation?.summary ? { text: parsed.explanation.summary, driverId: driverIds[0] || '' } : null,
            parsed.explanation?.teamAReasoning ? { text: parsed.explanation.teamAReasoning, driverId: driverIds[1] || driverIds[0] || '' } : null,
            parsed.explanation?.teamBReasoning ? { text: parsed.explanation.teamBReasoning, driverId: driverIds[2] || driverIds[0] || '' } : null,
          ].filter(Boolean),
          sensitivity: {
            text: parsed.explanation?.leagueContextNotes?.[0] || '',
            driverId: confDriverIds[0] || '',
          },
        }
        const validation = validateGptNarrativeOutput(narrativeProxy, gptContract)
        logNarrativeValidation({ mode: 'STRUCTURED', contractType: 'narrative', valid: validation.valid, violations: validation.violations }).catch(() => {})
        if (validation.violations.length > 0) {
          console.warn('[trade-evaluator] GPT narrative violations:', validation.violations)
        }
        narrativeValid = validation.valid
        if (!narrativeValid) {
          console.warn('[trade-evaluator] GPT narrative rejected — fail-closed')
        }
      }
    }

    if (!parsed) {
      parsed = {
        verdict: { overall: 'FAIR', teamA: 'NEUTRAL', teamB: 'NEUTRAL' },
        explanation: {
          summary: AI_OUTPUT_INVALID_FALLBACK.fallback,
          teamAReasoning: AI_OUTPUT_INVALID_FALLBACK.fallback,
          teamBReasoning: AI_OUTPUT_INVALID_FALLBACK.fallback,
          leagueContextNotes: [],
        },
        confidence: {
          rating: tradeDriverData?.confidenceRating ?? 'LEARNING',
          score: computedConfidenceScore,
          drivers: [],
        },
        betterAlternatives: [],
        riskFlags: tradeDriverData?.riskFlags ?? [],
        _aiOutputInvalid: true,
      }
    }

    const structuredValidation = StructuredTradeEvalResponseSchema.safeParse(parsed)

    const tradeInsights = {
      fairnessScore,
      fairnessMethod,
      ...(lineupDeltas && { lineupDeltas }),
      netDeltaPct: senderGivenComposite > 0 ? Math.round(((senderReceivedComposite - senderGivenComposite) / senderGivenComposite) * 100) : 0,
      labels: getPositiveLabels(tradeLabels).map(l => ({ id: l.id, name: l.name, emoji: l.emoji, description: l.description })),
      warnings: getWarningLabels(tradeLabels).map(l => ({ id: l.id, name: l.name, emoji: l.emoji, description: l.description })),
      veto: vetoResult.veto,
      vetoReason: vetoResult.vetoReason,
      expertWarning: vetoResult.warning ? vetoResult.warningText : null,
    }

    const acceptProbData = tradeDriverData ? {
      probability: tradeDriverData.acceptProbability,
      percentDisplay: `${Math.round(tradeDriverData.acceptProbability * 100)}%`,
      drivers: acceptDrivers,
      scores: {
        lineupImpact: Math.round(tradeDriverData.lineupImpactScore * 100) / 100,
        vorp: Math.round(tradeDriverData.vorpScore * 100) / 100,
        market: Math.round(tradeDriverData.marketScore * 100) / 100,
        behavior: Math.round(tradeDriverData.behaviorScore * 100) / 100,
      },
      verdict: tradeDriverData.verdict,
      lean: tradeDriverData.lean,
      fairnessDelta: tradeDriverData.fairnessDelta,
      confidenceDrivers,
      acceptBullets: tradeDriverData.acceptBullets,
      sensitivitySentence: tradeDriverData.sensitivitySentence,
    } : null

    if (!structuredValidation.success) {
      console.error('Structured AI response validation failed:', structuredValidation.error.errors)
      return NextResponse.json({
        success: true,
        evaluation: parsed,
        schemaValid: false,
        warning: 'Response partially validated — AI output did not match strict schema',
        rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
        ...(confidenceInfo && { historicalAnalysis: confidenceInfo }),
        ...(dualModeGrades && { dualModeGrades }),
        tradeInsights,
        valuationReport: structuredPayload.valuationReport,
        serverConfidence: { score: computedConfidenceScore, factors: confidenceInputs },
        acceptProbability: acceptProbData,
      })
    }

    const evalData = structuredValidation.data

    let negotiationToolkit: import('@/lib/trade-engine/types').NegotiationToolkit | null = null
    if (tradeDriverData) {
      const benchAssets: Asset[] = (data.sender.roster || [])
        .filter((r: any) => {
          const name = typeof r === 'string' ? r : r.name || r.id || String(r)
          return !giveDriverAssets.some(g => g.id === name)
        })
        .map((r: any) => {
          const name = typeof r === 'string' ? r : r.name || r.id || String(r)
          const pos = typeof r === 'object' ? r.position : undefined
          const age = typeof r === 'object' ? r.age : undefined
          return { id: name, type: 'PLAYER' as const, value: 0, name, pos, age } as Asset
        })

      const pickInputs = (data.sender.picks_owned || [])
        .filter((p: any) => !giveDriverAssets.some(g => g.id === `${p.year} Round ${p.round}`))
        .map((p: any) => ({
          id: `${p.year} Round ${p.round}`,
          displayName: `${p.year} Round ${p.round}${p.projected_range ? ` (${p.projected_range})` : ''}`,
          round: p.round as number,
          season: p.year as number,
          value: p.round === 1 ? 5000 : p.round === 2 ? 2500 : p.round === 3 ? 1000 : 500,
        }))

      negotiationToolkit = buildNegotiationToolkit({
        drivers: tradeDriverData,
        give: giveDriverAssets,
        receive: receiveDriverAssets,
        availableBenchAssets: benchAssets,
        availablePicks: pickInputs,
        userFaabRemaining: data.sender.faab_remaining,
        partnerNeeds: senderTeamCtx ? receiverTeamCtx?.needs : undefined,
        userNeeds: senderTeamCtx?.needs,
      })

      const negContract = buildNegotiationGptContract(tradeDriverData)
      const negSkipCheck = shouldSkipNegotiationGpt(negContract)

      if (negSkipCheck === 'ok') {
        try {
          const negResult = await openaiChatJson({
            messages: [
              { role: 'system', content: NEGOTIATION_GPT_SYSTEM_PROMPT },
              { role: 'user', content: buildNegotiationGptUserPrompt(negContract) },
            ],
            temperature: 0.3,
            maxTokens: 500,
          })

          if (negResult.ok) {
            const negParsed = parseJsonContentFromChatCompletion(negResult.json)
            if (negParsed) {
              const negValidation = validateNegotiationGptOutput(negParsed, negContract)
              logNarrativeValidation({ mode: 'STRUCTURED', contractType: 'negotiation', valid: negValidation.valid, violations: negValidation.violations }).catch(() => {})
              if (negValidation.violations.length > 0) {
                console.warn('[trade-evaluator] Negotiation GPT violations:', negValidation.violations)
              }
              if (negValidation.valid && negValidation.cleaned) {
                if (negValidation.cleaned.opener || negValidation.cleaned.rationale || negValidation.cleaned.fallback) {
                  negotiationToolkit.dmMessages = {
                    opener: negValidation.cleaned.opener || negotiationToolkit.dmMessages.opener,
                    rationale: negValidation.cleaned.rationale || negotiationToolkit.dmMessages.rationale,
                    fallback: negValidation.cleaned.fallback || negotiationToolkit.dmMessages.fallback,
                  }
                }

                if (negValidation.cleaned.counters.length > 0) {
                  for (const gc of negValidation.cleaned.counters) {
                    const matchingCounter = negotiationToolkit.counters.find(c =>
                      c.expected.driverChanges.some(dc => gc.driverIds.includes(dc.driverId))
                    )
                    if (matchingCounter) {
                      matchingCounter.description = gc.description.replace(/\s*\([a-z_]+\)\s*$/, '')
                    }
                  }
                }
              } else {
                console.warn('[trade-evaluator] Negotiation GPT rejected — fail-closed')
              }
            }
          }
        } catch (negErr) {
          console.warn('[trade-evaluator] Negotiation GPT failed, using deterministic fallback')
        }
      } else {
        console.warn(`[trade-evaluator] Skipping negotiation GPT: ${negSkipCheck}`)
      }

      evalData.negotiation = negotiationToolkitToLegacy(negotiationToolkit) as any
    } else if (evalData.negotiation) {
      const userAllowedIds = new Set<string>([
        ...youSendAssets.map(a => a.id),
        ...userRosterAllowed.map((a: { id: string }) => a.id),
        ...userPicksAllowed.map((p: { id: string }) => p.id),
      ])
      const partnerAllowedIds = new Set<string>([
        ...youReceiveAssets.map(a => a.id),
        ...partnerPicksAllowed.map((p: { id: string }) => p.id),
      ])
      const safeNegotiation = clampNegotiationToAllowed({
        negotiation: evalData.negotiation,
        allowed: {
          userAllowedIds,
          partnerAllowedIds,
          userFaabRemaining: data.sender.faab_remaining,
        },
      })
      evalData.negotiation = safeNegotiation ?? { dmMessages: [], counters: [], sweeteners: [], redLines: [] }
    }

    const gptConfidence = evalData.confidence.score
    const scoreDrift = Math.abs(gptConfidence - computedConfidenceScore)
    if (scoreDrift > 25) {
      console.warn(`[TradeEval] Confidence drift: GPT=${gptConfidence}, Server=${computedConfidenceScore}, drift=${scoreDrift}`)
      evalData.confidence.score = computedConfidenceScore
      evalData.confidence.drivers.push(`[server_override: GPT scored ${gptConfidence}, adjusted to ${computedConfidenceScore} based on data completeness]`)
      if (computedConfidenceScore >= 70) evalData.confidence.rating = 'HIGH'
      else if (computedConfidenceScore >= 40) evalData.confidence.rating = 'MEDIUM'
      else evalData.confidence.rating = 'LEARNING'
    }

    logTradeOfferEvent({
      leagueId: data.league_id ?? null,
      senderUserId: data.sleeperUser?.userId ?? data.sender.team_id ?? null,
      opponentUserId: data.receiver.team_id ?? null,
      assetsGiven: senderGivenAssetsList.map(a => ({ name: a.name, value: compositeScore(a.assetValue), type: a.source })),
      assetsReceived: senderReceivedAssetsList.map(a => ({ name: a.name, value: compositeScore(a.assetValue), type: a.source })),
      features: tradeDriverData ? {
        lineupImpact: tradeDriverData.lineupImpactScore,
        vorp: tradeDriverData.vorpScore,
        market: tradeDriverData.marketScore,
        behavior: tradeDriverData.behaviorScore,
        weights: [0.40, 0.25, 0.20, 0.15],
      } : null,
      segmentParts: {
        isSuperflex: isSF,
        isTEPremium: isTEP,
        leagueSize: null,
        opponentTradeSampleSize: null,
      },
      acceptProb: tradeDriverData?.acceptProbability ?? null,
      verdict: tradeDriverData?.verdict ?? null,
      confidenceScore: computedConfidenceScore,
      driverSet: tradeDriverData?.acceptDrivers.map(d => ({ id: d.id, evidence: typeof d.evidence === 'string' ? d.evidence : JSON.stringify(d.evidence) })) ?? null,
      mode: 'STRUCTURED',
      isSuperFlex: isSF,
      leagueFormat: data.league?.format ?? null,
      scoringType: isTEP ? 'TEP' : 'PPR',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      evaluation: evalData,
      schemaValid: true,
      rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
      ...(confidenceInfo && { historicalAnalysis: confidenceInfo }),
      ...(dualModeGrades && { dualModeGrades }),
      tradeInsights,
      valuationReport: structuredPayload.valuationReport,
      serverConfidence: { score: computedConfidenceScore, factors: confidenceInputs },
      acceptProbability: acceptProbData,
      ...(negotiationToolkit && { negotiationToolkit }),
    })
  } catch (error) {
    console.error('Trade evaluator error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request format', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to evaluate trade' }, { status: 500 })
  }
})

export const GET = withApiUsage({ endpoint: "/api/trade-evaluator", tool: "TradeEvaluator" })(async () => {
  return NextResponse.json({
    message: 'AllFantasy Trade Evaluator API v3 — Structured Decision Engine',
  })
})
