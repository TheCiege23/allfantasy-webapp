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
import { computeChampionshipDelta, type TeamProjection } from '@/lib/monte-carlo'
import { normalizeTradeScoring, tradeScoringLabel, type NormalizedTradeScoring } from './scoring'

import { priceAssets } from '@/lib/hybrid-valuation'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function normName(s: string) {
  return String(s || '').trim().toLowerCase()
}

function uniq(arr: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of arr) {
    const k = normName(a)
    if (!k) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(String(a).trim())
  }
  return out
}

function buildLeagueProjections(args: {
  numTeams: number
  teamAImpactPre: number
  teamBImpactPre: number
  teamAImpactPost: number
  teamBImpactPost: number
  teamAVol: number
  teamBVol: number
}): {
  teamA: { oddsBefore: number; oddsAfter: number; delta: number }
  teamB: { oddsBefore: number; oddsAfter: number; delta: number }
} {
  const { numTeams, teamAImpactPre, teamBImpactPre, teamAImpactPost, teamBImpactPost, teamAVol, teamBVol } = args

  const allKnown = [teamAImpactPre, teamBImpactPre].filter(v => v > 0)
  const avgImpact = allKnown.length > 0
    ? allKnown.reduce((a, b) => a + b, 0) / allKnown.length
    : 15000

  const impactToMean = (imp: number) => {
    const base = 100
    const diff = (imp - avgImpact) / Math.max(avgImpact, 1)
    return base + diff * 15
  }

  const baseStdDev = 22

  const teams: TeamProjection[] = []
  for (let i = 0; i < numTeams; i++) {
    const spread = (i - Math.floor(numTeams / 2)) * 1.5
    teams.push({
      teamId: `team_${i}`,
      mean: 100 + spread,
      stdDev: baseStdDev + Math.random() * 4,
    })
  }

  const meanA = impactToMean(teamAImpactPre > 0 ? teamAImpactPre : avgImpact)
  const meanB = impactToMean(teamBImpactPre > 0 ? teamBImpactPre : avgImpact)

  teams[0] = { teamId: 'teamA', mean: meanA, stdDev: baseStdDev + teamAVol * 8 }
  if (numTeams > 1) {
    teams[1] = { teamId: 'teamB', mean: meanB, stdDev: baseStdDev + teamBVol * 8 }
  }

  const meanDeltaA = impactToMean(teamAImpactPost > 0 ? teamAImpactPost : teamAImpactPre) - meanA
  const meanDeltaB = impactToMean(teamBImpactPost > 0 ? teamBImpactPost : teamBImpactPre) - meanB

  const champA = computeChampionshipDelta(teams, 0, meanDeltaA, 0, 1000)
  const champB = numTeams > 1
    ? computeChampionshipDelta(teams, 1, meanDeltaB, 0, 1000)
    : { oddsBefore: 0, oddsAfter: 0, delta: 0 }

  return {
    teamA: champA,
    teamB: champB,
  }
}

