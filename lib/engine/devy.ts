import type { TradePlayerAsset } from './trade-types'

export function breakoutAgeScore(age?: number | null) {
  if (age == null) return 50
  if (age <= 19.5) return 95
  if (age <= 20) return 90
  if (age <= 21) return 80
  if (age <= 22) return 65
  return 50
}

export function draftCapitalScore(round?: number | null) {
  if (!round) return 50
  if (round === 1) return 95
  if (round === 2) return 85
  if (round === 3) return 70
  if (round === 4) return 60
  return 45
}

export function adpScore(adp?: number | null) {
  if (!adp) return 50
  if (adp <= 3) return 95
  if (adp <= 6) return 85
  if (adp <= 12) return 75
  if (adp <= 24) return 60
  return 50
}

export function computeDraftProjectionScore(player: TradePlayerAsset) {
  const raw = player.recruitingComposite ?? 0
  const recruitingNorm = raw <= 1 ? Math.max(0, Math.min(100, raw * 100)) : Math.max(0, Math.min(100, raw))

  const breakout = breakoutAgeScore(player.breakoutAge ?? null)
  const capital = draftCapitalScore(player.projectedDraftRound ?? null)
  const market = adpScore(player.devyAdp ?? null)

  const nil = Math.max(0, Math.min(100, player.nilImpactScore ?? 0))
  const injury = Math.max(0, Math.min(100, player.injurySeverityScore ?? 0))

  const score =
    recruitingNorm * 0.25 +
    breakout * 0.20 +
    capital * 0.30 +
    market * 0.15 +
    nil * 0.05 -
    injury * 0.05

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function enrichDevy(player: TradePlayerAsset) {
  if (player.league !== 'NCAA' || !player.devyEligible || player.graduatedToNFL) {
    return { ...player, draftProjectionScore: player.draftProjectionScore ?? undefined }
  }
  const draftProjectionScore = player.draftProjectionScore ?? computeDraftProjectionScore(player)
  return { ...player, draftProjectionScore }
}

export function devyValueMultiplier(teamDirection?: string) {
  if (teamDirection === 'CONTEND' || teamDirection === 'FRAGILE_CONTEND') return 0.85
  if (teamDirection === 'REBUILD') return 1.1
  return 1.0
}
