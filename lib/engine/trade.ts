import type {
  TradeAssetUnion,
  TeamContext,
  TradeEngineRequest,
  TradeEngineResponse,
  TradePlayerAsset,
} from './trade-types'
import { ENGINE_FLAGS } from './flags'
import { computeEngineLiquidity } from './engine-liquidity'
import { computeAcceptanceProbability } from './engine-acceptance'
import { enrichDevy, devyValueMultiplier } from './devy'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalizePos(pos?: string) {
  return (pos || '').toUpperCase()
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

function basePlayerValue(p: TradePlayerAsset) {
  if (p.league === 'NCAA' && p.devyEligible && !p.graduatedToNFL) {
    const enriched = enrichDevy(p)
    return enriched.draftProjectionScore ?? 50
  }

  const pos = normalizePos(p.pos)
  if (pos === 'QB') return 70
  if (pos === 'RB') return 65
  if (pos === 'WR') return 62
  if (pos === 'TE') return 55
  return 50
}

function sumAssetsValue(assets: TradeAssetUnion[], teamDirection?: string) {
  let total = 0
  const notes: string[] = []

  for (const a of assets) {
    if (a.type === 'faab') total += clamp(a.faab.amount / 10, 0, 25)
    if (a.type === 'pick') {
      const base =
        a.pick.round === 1 ? 80 :
        a.pick.round === 2 ? 55 :
        a.pick.round === 3 ? 35 :
        20
      total += base
    }
    if (a.type === 'player') {
      const p0 = enrichDevy(a.player)
      const mult = p0.league === 'NCAA' ? devyValueMultiplier(teamDirection) : 1.0
      const v = basePlayerValue(p0) * mult
      total += v
      if (p0.league === 'NCAA') notes.push(`Devy timeline multiplier applied (${mult.toFixed(2)})`)
    }
  }

  return { total, notes }
}

function computeRisk(req: TradeEngineRequest, assetsA: TradeAssetUnion[], assetsB: TradeAssetUnion[]) {
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

export async function runTradeAnalysis(req: TradeEngineRequest): Promise<TradeEngineResponse> {
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

  const { total: vA, notes: devyNotesA } = sumAssetsValue(req.assetsA, teamA.direction)
  const { total: vB, notes: devyNotesB } = sumAssetsValue(req.assetsB, teamB.direction)

  const total = vA + vB || 1
  const delta = vA - vB
  const fairnessDeltaPct = (delta / total) * 100

  const fairnessScore = clamp(Math.round(50 + fairnessDeltaPct * 1.5), 0, 100)

  const fairnessConfidence =
    leagueContextUsed && (req.marketContext?.partnerTendencies || req.marketContext?.ldiByPos)
      ? ('MODERATE' as const)
      : ('LEARNING' as const)

  const fairnessDrivers = [
    { key: 'market_value', delta: clamp(delta / 25, -20, 20), note: 'Net value difference between sides.' },
    ...(devyNotesA.length || devyNotesB.length
      ? [{ key: 'devy_timeline', delta: 2, note: 'Devy timeline multipliers applied based on team direction.' }]
      : []),
  ]

  const leagueAdj = scoreLeagueAdjustments(req)

  const needsFitScore = estimateNeedsFitScore(req)
  const risk = computeRisk(req, req.assetsA, req.assetsB)

  const volatilityDelta = risk.volatility

  const partnerRosterId = 'B'

  const offeredToPartner: TradePlayerAsset[] = req.assetsA
    .filter(a => a.type === 'player')
    .map(a => (a as Extract<TradeAssetUnion, { type: 'player' }>).player)

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
      ? 'League settings applied; replace-level modeling can be upgraded with full slot map.'
      : 'Limited league settings; provide roster/scoring for highest accuracy.',
  }

  const liquidity = ENGINE_FLAGS.enableLiquidityModel ? computeEngineLiquidity(req.marketContext?.liquidity) : null

  const leagueId = req.leagueId || req.league_id || req.leagueContext?.leagueId || ''

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
      devyUsed:
        [...req.assetsA, ...req.assetsB].some(a => a.type === 'player' && a.player?.league === 'NCAA'),
      pricingSources: {},
    },
    meta: {
      leagueId,
      teamA: { direction: teamA.direction, confidence: teamA.directionConfidence },
      teamB: { direction: teamB.direction, confidence: teamB.directionConfidence },
      liquidity,
    },
  }
}