function scoreLeagueAdjustments(req: TradeEngineRequest) {
  const ns = normalizeTradeScoring(req.leagueContext)
  const drivers: string[] = []
  let delta = 0

  if (ns.qbFormat === 'superflex') {
    delta += 6
    drivers.push('Superflex scarcity boosts QB value')
  }
  const tepBonus = ns.tep.enabled ? ns.tep.premiumPprBonus || 0.5 : 0
  if (tepBonus > 0) {
    delta += Math.round(tepBonus * 10)
    drivers.push(`TE premium enabled (+${tepBonus} PPR bonus)`)
  }
  if (ns.ppCarry > 0) {
    delta += Math.round(ns.ppCarry * 20)
    drivers.push(`Points-per-carry enabled (+${ns.ppCarry}) boosts RB profiles`)
  }
  if (ns.ppr >= 1) {
    delta += 2
    drivers.push(`PPR scoring (ppr=${ns.ppr}) increases WR/TE stability`)
  }

  return { delta: clamp(delta, -15, 15), drivers, scoringLabel: tradeScoringLabel(ns) }
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

function sortHotPositions(ldiByPos: Record<string, number> | undefined) {
  if (!ldiByPos) return []
  return Object.entries(ldiByPos)
    .map(([pos, v]) => ({ pos: String(pos).toUpperCase(), v: Number(v) }))
    .filter(x => Number.isFinite(x.v))
    .sort((a, b) => b.v - a.v)
    .map(x => x.pos)
}

function benchFromStarters(roster: TradePlayerAsset[], starters: { name: string }[]) {
  const starterNames = new Set(starters.map(s => normName(s.name)))
  return roster.filter(p => !starterNames.has(normName(p.name)))
}

function pickCandidates(args: {
  roster: TradePlayerAsset[]
  impactMap: Record<string, { impact: number; vorp: number; vol: number }>
  prefer: 'high_vol' | 'low_vol' | 'low_impact' | 'high_impact'
  posFilter?: string[]
  limit?: number
}) {
  const { roster, impactMap, prefer, posFilter, limit = 3 } = args

  const volOf = (p: TradePlayerAsset) => impactMap[p.name]?.vol ?? 0
  const impactOf = (p: TradePlayerAsset) => impactMap[p.name]?.impact ?? 0
  const posOk = (p: TradePlayerAsset) => {
    if (!posFilter || posFilter.length === 0) return true
    const pos = String(p.pos || '').toUpperCase()
    return posFilter.includes(pos)
  }

  const filtered = roster.filter(posOk)
  if (filtered.length === 0) return []

  const sorted = filtered.slice().sort((a, b) => {
    if (prefer === 'high_vol') return volOf(b) - volOf(a)
    if (prefer === 'low_vol') return volOf(a) - volOf(b)
    if (prefer === 'high_impact') return impactOf(b) - impactOf(a)
    return impactOf(a) - impactOf(b)
  })

  const out: TradePlayerAsset[] = []
  const seen = new Set<string>()
  for (const p of sorted) {
    const k = normName(p.name)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(p)
    if (out.length >= limit) break
  }
  return out
}

function formatCandidateList(players: TradePlayerAsset[]) {
  return players.map(p => `${p.name} (${String(p.pos || '').toUpperCase()})`)
}

function buildCountersAdaptiveNamedTop3(args: {
  fairnessScore: number
  acceptProb: number
  teamADirection?: TeamContext['direction']
  teamBDirection?: TeamContext['direction']
  cfg: RosterCfg
  ldiByPos?: Record<string, number>
  preRosterA: TradePlayerAsset[]
  preRosterB: TradePlayerAsset[]
  startersPreA: { starters: { name: string }[] }
  startersPreB: { starters: { name: string }[] }
  impactMapA: Record<string, { impact: number; vorp: number; vol: number }>
  impactMapB: Record<string, { impact: number; vorp: number; vol: number }>
}) {
  const {
    fairnessScore,
    acceptProb,
    teamADirection,
    teamBDirection,
    cfg,
    ldiByPos,
    preRosterA,
    preRosterB,
    startersPreA,
    startersPreB,
    impactMapA,
    impactMapB,
  } = args

  const counters: any[] = []

  const wantStability = teamADirection === 'CONTEND' || teamADirection === 'FRAGILE_CONTEND'
  const wantCeiling = teamADirection === 'REBUILD'

  const hotPos = sortHotPositions(ldiByPos)
  const hotPosFiltered = hotPos.filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p))
  const topHot = hotPosFiltered[0] || (cfg.superflex ? 'QB' : 'WR')

  const myBench = benchFromStarters(preRosterA, startersPreA.starters)
  const theirBench = benchFromStarters(preRosterB, startersPreB.starters)

  const myAddOptions =
    wantStability
      ? (pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'high_vol', posFilter: [topHot], limit: 3 }).length
          ? pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'high_vol', posFilter: [topHot], limit: 3 })
          : pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'high_vol', limit: 3 }))
      : wantCeiling
        ? (pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', posFilter: [topHot], limit: 3 }).length
            ? pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', posFilter: [topHot], limit: 3 })
            : pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', limit: 3 }))
        : (pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', posFilter: [topHot], limit: 3 }).length
            ? pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', posFilter: [topHot], limit: 3 })
            : pickCandidates({ roster: myBench, impactMap: impactMapA, prefer: 'low_impact', limit: 3 }))

  const myAskOptions =
    wantStability
      ? (pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'low_vol', posFilter: [topHot], limit: 3 }).length
          ? pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'low_vol', posFilter: [topHot], limit: 3 })
          : pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'low_vol', limit: 3 }))
      : wantCeiling
        ? (pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_vol', posFilter: [topHot], limit: 3 }).length
            ? pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_vol', posFilter: [topHot], limit: 3 })
            : pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_vol', limit: 3 }))
        : (pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_impact', posFilter: [topHot], limit: 3 }).length
            ? pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_impact', posFilter: [topHot], limit: 3 })
            : pickCandidates({ roster: theirBench, impactMap: impactMapB, prefer: 'high_impact', limit: 3 }))

  const addList = formatCandidateList(myAddOptions)
  const askList = formatCandidateList(myAskOptions)

  if (acceptProb < 0.55) {
    if (addList.length) {
      counters.push({
        label: wantStability ? 'Win-Now Accept Boost (Top 3)' : wantCeiling ? 'Rebuild Accept Boost (Top 3)' : 'Accept Boost (Top 3)',
        changes: [
          { addToB: `Add one of: ${addList.join(' / ')}` },
          ldiByPos ? { note: `LDI hot position: ${topHot}. Add-options pulled from your bench to match league demand.` } : null,
        ].filter(Boolean),
        acceptProb: clamp(acceptProb + 0.12, 0, 1),
        fairnessScore: clamp(fairnessScore - 3, 0, 100),
        whyTheyAccept: ['Real bench pieces reduce negotiation friction and increase perceived value.'],
        whyItHelpsYou: wantStability
          ? ['You move volatility off your bench without touching core starters.']
          : wantCeiling
            ? ['You keep ceiling assets; pay with surplus/low-impact pieces instead.']
            : ['You increase acceptance without reshaping the core deal.'],
        options: {
          addCandidates: myAddOptions.map(p => ({ id: p.id, name: p.name, pos: p.pos, team: p.team })),
        },
      })
    } else {
      counters.push({
        label: 'Accept Boost (Pick-Based)',
        changes: [
          { addToB: 'Add a late 2nd (or upgrade 3rd \u2192 2nd) instead of losing a core player.' },
          ldiByPos ? { note: `LDI suggests ${topHot} is hot \u2014 picks substitute when bench options are thin.` } : null,
        ].filter(Boolean),
        acceptProb: clamp(acceptProb + 0.11, 0, 1),
        fairnessScore: clamp(fairnessScore - 2, 0, 100),
        whyTheyAccept: ['Picks feel like guaranteed future value.'],
        whyItHelpsYou: ['Keeps your weekly lineup intact while raising acceptance.'],
      })
    }
  }

  if (askList.length) {
    counters.push({
      label: wantStability ? 'Ask Back Stability (Top 3)' : wantCeiling ? 'Ask Back Ceiling (Top 3)' : 'Ask Back Value (Top 3)',
      changes: [
        { askFromThem: `Counter by asking for one of: ${askList.join(' / ')}` },
        ldiByPos ? { note: `Ask-options pulled from their bench in league-demanded position (${topHot}).` } : null,
      ].filter(Boolean),
      acceptProb: clamp(acceptProb + 0.05, 0, 1),
      fairnessScore: clamp(fairnessScore + 1, 0, 100),
      whyTheyAccept: ['Bench concessions are easier than moving starters.'],
      whyItHelpsYou: wantStability
        ? ['Adds floor without paying extra picks.']
        : wantCeiling
          ? ['Adds upside insulation to raise long-term EV.']
          : ['Improves deal balance with minimal negotiation pain.'],
      options: {
        askCandidates: myAskOptions.map(p => ({ id: p.id, name: p.name, pos: p.pos, team: p.team })),
      },
    })
  }

  const partnerIsRebuild = teamBDirection === 'REBUILD'
  counters.push({
    label: partnerIsRebuild ? 'Partner Rebuild Angle' : 'Partner Win-Now Angle',
    changes: partnerIsRebuild
      ? [{ addPick: 'If they hesitate, swap your add-on for a future pick (2nd/3rd) \u2014 rebuilders respond better to picks.' }]
      : [{ addToB: 'If they hesitate, swap pick talk for a usable startable depth piece \u2014 contenders want points now.' }],
    acceptProb: clamp(acceptProb + 0.04, 0, 1),
    fairnessScore: clamp(fairnessScore - 1, 0, 100),
    whyTheyAccept: [partnerIsRebuild ? 'Matches rebuild incentives: future value.' : 'Matches contender incentives: points now.'],
    whyItHelpsYou: ['You increase acceptance by speaking their roster language.'],
  })

  return counters.slice(0, 3)
}

