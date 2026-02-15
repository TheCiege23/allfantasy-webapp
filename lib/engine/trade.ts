import type {
  Asset,
  TeamContext,
  TradeEngineRequest,
  TradeEngineResponse,
  TradePlayerAsset,
} from './trade-types'
import { ENGINE_FLAGS } from './flags'
import { computeLiquidity } from './liquidity'
import { computeAcceptanceProbability } from './acceptance'
import { enrichDevy, devyValueMultiplier } from './devy'

import * as Hybrid from '@/lib/hybrid-valuation'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizePos(pos?: string) {
  return (pos || '').toUpperCase()
}

function hashSafeString(x: any) {
  try {
    return JSON.stringify(x)
  } catch {
    return String(x)
  }
}

async function safePriceAssets(args: {
  assets: Asset[]
  ctx: any
}): Promise<{
  totalValue: number
  sources?: Record<string, string>
  breakdown?: any
}> {
  const { assets, ctx } = args
  const fn: any = (Hybrid as any).priceAssets

  if (typeof fn !== 'function') {
    return { totalValue: 0, sources: { _engine: 'hybrid_missing' } }
  }

  const normalize = (out: any) => {
    if (!out) return { totalValue: 0 }

    if (typeof out === 'number') return { totalValue: out }

    const totalValue =
      typeof out.totalValue === 'number'
        ? out.totalValue
        : typeof out.total === 'number'
          ? out.total
          : typeof out.value === 'number'
            ? out.value
            : typeof out.sum === 'number'
              ? out.sum
              : 0

    const sources =
      out.valuationSources && typeof out.valuationSources === 'object'
        ? out.valuationSources
        : out.sources && typeof out.sources === 'object'
          ? out.sources
          : undefined

    return { totalValue, sources, breakdown: out }
  }

  const attempts: Array<() => Promise<any> | any> = [
    () => fn(assets, ctx),
    () => fn({ assets, ctx }),
    () => fn(ctx, assets),
  ]

  for (const attempt of attempts) {
    try {
      const out = await attempt()
      return normalize(out)
    } catch {
      // continue
    }
  }

  return { totalValue: 0, sources: { _engine: 'hybrid_failed' } }
}

function scoreLeagueAdjustments(req: TradeEngineRequest) {
  const scoring = req.leagueContext?.scoring
  if (!scoring) return { delta: 0, drivers: [] as string[] }

  const drivers: string[] = []
  let delta = 0

  const qbFormat = scoring.qbFormat
  const tep = scoring.tep?.enabled ? scoring.tep.premiumPprBonus ?? 0.5 : 0
  const ppCarry = scoring.ppCarry ?? 0
  const ppr = scoring.ppr ?? 0

  if (qbFormat === 'superflex') {
    delta += 6
    drivers.push('Superflex scarcity boosts QB value')
  }
  if (tep > 0) {
    delta += Math.round(tep * 10)
    drivers.push(`TE premium enabled (+${tep} PPR bonus)`)
  }
  if (ppCarry > 0) {
    delta += Math.round(ppCarry * 20)
    drivers.push(`Points-per-carry enabled (+${ppCarry}) boosts RB profiles`)
  }
  if (ppr >= 1) {
    delta += 2
    drivers.push(`PPR scoring (ppr=${ppr}) increases WR/TE stability`)
  }

  return { delta: clamp(delta, -15, 15), drivers }
}

function inferTeamDirection(team: TeamContext): TeamContext {
  const ages: number[] = []
  let devyCount = 0
  let nflCount = 0

  for (const p of team.roster) {
    if (p.league === 'NCAA' && p.devyEligible && !p.graduatedToNFL) devyCount++
    if (p.league === 'NFL') nflCount++
    if (typeof p.age === 'number') ages.push(p.age)
  }

  const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 25
  const directionConfidence =
    nflCount >= 12 ? ('MODERATE' as const) : ('LEARNING' as const)

  let direction: TeamContext['direction'] = 'MIDDLE'

  if (devyCount >= 6) direction = 'REBUILD'
  if (avgAge <= 24 && devyCount >= 3) direction = 'REBUILD'
  if (avgAge >= 27 && devyCount <= 1) direction = 'CONTEND'
  if (avgAge >= 28) direction = 'FRAGILE_CONTEND'

  return { ...team, direction, directionConfidence }
}

