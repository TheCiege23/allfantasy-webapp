// lib/trade-engine/rankingsEngine.ts
// League rankings using trade engine intelligence

import { Asset, ManagerProfile, LeagueSettings } from './types'
import { computeLeagueIdpScarcity, adjustIdpValue } from './idpTuning'

export type TeamRanking = {
  rosterId: number
  displayName: string
  rank: number
  teamScore: number
  starterValue: number
  depthValue: number
  futureValue: number
  contenderTier: ManagerProfile['contenderTier']
  strengths: string[]
  weaknesses: string[]
}

export type RankingsContext = {
  settings: LeagueSettings
  managerProfiles: Record<number, ManagerProfile>
  assetsByRosterId: Record<number, Asset[]>
}

function computeScarcityMultiplier(
  pos: string,
  settings: LeagueSettings
): number {
  if (pos === 'QB' && settings.isSF) return 1.3
  if (pos === 'TE' && settings.isTEP) return 1.2
  if (pos === 'RB') return 1.1
  if (pos === 'WR') return 1.0
  return 0.9
}

export function computeTeamScore(
  assets: Asset[],
  settings: LeagueSettings
): { starterValue: number; depthValue: number; futureValue: number; total: number } {
  let starterValue = 0
  let depthValue = 0
  let futureValue = 0

  const idpScarcity = settings.idpEnabled
    ? computeLeagueIdpScarcity(settings.rosterPositions, settings.numTeams)
    : []

  for (const asset of assets) {
    if (asset.type === 'PLAYER') {
      let value = asset.value

      if (asset.isIdp && settings.idpEnabled) {
        const scarcity = idpScarcity.find(s => s.position === asset.pos)
        if (scarcity) {
          value = adjustIdpValue(value, asset.pos ?? 'IDP', scarcity.scarcityIndex)
        }
      } else if (asset.pos) {
        value = Math.round(value * computeScarcityMultiplier(asset.pos, settings))
      }

      if (asset.slot === 'Starter') {
        starterValue += value
      } else {
        depthValue += value
      }
    } else if (asset.type === 'PICK') {
      futureValue += asset.value
    }
  }

  const total = starterValue + depthValue * 0.5 + futureValue * 0.3

  return { starterValue, depthValue, futureValue, total }
}

export function computeLeagueRankings(ctx: RankingsContext): TeamRanking[] {
  const { settings, managerProfiles, assetsByRosterId } = ctx

  const rankings: TeamRanking[] = []

  for (const [rosterIdStr, profile] of Object.entries(managerProfiles)) {
    const rosterId = Number(rosterIdStr)
    const assets = assetsByRosterId[rosterId] || []

    const { starterValue, depthValue, futureValue, total } = computeTeamScore(assets, settings)

    const strengths: string[] = []
    const weaknesses: string[] = []

    if (profile.surplus.length > 0) {
      strengths.push(`Strong at ${profile.surplus.join(', ')}`)
    }
    if (starterValue >= 50000) {
      strengths.push('Elite starting lineup')
    }
    if (futureValue >= 20000) {
      strengths.push('Stacked with draft capital')
    }

    if (profile.needs.length > 0) {
      weaknesses.push(`Needs help at ${profile.needs.join(', ')}`)
    }
    if (depthValue < 10000) {
      weaknesses.push('Shallow bench')
    }
    if (futureValue < 5000) {
      weaknesses.push('Limited draft capital')
    }

    rankings.push({
      rosterId,
      displayName: profile.displayName,
      rank: 0,
      teamScore: Math.round(total),
      starterValue: Math.round(starterValue),
      depthValue: Math.round(depthValue),
      futureValue: Math.round(futureValue),
      contenderTier: profile.contenderTier,
      strengths,
      weaknesses,
    })
  }

  rankings.sort((a, b) => b.teamScore - a.teamScore)
  rankings.forEach((r, i) => (r.rank = i + 1))

  return rankings
}

// ============================================
// SIMPLIFIED RANKINGS ENGINE (SNAPSHOT-BASED)
// ============================================

import { LeagueIntelSnapshot } from './types'

export type SimplifiedTeamRanking = {
  rosterId: number
  displayName: string
  powerScore: number
  tier: 'S' | 'A' | 'B' | 'C' | 'D'
}

function tierFromScore(s: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (s >= 92) return 'S'
  if (s >= 82) return 'A'
  if (s >= 72) return 'B'
  if (s >= 62) return 'C'
  return 'D'
}

export function runRankingsEngine(snapshot: LeagueIntelSnapshot): SimplifiedTeamRanking[] {
  const out: SimplifiedTeamRanking[] = []
  
  for (const [ridStr, assets] of Object.entries(snapshot.assetsByRosterId)) {
    const rosterId = Number(ridStr)
    const p = snapshot.profilesByRosterId[rosterId]
    if (!p) continue

    const starters = (assets || [])
      .filter(a => a.type === 'PLAYER' && a.slot === 'Starter')
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    const base = starters.reduce((s, a) => s + (a.value || 0), 0)

    let mult = 1.0
    if (snapshot.league.isSF) mult += 0.06
    if (snapshot.league.isTEP) mult += 0.04
    if (snapshot.idpConfig?.enabled) mult += 0.03

    const powerScore = Math.round((base / 1000) * mult)

    out.push({
      rosterId,
      displayName: p.displayName,
      powerScore,
      tier: tierFromScore(powerScore),
    })
  }

  return out.sort((a, b) => b.powerScore - a.powerScore)
}