function toHybridAssetsInput(marketAssets: Asset[]) {
  const players: string[] = []
  const picks: Array<{
    year: number
    round: number
    projected_range?: string
    pickNumber?: number
  }> = []

  for (const a of marketAssets) {
    if (a.type === 'player') {
      const nm = (a.player.name || '').trim()
      if (nm) players.push(nm)
    } else if (a.type === 'pick') {
      const y = a.pick.year
      const r = a.pick.round
      if (Number.isFinite(y) && Number.isFinite(r)) {
        picks.push({
          year: y,
          round: r,
          projected_range: a.pick.projected_range,
          pickNumber: a.pick.pickNumber,
        })
      }
    }
  }

  return { players, picks }
}

function pricedItemsToSources(items: Array<{ name: string; type: 'player' | 'pick'; source: string }>) {
  const sources: Record<string, string> = {}
  for (const it of items) {
    if (it.type === 'player') sources[`player:${it.name}`] = it.source
    else sources[`pick:${it.name}`] = it.source
  }
  return sources
}

function pricedItemsToImpactMap(items: Array<any>) {
  const map: Record<string, { impact: number; vorp: number; vol: number }> = {}
  for (const it of items || []) {
    if (it?.type !== 'player') continue
    const nm = String(it.name || '').trim()
    if (!nm) continue
    map[nm] = {
      impact: Number(it.assetValue?.impactValue ?? 0) || 0,
      vorp: Number(it.assetValue?.vorpValue ?? 0) || 0,
      vol: Number(it.assetValue?.volatility ?? 0) || 0,
    }
  }
  return map
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

function faabValue(assets: Asset[]) {
  let total = 0
  for (const a of assets) {
    if (a.type === 'faab') total += clamp(a.faab.amount / 10, 0, 25)
  }
  return total
}

type RosterCfg = {
  startingQB: number
  startingRB: number
  startingWR: number
  startingTE: number
  startingFlex: number
  superflex: boolean
}

function rosterCfgFromLeague(req: TradeEngineRequest): RosterCfg {
  const isSF = req.leagueContext?.scoring?.qbFormat === 'superflex'
  const base: RosterCfg = {
    startingQB: 1,
    startingRB: 2,
    startingWR: 2,
    startingTE: 1,
    startingFlex: isSF ? 3 : 2,
    superflex: isSF,
  }
  const override = (req.leagueContext?.roster as any) || {}
  return {
    ...base,
    startingQB: Number.isFinite(override.startingQB) ? override.startingQB : base.startingQB,
    startingRB: Number.isFinite(override.startingRB) ? override.startingRB : base.startingRB,
    startingWR: Number.isFinite(override.startingWR) ? override.startingWR : base.startingWR,
    startingTE: Number.isFinite(override.startingTE) ? override.startingTE : base.startingTE,
    startingFlex: Number.isFinite(override.startingFlex) ? override.startingFlex : base.startingFlex,
    superflex: typeof override.superflex === 'boolean' ? override.superflex : base.superflex,
  }
}

function volatilityPreference(direction?: TeamContext['direction']) {
  switch (direction) {
    case 'FRAGILE_CONTEND':
      return { volWeight: 0.30, label: 'stability_strong' }
    case 'CONTEND':
      return { volWeight: 0.18, label: 'stability' }
    case 'REBUILD':
      return { volWeight: -0.10, label: 'ceiling' }
    default:
      return { volWeight: 0.0, label: 'neutral' }
  }
}

function buildPostRosterPlayers(args: {
  preRoster: TradePlayerAsset[]
  receivedAssets: Asset[]
  sentAssets: Asset[]
}) {
  const { preRoster, receivedAssets, sentAssets } = args

  const sentNames = new Set(
    sentAssets
      .filter(a => a.type === 'player')
      .map(a => normName(a.player.name))
      .filter(Boolean)
  )

  const kept = preRoster.filter(p => !sentNames.has(normName(p.name)))

  const receivedPlayers: TradePlayerAsset[] = receivedAssets
    .filter(a => a.type === 'player')
    .map(a => enrichDevy((a as any).player))

  const merged = [...kept, ...receivedPlayers]
  const seen = new Set<string>()
  const out: TradePlayerAsset[] = []
  for (const p of merged) {
    const k = normName(p.name)
    if (!k) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(p)
  }
  return out
}

function startersFromRoster(args: {
  roster: TradePlayerAsset[]
  cfg: RosterCfg
  impactMap: Record<string, { impact: number; vorp: number; vol: number }>
  direction?: TeamContext['direction']
}) {
  const { roster, cfg, impactMap, direction } = args
  const pref = volatilityPreference(direction)

  const impactOf = (p: TradePlayerAsset) => impactMap[p.name]?.impact ?? 0
  const volOf = (p: TradePlayerAsset) => impactMap[p.name]?.vol ?? 0
  const scoreOf = (p: TradePlayerAsset) => impactOf(p) - pref.volWeight * volOf(p)

  const byPos = (pos: string) =>
    roster
      .filter(p => String(p.pos || '').toUpperCase() === pos)
      .slice()
      .sort((a, b) => scoreOf(b) - scoreOf(a))

  const starters: { slot: string; name: string; pos: string; impact: number; vol: number; score: number }[] = []
  const used = new Set<string>()

  const takeN = (arr: TradePlayerAsset[], n: number, slot: string) => {
    for (const p of arr) {
      if (n <= 0) break
      const k = normName(p.name)
      if (!k || used.has(k)) continue
      const imp = impactOf(p)
      const vol = volOf(p)
      const sc = scoreOf(p)
      starters.push({ slot, name: p.name, pos: String(p.pos || ''), impact: imp, vol, score: sc })
      used.add(k)
      n--
      if (n <= 0) break
    }
  }

  takeN(byPos('QB'), cfg.startingQB, 'QB')
  takeN(byPos('RB'), cfg.startingRB, 'RB')
  takeN(byPos('WR'), cfg.startingWR, 'WR')
  takeN(byPos('TE'), cfg.startingTE, 'TE')

  const flexEligible = roster
    .filter(p => {
      const pos = String(p.pos || '').toUpperCase()
      if (cfg.superflex) return pos === 'RB' || pos === 'WR' || pos === 'TE' || pos === 'QB'
      return pos === 'RB' || pos === 'WR' || pos === 'TE'
    })
    .slice()
    .sort((a, b) => scoreOf(b) - scoreOf(a))

  takeN(flexEligible, cfg.startingFlex, cfg.superflex ? 'FLEX/SF' : 'FLEX')

  const totalImpact = starters.reduce((acc, s) => acc + (s.impact || 0), 0)
  const avgVol =
    starters.length > 0 ? starters.reduce((acc, s) => acc + (s.vol || 0), 0) / starters.length : 0

  return { starters, totalImpact, prefLabel: pref.label, avgVol }
}

function computeNeedsFitFromRosterConfig(args: {
  cfg: RosterCfg
  partnerRoster: TradePlayerAsset[]
  assetsPartnerReceives: Asset[]
}) {
  const { cfg, partnerRoster, assetsPartnerReceives } = args

  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 }
  for (const p of partnerRoster || []) {
    const pos = String(p.pos || '').toUpperCase()
    if (pos in counts) counts[pos]++
  }

  const need: Record<string, number> = {
    QB: Math.max(0, cfg.startingQB - counts.QB),
    RB: Math.max(0, cfg.startingRB - counts.RB),
    WR: Math.max(0, cfg.startingWR - counts.WR),
    TE: Math.max(0, cfg.startingTE - counts.TE),
  }
  if (cfg.superflex) need.QB += 0.5

  let suppliedNeed = 0
  let suppliedCount = 0
  for (const a of assetsPartnerReceives) {
    if (a.type !== 'player') continue
    const pos = String(a.player.pos || '').toUpperCase()
    if (!(pos in need)) continue
    suppliedCount++
    suppliedNeed += need[pos] > 0 ? 1 : 0.25
  }

  let score = 50
  if (suppliedCount > 0) {
    const ratio = suppliedNeed / suppliedCount
    score += Math.round((ratio - 0.25) * (35 / 0.75))
  } else {
    score -= 8
  }

  return clamp(score, 0, 100)
}