function computeRisk(req: TradeEngineRequest, assetsA: Asset[], assetsB: Asset[]) {
  const ctx = req.nflContext?.players || {}
  const touchedIds = new Set<string>()
  for (const a of [...assetsA, ...assetsB]) {
    if (a.type === 'player') touchedIds.add(String(a.player.id))
  }

  let injury = 25
  let roleStability = 70
  let volatility = 35
  const notes: string[] = []

  for (const id of touchedIds) {
    const s = ctx[id]
    if (!s) continue
    if (s.injuryStatus && s.injuryStatus !== 'healthy') {
      injury += 10
      volatility += 8
      notes.push(`${id}: injuryStatus=${s.injuryStatus}`)
      if ((s.expectedReturnWeeks ?? 0) > 0) notes.push(`${id}: expectedReturnWeeks=${s.expectedReturnWeeks}`)
    }
    if (s.role && (s.role.includes('committee') || s.role.includes('backup'))) {
      roleStability -= 10
      volatility += 6
      notes.push(`${id}: role=${s.role}`)
    }
    if (s.depthChartChange) {
      roleStability -= 6
      volatility += 5
      notes.push(`${id}: depth chart change flag`)
    }
    if (s.coachingChange) {
      volatility += 4
      notes.push(`${id}: coaching change flag`)
    }
  }

  return {
    injury: clamp(injury, 0, 100),
    roleStability: clamp(roleStability, 0, 100),
    volatility: clamp(volatility, 0, 100),
    notes: notes.slice(0, 8),
  }
}

function estimateNeedsFitScore(req: TradeEngineRequest) {
  const scoring = req.leagueContext?.scoring
  const isSF = scoring?.qbFormat === 'superflex'
  const assetsAll = [...req.assetsA, ...req.assetsB]

  const hasQB = assetsAll.some(a => a.type === 'player' && (a.player.pos || '').toUpperCase() === 'QB')
  const hasTE = assetsAll.some(a => a.type === 'player' && (a.player.pos || '').toUpperCase() === 'TE')
  const isTEP = !!scoring?.tep?.enabled

  let score = 55
  if (isSF && hasQB) score += 10
  if (isTEP && hasTE) score += 8
  return clamp(score, 0, 100)
}

function buildCounters(baseFairness: number, acceptProb: number) {
  const counters = []

  if (acceptProb < 0.55) {
    counters.push({
      label: 'Likely Accept',
      changes: [{ addToB: 'Add a 2nd / small sweetener' }],
      acceptProb: clamp(acceptProb + 0.12, 0, 1),
      fairnessScore: clamp(baseFairness - 3, 0, 100),
      whyTheyAccept: ['Adds tangible upside without changing core structure.'],
      whyItHelpsYou: ['Increases acceptance while keeping most of your value edge.'],
    })
  }

  counters.push({
    label: 'Value Win',
    changes: [{ swap: 'Downgrade your least important piece, keep the stud' }],
    acceptProb: clamp(acceptProb - 0.04, 0, 1),
    fairnessScore: clamp(baseFairness + 4, 0, 100),
    whyTheyAccept: ['Still looks fair on the surface.'],
    whyItHelpsYou: ['Improves long-term value without adding major cost.'],
  })

  counters.push({
    label: 'Rebuild Pivot',
    changes: [{ addPick: 'Add future 1st / convert to picks' }],
    acceptProb: clamp(acceptProb - 0.10, 0, 1),
    fairnessScore: clamp(baseFairness + 8, 0, 100),
    whyTheyAccept: ['Picks align with future-focused builds.'],
    whyItHelpsYou: ['You can redirect to a future window if this isn\'t your year.'],
  })

  return counters.slice(0, 3)
}

function splitDevyAssets(assets: Asset[]) {
  const devyPlayers: TradePlayerAsset[] = []
  const marketAssets: Asset[] = []

  for (const a of assets) {
    if (a.type === 'player') {
      const p = enrichDevy(a.player)
      if (p.league === 'NCAA' && p.devyEligible && !p.graduatedToNFL) {
        devyPlayers.push(p)
        continue
      }
      marketAssets.push({ type: 'player', player: p })
      continue
    }
    marketAssets.push(a)
  }

  return { devyPlayers, marketAssets }
}

function devySideValue(devyPlayers: TradePlayerAsset[], teamDirection?: string) {
  const mult = devyValueMultiplier(teamDirection)
  let total = 0
  for (const p of devyPlayers) {
    const score = p.draftProjectionScore ?? 50
    total += score * mult
  }
  return { total, mult }
}

