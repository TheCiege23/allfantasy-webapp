import type { MarketContext, TradeEngineRequest, TradePlayerAsset } from './trade-types'
import { enrichDevy } from './devy'

function clamp01(x: number) {
  return Math.max(0.01, Math.min(0.99, x))
}

function sigmoid(z: number) {
  return 1 / (1 + Math.exp(-z))
}

export function computeAcceptanceProbability(args: {
  req: TradeEngineRequest
  fairnessScore: number
  needsFitScore: number
  volatilityDelta: number
  marketContext?: MarketContext
  partnerRosterId?: string
  offeredPlayersToPartner?: TradePlayerAsset[]
}) {
  const { fairnessScore, needsFitScore, volatilityDelta, marketContext, partnerRosterId, offeredPlayersToPartner } = args

  const drivers: { key: string; delta: number; note: string }[] = []

  const fairnessNorm = (fairnessScore - 50) / 50
  const needsNorm = (needsFitScore - 50) / 50
  const volNorm = (volatilityDelta - 50) / 50

  const partner = partnerRosterId ? marketContext?.partnerTendencies?.[partnerRosterId] : undefined
  const partnerSample = partner?.sampleSize ?? 0

  let z =
    0.9 * fairnessNorm +
    0.7 * needsNorm -
    0.6 * volNorm

  drivers.push({ key: 'fairness', delta: 0.9 * fairnessNorm, note: 'More fair trades are accepted more often.' })
  drivers.push({ key: 'needs_fit', delta: 0.7 * needsNorm, note: 'If it helps their lineup/needs, acceptance rises.' })
  drivers.push({ key: 'volatility', delta: -0.6 * volNorm, note: 'High volatility packages reduce acceptance.' })

  const ldi = marketContext?.ldiByPos
  if (ldi) {
    let ldiBoost = 0
    for (const p of offeredPlayersToPartner ?? []) {
      const pos = (p.pos || '').toUpperCase()
      const ldiPos = ldi[pos] ?? ldi[pos === 'DST' ? 'DEF' : pos] ?? null
      if (ldiPos != null && ldiPos >= 65) ldiBoost += 0.04
      if (ldiPos != null && ldiPos <= 40) ldiBoost -= 0.02
    }
    if (ldiBoost !== 0) {
      z += ldiBoost
      drivers.push({ key: 'ldi_alignment', delta: ldiBoost, note: 'Offering positions this league overpays for boosts acceptance.' })
    }
  }

  if (partner && partnerSample >= 6) {
    if (partner.futureFocused) {
      z += 0.05
      drivers.push({ key: 'partner_future_focused', delta: 0.05, note: 'This manager historically prefers future assets.' })
    }
    if (partner.riskAverse) {
      z -= 0.05
      drivers.push({ key: 'partner_risk_averse', delta: -0.05, note: 'This manager historically avoids risky packages.' })
    }
    if (partner.pickHoarder) {
      z += 0.04
      drivers.push({ key: 'partner_pick_bias', delta: 0.04, note: 'This manager tends to trade for picks.' })
    }
    if (partner.studChaser) {
      z += 0.03
      drivers.push({ key: 'partner_stud_bias', delta: 0.03, note: 'This manager tends to consolidate into elite players.' })
    }
  }

  let devyDelta = 0
  for (const raw of offeredPlayersToPartner ?? []) {
    const p = enrichDevy(raw)
    if (p.league === 'NCAA' && p.devyEligible && !p.graduatedToNFL) {
      if ((p.draftProjectionScore ?? 50) >= 85) devyDelta += 0.06
      if ((p.breakoutAge ?? 99) <= 20) devyDelta += 0.03
      if ((p.injurySeverityScore ?? 0) > 70) devyDelta -= 0.07
    }
  }
  if (devyDelta !== 0) {
    z += devyDelta
    drivers.push({ key: 'devy_signal', delta: devyDelta, note: 'High-end Devy profiles increase acceptance for future-minded builds.' })
  }

  const base = clamp01(sigmoid(z))

  const confidence: 'HIGH' | 'MODERATE' | 'LEARNING' =
    partnerSample >= 10 ? 'HIGH' : partnerSample >= 6 ? 'MODERATE' : 'LEARNING'

  return {
    base,
    final: base,
    confidence,
    drivers: drivers
      .slice()
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6),
  }
}