export async function runTradeAnalysis(req: TradeEngineRequest): Promise<TradeEngineResponse> {
  const leagueId = req.leagueId || req.league_id || req.leagueContext?.leagueId || ''
  const leagueContextUsed = !!req.leagueContext
  const nflContextUsed = !!req.nflContext

  const teamA: TeamContext = inferTeamDirection({
    rosterId: 'A',
    managerName: req.sleeperUserA?.username || req.sleeper_username_a || 'Team A',
    roster: req.rosterA ?? [],
  })

  const teamB: TeamContext = inferTeamDirection({
    rosterId: 'B',
    managerName: req.sleeperUserB?.username || req.sleeper_username_b || 'Team B',
    roster: req.rosterB ?? [],
  })

  const splitA = splitDevyAssets(req.assetsA)
  const splitB = splitDevyAssets(req.assetsB)

  const hvAssetsA = toHybridAssetsInput(splitA.marketAssets)
  const hvAssetsB = toHybridAssetsInput(splitB.marketAssets)

  const asOfDate = req.leagueContext?.season ? `${req.leagueContext.season}-12-31` : todayISO()
  const isSuperFlex = req.leagueContext?.scoring?.qbFormat === 'superflex'
  const numTeams = req.numTeams ?? req.leagueContext?.numTeams ?? 12

  const hvCtx: any = {
    asOfDate,
    isSuperFlex,
    numTeams,
    rosterConfig: req.leagueContext?.roster || undefined,
  }

  const pricedA = await priceAssets(hvAssetsA as any, hvCtx)
  const pricedB = await priceAssets(hvAssetsB as any, hvCtx)

  const pricingSources: Record<string, string> = {
    ...pricedItemsToSources(pricedA.items as any),
    ...pricedItemsToSources(pricedB.items as any),
  }

  const devyA = devySideValue(splitA.devyPlayers, teamA.direction)
  const devyB = devySideValue(splitB.devyPlayers, teamB.direction)

  const faabA = faabValue(req.assetsA)
  const faabB = faabValue(req.assetsB)

  const vA = pricedA.total + devyA.total + faabA
  const vB = pricedB.total + devyB.total + faabB

  const total = vA + vB || 1
  const delta = vA - vB
  const fairnessDeltaPct = (delta / total) * 100
  const fairnessScore = clamp(Math.round(50 + fairnessDeltaPct * 1.5), 0, 100)

  const fairnessConfidence =
    leagueContextUsed && (req.marketContext?.partnerTendencies || req.marketContext?.ldiByPos)
      ? ('MODERATE' as const)
      : ('LEARNING' as const)

  const fairnessDrivers = [
    {
      key: 'hybrid_total',
      delta: clamp(delta / 25, -20, 20),
      note: `Hybrid total (market assets) + Devy + FAAB. YouGet(A)=${Math.round(vA)} YouGive(B)=${Math.round(vB)}`,
    },
    ...(splitA.devyPlayers.length || splitB.devyPlayers.length
      ? [
          {
            key: 'devy_projection_layer',
            delta: 2,
            note: `Devy priced via DraftProjectionScore (multA=${devyA.mult.toFixed(2)} multB=${devyB.mult.toFixed(2)})`,
          },
        ]
      : []),
    ...(faabA || faabB
      ? [
          {
            key: 'faab',
            delta: 1,
            note: 'FAAB valued via conservative curve (amount/10, capped at 25).',
          },
        ]
      : []),
  ]

  const leagueAdj = scoreLeagueAdjustments(req)
  const cfg = rosterCfgFromLeague(req)

  const needsFitScore = computeNeedsFitFromRosterConfig({
    cfg,
    partnerRoster: req.rosterB ?? [],
    assetsPartnerReceives: req.assetsB,
  })

  const risk = computeRisk(req, req.assetsA, req.assetsB)
  const volatilityDelta = risk.volatility

  const preRosterA = req.rosterA ?? []
  const preRosterB = req.rosterB ?? []

  const postRosterA = buildPostRosterPlayers({
    preRoster: preRosterA,
    receivedAssets: req.assetsA,
    sentAssets: req.assetsB,
  })

  const postRosterB = buildPostRosterPlayers({
    preRoster: preRosterB,
    receivedAssets: req.assetsB,
    sentAssets: req.assetsA,
  })

  const rosterNamesA = uniq([
    ...preRosterA.map(p => p.name),
    ...postRosterA.map(p => p.name),
  ])
  const rosterNamesB = uniq([
    ...preRosterB.map(p => p.name),
    ...postRosterB.map(p => p.name),
  ])

  const pricedRosterA = await priceAssets({ players: rosterNamesA, picks: [] } as any, hvCtx)
  const pricedRosterB = await priceAssets({ players: rosterNamesB, picks: [] } as any, hvCtx)

  const impactMapA = pricedItemsToImpactMap(pricedRosterA.items as any)
  const impactMapB = pricedItemsToImpactMap(pricedRosterB.items as any)

  const startersPreA = startersFromRoster({
    roster: preRosterA,
    cfg,
    impactMap: impactMapA,
    direction: teamA.direction,
  })
  const startersPostA = startersFromRoster({
    roster: postRosterA,
    cfg,
    impactMap: impactMapA,
    direction: teamA.direction,
  })

  const startersPreB = startersFromRoster({
    roster: preRosterB,
    cfg,
    impactMap: impactMapB,
    direction: teamB.direction,
  })
  const startersPostB = startersFromRoster({
    roster: postRosterB,
    cfg,
    impactMap: impactMapB,
    direction: teamB.direction,
  })

  const netStarterImpactA = startersPostA.totalImpact - startersPreA.totalImpact
  const netStarterImpactB = startersPostB.totalImpact - startersPreB.totalImpact

  const starterDeltaPtsA = clamp(Math.round(netStarterImpactA / 75), -12, 12)
  const starterDeltaPtsB = clamp(Math.round(netStarterImpactB / 75), -12, 12)

  const partnerRosterId = 'B'
  const offeredToPartner: TradePlayerAsset[] = req.assetsB
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
    fairnessScore >= 58 && acceptance.final >= 0.52 ? 'accept'
      : fairnessScore <= 44 ? 'reject'
        : 'counter'

  const counters = buildCountersAdaptiveNamedTop3({
    fairnessScore,
    acceptProb: acceptance.final,
    teamADirection: teamA.direction,
    teamBDirection: teamB.direction,
    cfg,
    ldiByPos: req.marketContext?.ldiByPos as any,
    preRosterA,
    preRosterB,
    startersPreA: { starters: startersPreA.starters },
    startersPreB: { starters: startersPreB.starters },
    impactMapA,
    impactMapB,
  })

  const liquidity = ENGINE_FLAGS.enableLiquidityModel ? computeLiquidity(req.marketContext?.liquidity) : null

  let championshipEquity: TradeEngineResponse['championshipEquity'] = undefined
  {
    try {
      const rawChamp = buildLeagueProjections({
        numTeams,
        teamAImpactPre: startersPreA.totalImpact,
        teamBImpactPre: startersPreB.totalImpact,
        teamAImpactPost: startersPostA.totalImpact,
        teamBImpactPost: startersPostB.totalImpact,
        teamAVol: startersPostA.avgVol,
        teamBVol: startersPostB.avgVol,
      })

      const champReasons: string[] = []
      if (Math.abs(netStarterImpactA) > 500) {
        champReasons.push(`Starter impact ${netStarterImpactA > 0 ? '+' : ''}${Math.round(netStarterImpactA)} pts`)
      }
      if (Math.abs(startersPostA.avgVol - startersPreA.avgVol) > 3) {
        const volChange = startersPostA.avgVol - startersPreA.avgVol
        champReasons.push(`Volatility ${volChange > 0 ? '+' : ''}${volChange.toFixed(1)}% ${volChange > 0 ? '(riskier)' : '(more stable)'}`)
      }
      if (risk.injury > 40) {
        champReasons.push(`Injury risk factor: ${risk.injury}/100`)
      }
      if (teamA.direction === 'CONTEND' && netStarterImpactA > 0) {
        champReasons.push('Contender gets immediate lineup upgrade')
      }
      if (teamA.direction === 'REBUILD' && netStarterImpactA < 0) {
        champReasons.push('Rebuild direction — trading production for future value')
      }
      if (champReasons.length === 0) {
        champReasons.push('Marginal lineup shift — title odds nearly unchanged')
      }

      const champConfidence: 'HIGH' | 'MODERATE' | 'LEARNING' =
        leagueContextUsed && numTeams >= 10 ? 'HIGH'
          : numTeams >= 8 ? 'MODERATE'
            : 'LEARNING'

      championshipEquity = {
        ...rawChamp,
        confidence: champConfidence,
        topReasons: champReasons.slice(0, 2),
      }
    } catch (_) {}
  }

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
    lineupImpact: {
      starterDeltaPts: starterDeltaPtsA,
      note: `A(${teamA.direction}:${startersPreA.prefLabel}) impact ${Math.round(startersPreA.totalImpact)}\u2192${Math.round(startersPostA.totalImpact)} net ${Math.round(netStarterImpactA)} | avgVol ${startersPostA.avgVol.toFixed(1)}. B(${teamB.direction}:${startersPreB.prefLabel}) impact ${Math.round(startersPreB.totalImpact)}\u2192${Math.round(startersPostB.totalImpact)} net ${Math.round(netStarterImpactB)} | avgVol ${startersPostB.avgVol.toFixed(1)}.`,
    },
    risk,
    acceptanceProbability: acceptance,
    counters,
    championshipEquity,
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
      scoringLabel: leagueAdj.scoringLabel,
      hv: {
        asOfDate,
        isSuperFlex,
        numTeams,
        statsA: pricedA.stats,
        statsB: pricedB.stats,
        rosterStatsA: pricedRosterA.stats,
        rosterStatsB: pricedRosterB.stats,
      },
      rosterConfig: cfg,
      needsFitScore,
      starterImpact: {
        teamA: {
          direction: teamA.direction,
          preference: startersPreA.prefLabel,
          avgVolPre: Number(startersPreA.avgVol.toFixed(2)),
          avgVolPost: Number(startersPostA.avgVol.toFixed(2)),
          pre: Math.round(startersPreA.totalImpact),
          post: Math.round(startersPostA.totalImpact),
          net: Math.round(netStarterImpactA),
          starterDeltaPts: starterDeltaPtsA,
          startersPre: startersPreA.starters,
          startersPost: startersPostA.starters,
        },
        teamB: {
          direction: teamB.direction,
          preference: startersPreB.prefLabel,
          avgVolPre: Number(startersPreB.avgVol.toFixed(2)),
          avgVolPost: Number(startersPostB.avgVol.toFixed(2)),
          pre: Math.round(startersPreB.totalImpact),
          post: Math.round(startersPostB.totalImpact),
          net: Math.round(netStarterImpactB),
          starterDeltaPts: starterDeltaPtsB,
          startersPre: startersPreB.starters,
          startersPost: startersPostB.starters,
        },
      },
      teamA: { direction: teamA.direction, confidence: teamA.directionConfidence },
      teamB: { direction: teamB.direction, confidence: teamB.directionConfidence },
      liquidity,
      devy: {
        sideA: { count: splitA.devyPlayers.length, mult: devyA.mult },
        sideB: { count: splitB.devyPlayers.length, mult: devyB.mult },
      },
    },
  }
}