export async function runTradeAnalysis(req: TradeEngineRequest): Promise<TradeEngineResponse> {
  const leagueId = req.leagueId || req.league_id || req.leagueContext?.leagueId || ''
  const leagueContextUsed = !!req.leagueContext
  const nflContextUsed = !!req.nflContext

  const teamA: TeamContext = inferTeamDirection({
    rosterId: 'A',
    managerName: req.sleeperUserA?.username || req.sleeper_username_a || 'Side A',
    roster: req.rosterA ?? [],
  })

  const teamB: TeamContext = inferTeamDirection({
    rosterId: 'B',
    managerName: req.sleeperUserB?.username || req.sleeper_username_b || 'Side B',
    roster: req.rosterB ?? [],
  })

  const hvCtx: any = {
    sport: String(req.sport || 'NFL').toLowerCase(),
    format: req.format || 'dynasty',
    numTeams: req.numTeams ?? req.leagueContext?.numTeams ?? 12,
    qbFormat: req.leagueContext?.scoring?.qbFormat || '1QB',
    scoring: req.leagueContext?.scoring || undefined,
    roster: req.leagueContext?.roster || undefined,
    leagueId,
  }

  const splitA = splitDevyAssets(req.assetsA)
  const splitB = splitDevyAssets(req.assetsB)

  const pricedA = await safePriceAssets({ assets: splitA.marketAssets, ctx: hvCtx })
  const pricedB = await safePriceAssets({ assets: splitB.marketAssets, ctx: hvCtx })

  const devyA = devySideValue(splitA.devyPlayers, teamA.direction)
  const devyB = devySideValue(splitB.devyPlayers, teamB.direction)

  const vA = pricedA.totalValue + devyA.total
  const vB = pricedB.totalValue + devyB.total

  const total = vA + vB || 1
  const delta = vA - vB
  const fairnessDeltaPct = (delta / total) * 100

  const fairnessScore = clamp(Math.round(50 + fairnessDeltaPct * 1.5), 0, 100)

  const fairnessConfidence =
    leagueContextUsed && (req.marketContext?.partnerTendencies || req.marketContext?.ldiByPos)
      ? ('MODERATE' as const)
      : ('LEARNING' as const)

  const pricingSources: Record<string, string> = {
    ...(pricedA.sources || {}),
    ...(pricedB.sources || {}),
  }

  const fairnessDrivers = [
    {
      key: 'hybrid_value_delta',
      delta: clamp(delta / 25, -20, 20),
      note: `Hybrid valuation delta (market assets) + Devy projection delta. vA=${Math.round(vA)} vB=${Math.round(vB)}`,
    },
    ...(splitA.devyPlayers.length || splitB.devyPlayers.length
      ? [
          {
            key: 'devy_projection_layer',
            delta: 2,
            note: `Devy assets priced via DraftProjectionScore (multA=${devyA.mult.toFixed(2)} multB=${devyB.mult.toFixed(2)})`,
          },
        ]
      : []),
  ]

  const leagueAdj = scoreLeagueAdjustments(req)
  const needsFitScore = estimateNeedsFitScore(req)
  const risk = computeRisk(req, req.assetsA, req.assetsB)
  const volatilityDelta = risk.volatility

  const partnerRosterId = 'B'
  const offeredToPartner: TradePlayerAsset[] = req.assetsA
    .filter(a => a.type === 'player')
    .map(a => (a as any).player)

  const acceptance = computeAcceptanceProbability({
    req,
    fairnessScore,
    needsFitScore,
    volatilityDelta,
    marketContext: req.marketContext,
    partnerRosterId,
    offeredPlayersToPartner: offeredToPartner,
  })

  const verdict: TradeEngineResponse['verdict'] =
    fairnessScore >= 60 && acceptance.final >= 0.55 ? 'accept'
    : fairnessScore <= 45 && acceptance.final <= 0.45 ? 'reject'
    : 'counter'

  const counters = buildCounters(fairnessScore, acceptance.final)

  const lineupImpact = {
    starterDeltaPts: clamp(Math.round((needsFitScore - 50) / 8), -8, 8),
    note: leagueContextUsed
      ? 'League settings applied; replacement-level slot modeling can be upgraded with full slot map.'
      : 'Limited league settings; provide roster/scoring for highest accuracy.',
  }

  const liquidity = ENGINE_FLAGS.enableLiquidityModel ? computeLiquidity(req.marketContext?.liquidity) : null

  return {
    verdict,
    fairness: {
      score: fairnessScore,
      delta: Math.round(delta),
      confidence: fairnessConfidence,
      drivers: fairnessDrivers
        .slice()
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 6),
    },
    leagueAdjusted: {
      delta: leagueAdj.delta,
      drivers: leagueAdj.drivers,
    },
    lineupImpact,
    risk,
    acceptanceProbability: acceptance,
    counters,
    evidence: {
      leagueContextUsed,
      nflContextUsed,
      partnerModelUsed: !!req.marketContext?.partnerTendencies,
      liquidityUsed: !!liquidity,
      devyUsed: (splitA.devyPlayers.length + splitB.devyPlayers.length) > 0,
      pricingSources,
    },
    meta: {
      leagueId,
      hvCtx: hashSafeString(hvCtx),
      teamA: { direction: teamA.direction, confidence: teamA.directionConfidence },
      teamB: { direction: teamB.direction, confidence: teamB.directionConfidence },
      liquidity,
      hybridA: pricedA.breakdown ? { ok: true } : { ok: false },
      hybridB: pricedB.breakdown ? { ok: true } : { ok: false },
      devy: {
        sideA: { count: splitA.devyPlayers.length, mult: devyA.mult },
        sideB: { count: splitB.devyPlayers.length, mult: devyB.mult },
      },
    },
  }
}
