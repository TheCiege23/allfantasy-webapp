export function computeDraftProjectionScore(player: any) {
  const recruitingRaw = player.recruitingComposite ?? 0
  const recruiting = recruitingRaw <= 1 ? recruitingRaw * 100 : recruitingRaw
  const breakout = breakoutAgeScore(player.breakoutAge)
  const draftCapital = draftCapitalScore(player.projectedDraftRound)
  const adpMarket = adpScore(player.devyAdp)

  const score =
    recruiting * 0.25 +
    breakout * 0.20 +
    draftCapital * 0.30 +
    adpMarket * 0.15 +
    (player.nilImpactScore ?? 0) * 0.05 -
    (player.injurySeverityScore ?? 0) * 0.05

  return Math.max(0, Math.min(100, Math.round(score)))
}

function breakoutAgeScore(age?: number | null) {
  if (!age) return 50
  if (age <= 19.5) return 95
  if (age <= 20) return 90
  if (age <= 21) return 80
  if (age <= 22) return 65
  return 50
}

function draftCapitalScore(round?: number | null) {
  if (!round) return 50
  if (round === 1) return 95
  if (round === 2) return 85
  if (round === 3) return 70
  if (round === 4) return 60
  return 45
}

function adpScore(adp?: number | null) {
  if (!adp) return 50
  if (adp <= 3) return 95
  if (adp <= 6) return 85
  if (adp <= 12) return 75
  if (adp <= 24) return 60
  return 50
}

export function devyAcceptanceAdjustment(player: any, partnerProfile: any) {
  let delta = 0

  if (player.draftProjectionScore >= 85)
    delta += 0.06

  if (player.breakoutAge && player.breakoutAge <= 20)
    delta += 0.03

  if (partnerProfile?.futureFocused)
    delta += 0.08

  if (player.injurySeverityScore && player.injurySeverityScore > 70)
    delta -= 0.07

  return delta
}

export function applyTeamDirectionAdjustment(adjustedValue: number, teamDirection: string): number {
  if (teamDirection === 'CONTEND') {
    return adjustedValue * 0.85
  }
  if (teamDirection === 'REBUILD') {
    return adjustedValue * 1.1
  }
  return adjustedValue
}
