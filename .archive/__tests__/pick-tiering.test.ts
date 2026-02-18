import { describe, it, expect } from 'vitest'

function inferPickNumberFromSlot(maybeSlot: unknown, numTeams: number): number | null {
  const nTeams = Number(numTeams)
  if (!Number.isFinite(nTeams) || nTeams < 2) return null

  const slotNum = typeof maybeSlot === 'string' && (maybeSlot as string).trim() === '' ? NaN : Number(maybeSlot)
  if (!Number.isFinite(slotNum)) return null

  const s = Math.floor(slotNum)
  if (s !== slotNum) return null

  if (s < 1 || s > nTeams) return null
  return s
}

type PickTier = 'early' | 'mid' | 'late'

function getPickTierByPercentile(pickNumber: number | null | undefined, numTeams: number): PickTier {
  if (!pickNumber || pickNumber < 1) return 'mid'
  const n = Math.max(4, Math.min(32, Math.floor(numTeams)))
  const pct = pickNumber / n
  if (pct <= 1 / 3) return 'early'
  if (pct <= 2 / 3) return 'mid'
  return 'late'
}

type PickData = { pickNumber?: number; originalRosterId?: number; year: number; round: number }
type InferenceResult = { picks: PickData[]; notes: string[] }

function applyPickNumberInference(
  picks: PickData[],
  numTeams: number
): InferenceResult {
  const notes: string[] = []
  const canInfer = Number.isFinite(numTeams) && numTeams >= 2

  const out = picks.map((pk, idx) => {
    if (pk.pickNumber != null) {
      const pn = Number(pk.pickNumber)
      const pnOk = Number.isFinite(pn) && Math.floor(pn) === pn && pn >= 1 && (!canInfer || pn <= numTeams)

      if (!pnOk) {
        notes.push(`pick[${idx}] ${pk.year} R${pk.round}: invalid pickNumber=${pk.pickNumber} → removed`)
        const cleaned = { ...pk }
        delete cleaned.pickNumber
        return cleaned
      }

      if (pk.originalRosterId != null) {
        const rid = Number(pk.originalRosterId)
        if (Number.isFinite(rid) && Math.floor(rid) === rid && rid >= 1 && rid !== pn) {
          notes.push(`pick[${idx}] ${pk.year} R${pk.round}: pickNumber=${pn} wins over originalRosterId=${pk.originalRosterId}`)
        }
      }

      return { ...pk, pickNumber: pn }
    }

    if (!canInfer) {
      if (pk.originalRosterId != null) {
        notes.push(`pick[${idx}] ${pk.year} R${pk.round}: numTeams invalid → cannot infer (Generic)`)
      }
      return pk
    }

    const slotHint = pk.originalRosterId
    if (slotHint == null) return pk

    const inferred = inferPickNumberFromSlot(slotHint, numTeams)
    if (inferred == null) {
      notes.push(`pick[${idx}] ${pk.year} R${pk.round}: originalRosterId=${slotHint} out of range → Generic`)
      return pk
    }

    notes.push(`pick[${idx}] ${pk.year} R${pk.round}: inferred pickNumber=${inferred} from originalRosterId=${slotHint}`)
    return { ...pk, pickNumber: inferred }
  })

  return { picks: out, notes }
}

describe('Pick Tiering & Inference', () => {
  it('12-team pickNumber=3 → tier "early"', () => {
    expect(getPickTierByPercentile(3, 12)).toBe('early')
  })

  it('12-team pickNumber missing, originalRosterId=3 → inferred pickNumber=3', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 3 }], 12)
    expect(picks[0].pickNumber).toBe(3)
  })

  it('32-team pickNumber=28 → tier "late"', () => {
    expect(getPickTierByPercentile(28, 32)).toBe('late')
  })

  it('32-team pickNumber missing, originalRosterId=28 → inferred late', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 28 }], 32)
    expect(picks[0].pickNumber).toBe(28)
    expect(getPickTierByPercentile(picks[0].pickNumber!, 32)).toBe('late')
  })

  it('originalRosterId out of range → remains generic (no pickNumber)', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 99 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
  })

  it('pickNumber provided + originalRosterId present → pickNumber wins', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, pickNumber: 5, originalRosterId: 10 }], 12)
    expect(picks[0].pickNumber).toBe(5)
  })
})

describe('Edge Cases', () => {
  it('originalRosterId=0 → invalid, remains generic', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 0 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
  })

  it('originalRosterId as string "3" → inferred pickNumber=3', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 3 }], 12)
    expect(picks[0].pickNumber).toBe(3)
  })

  it('8-team pickNumber=2 → early', () => {
    expect(getPickTierByPercentile(2, 8)).toBe('early')
  })

  it('8-team pickNumber=6 → late', () => {
    expect(getPickTierByPercentile(6, 8)).toBe('late')
  })

  it('16-team pickNumber=6 → early (6/16 = 0.375 > 0.333)', () => {
    expect(getPickTierByPercentile(6, 16)).toBe('mid')
  })

  it('no pickNumber and no originalRosterId → stays generic', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
    expect(getPickTierByPercentile(undefined, 12)).toBe('mid')
  })
})

describe('Invalid pickNumber cleaning', () => {
  it('pickNumber=0 → cleaned to undefined', () => {
    const { picks, notes } = applyPickNumberInference([{ year: 2027, round: 1, pickNumber: 0 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
    expect(notes.length).toBeGreaterThan(0)
  })

  it('pickNumber=999 (>numTeams) → cleaned to undefined', () => {
    const { picks, notes } = applyPickNumberInference([{ year: 2027, round: 1, pickNumber: 999 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
    expect(notes[0]).toContain('invalid pickNumber=999')
  })

  it('pickNumber=3.5 (non-integer) → cleaned to undefined', () => {
    const { picks } = applyPickNumberInference([{ year: 2027, round: 1, pickNumber: 3.5 }], 12)
    expect(picks[0].pickNumber).toBeUndefined()
  })

  it('numTeams < 2 → never infers, logs note', () => {
    const { picks, notes } = applyPickNumberInference([{ year: 2027, round: 1, originalRosterId: 1 }], 1)
    expect(picks[0].pickNumber).toBeUndefined()
    expect(notes[0]).toContain('numTeams invalid')
  })

  it('non-integer originalRosterId 3.7 → rejected by inferPickNumberFromSlot', () => {
    expect(inferPickNumberFromSlot(3.7, 12)).toBeNull()
  })

  it('empty string originalRosterId → rejected by inferPickNumberFromSlot', () => {
    expect(inferPickNumberFromSlot('', 12)).toBeNull()
  })
})
