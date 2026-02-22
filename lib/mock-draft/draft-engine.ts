export type DraftType = 'snake' | 'linear' | 'auction'

export type AutopickMode = 'queue-first' | 'bpa' | 'need-based'

export interface DraftSettings {
  draftType: DraftType
  rounds: number
  teams: number
  rosterSlots?: number
  minimumBid?: number
  budget?: number
  minBidIncrement?: number
  casualMode?: boolean
}

export interface DraftPickLike {
  overall: number
  round: number
  pick: number
  playerName: string
  position: string
  manager: string
}

export interface RosterConstraints {
  strict: boolean
  maxPerPosition?: Partial<Record<'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF', number>>
}

const DEFAULT_MAX: Required<RosterConstraints>['maxPerPosition'] = {
  QB: 3,
  RB: 6,
  WR: 6,
  TE: 3,
  K: 1,
  DEF: 1,
}

export function getPickSlot(round: number, slot: number, teams: number, draftType: DraftType): number {
  if (draftType === 'linear') return slot
  if (draftType === 'snake') {
    const evenRound = round % 2 === 0
    return evenRound ? teams - slot + 1 : slot
  }
  return slot
}

export function validateUniquePlayer(picks: DraftPickLike[]): string[] {
  const seen = new Set<string>()
  const errors: string[] = []
  for (const pick of picks) {
    const key = pick.playerName.trim().toLowerCase()
    if (!key) {
      errors.push(`Pick #${pick.overall} is missing player name`)
      continue
    }
    if (seen.has(key)) {
      errors.push(`Duplicate draft violation: ${pick.playerName} selected more than once`)
      continue
    }
    seen.add(key)
  }
  return errors
}

export function validateRosterConstraints(
  picks: DraftPickLike[],
  constraints: RosterConstraints,
): { errors: string[]; warnings: string[] } {
  const limits = { ...DEFAULT_MAX, ...(constraints.maxPerPosition || {}) }
  const errors: string[] = []
  const warnings: string[] = []
  const byManager = new Map<string, Record<string, number>>()

  for (const pick of picks) {
    const counts = byManager.get(pick.manager) || {}
    counts[pick.position] = (counts[pick.position] || 0) + 1
    byManager.set(pick.manager, counts)

    const max = limits[pick.position as keyof typeof limits]
    if (max !== undefined && counts[pick.position] > max) {
      const msg = `${pick.manager} exceeded ${pick.position} cap (${counts[pick.position]}/${max})`
      if (constraints.strict) {
        errors.push(msg)
      } else {
        warnings.push(msg)
      }
    }
  }

  return { errors, warnings }
}

export function getAuctionMaxBid(params: { budget: number; rosterSlotsRemaining: number; minimumBid?: number }): number {
  const minimumBid = params.minimumBid ?? 1
  if (params.budget <= 0 || params.rosterSlotsRemaining <= 0) return 0
  const reserveForOpenSlots = Math.max(0, params.rosterSlotsRemaining - 1) * minimumBid
  return Math.max(minimumBid, params.budget - reserveForOpenSlots)
}

export function canPlaceAuctionBid(params: {
  budget: number
  bid: number
  rosterSlotsRemaining: number
  minimumBid?: number
}): boolean {
  if (params.rosterSlotsRemaining <= 0) return false
  const maxBid = getAuctionMaxBid(params)
  return params.bid >= (params.minimumBid ?? 1) && params.bid <= maxBid
}

export function summarizeDraftValidation(params: {
  picks: DraftPickLike[]
  constraints: RosterConstraints
}): { valid: boolean; errors: string[]; warnings: string[] } {
  const dupErrors = validateUniquePlayer(params.picks)
  const roster = validateRosterConstraints(params.picks, params.constraints)
  const errors = [...dupErrors, ...roster.errors]
  return { valid: errors.length === 0, errors, warnings: roster.warnings }
}
