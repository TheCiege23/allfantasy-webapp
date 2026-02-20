import type { ADPEntry } from '@/lib/adp-data'

type AdjustmentRecord = {
  player: string
  originalAdp: number
  adjustedAdp: number
  reason: string
}

type AdjustedResult = {
  entries: ADPEntry[]
  adjustments: AdjustmentRecord[]
  sourcesUsed: string[]
}

type AdjusterOptions = {
  isDynasty: boolean
}

export async function applyRealtimeAdpAdjustments(
  adp: ADPEntry[],
  options: AdjusterOptions
): Promise<AdjustedResult> {
  const adjustments: AdjustmentRecord[] = []
  const sourcesUsed: string[] = ['base-adp']

  const entries = adp.map((entry) => {
    let adjusted = entry.adp
    let reason = ''

    if (entry.adpTrend !== null && entry.adpTrend !== 0) {
      const trendShift = entry.adpTrend * 0.3
      adjusted -= trendShift
      reason = `Trend adjustment (${entry.adpTrend > 0 ? 'rising' : 'falling'})`
      if (!sourcesUsed.includes('adp-trend')) sourcesUsed.push('adp-trend')
    }

    if (entry.age !== null) {
      if (options.isDynasty && entry.age >= 30) {
        adjusted += 3
        reason = reason ? `${reason} + age penalty (dynasty)` : 'Age penalty (dynasty, 30+)'
        if (!sourcesUsed.includes('age-model')) sourcesUsed.push('age-model')
      } else if (!options.isDynasty && entry.age !== null && entry.age <= 23) {
        adjusted += 1.5
        reason = reason ? `${reason} + youth discount (redraft)` : 'Youth discount (redraft, ≤23)'
        if (!sourcesUsed.includes('age-model')) sourcesUsed.push('age-model')
      }
    }

    if (entry.value !== null) {
      const valueSignal = (entry.value - 2500) / 5000
      if (Math.abs(valueSignal) > 0.1) {
        adjusted -= valueSignal * 2
        reason = reason ? `${reason} + value signal` : `Value signal (${valueSignal > 0 ? 'premium' : 'discount'})`
        if (!sourcesUsed.includes('value-model')) sourcesUsed.push('value-model')
      }
    }

    if (Math.abs(adjusted - entry.adp) > 0.1) {
      adjustments.push({
        player: entry.name,
        originalAdp: entry.adp,
        adjustedAdp: Math.round(adjusted * 10) / 10,
        reason,
      })
    }

    return { ...entry, adp: Math.max(1, Math.round(adjusted * 10) / 10) }
  })

  entries.sort((a, b) => a.adp - b.adp)

  return { entries, adjustments, sourcesUsed }
}
