export type DraftType = 'snake' | 'linear' | 'auction'

export type DraftPhase = 'pre_draft' | 'live_draft' | 'post_draft'
export type AuctionSubPhase = 'nomination_open' | 'bidding_open' | 'bid_settle'

export interface DraftPick {
  round: number
  pick: number
  overall: number
  playerName: string
  position: string
  team: string
  manager: string
  isUser?: boolean
  value?: number
  bid?: number
  [key: string]: any
}

export interface DraftEvent {
  type: 'pick' | 'trade' | 'nomination' | 'bid' | 'pass' | 'undo' | 'pause' | 'resume'
  timestamp: number
  overall?: number
  manager: string
  payload: Record<string, any>
}

export interface DraftSessionSnapshot {
  phase: DraftPhase
  auctionSubPhase?: AuctionSubPhase
  draftType: DraftType
  currentOverall: number
  totalPicks: number
  numTeams: number
  rounds: number
  picks: DraftPick[]
  draftedPlayerNames: Set<string>
  managerBudgets?: Map<string, number>
}

interface ValidationConstraints {
  strict?: boolean
  draftType?: DraftType
  expectedPicks?: number
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function resolveSlot(opts: {
  overall: number
  numTeams: number
  draftType: DraftType
}): { round: number; pick: number } {
  const { overall, numTeams, draftType } = opts
  const round = Math.ceil(overall / numTeams)
  const posInRound = ((overall - 1) % numTeams) + 1

  if (draftType === 'snake') {
    const isReversed = round % 2 === 0
    const pick = isReversed ? numTeams - posInRound + 1 : posInRound
    return { round, pick }
  }

  return { round, pick: posInRound }
}

export function getManagerAtPick(opts: {
  overall: number
  numTeams: number
  draftType: DraftType
  draftOrder: string[]
}): string {
  const { overall, numTeams, draftType, draftOrder } = opts
  const { pick } = resolveSlot({ overall, numTeams, draftType })
  return draftOrder[pick - 1] || `Team ${pick}`
}

export function buildDraftSlots(opts: {
  numTeams: number
  rounds: number
  draftType: DraftType
  draftOrder: string[]
}): Array<{ overall: number; round: number; pick: number; manager: string }> {
  const { numTeams, rounds, draftType, draftOrder } = opts
  const totalPicks = numTeams * rounds
  const slots: Array<{ overall: number; round: number; pick: number; manager: string }> = []

  for (let overall = 1; overall <= totalPicks; overall++) {
    const { round, pick } = resolveSlot({ overall, numTeams, draftType })
    slots.push({
      overall,
      round,
      pick,
      manager: draftOrder[pick - 1] || `Team ${pick}`,
    })
  }

  return slots
}

export function isPlayerDrafted(name: string, draftedNames: Set<string>): boolean {
  return draftedNames.has(name.toLowerCase().trim())
}

export function addDraftedPlayer(name: string, draftedNames: Set<string>): Set<string> {
  const updated = new Set(draftedNames)
  updated.add(name.toLowerCase().trim())
  return updated
}

export interface AuctionBudgetState {
  totalBudget: number
  spent: number
  remainingSlots: number
  minimumBid: number
}

export function computeMaxBid(state: AuctionBudgetState): number {
  const remaining = state.totalBudget - state.spent
  if (remaining <= 0 || state.remainingSlots <= 0) return 0
  const reserveForRemainingSlots = Math.max(0, (state.remainingSlots - 1) * state.minimumBid)
  return Math.max(state.minimumBid, remaining - reserveForRemainingSlots)
}

export function isLegalBid(bid: number, state: AuctionBudgetState): boolean {
  if (state.remainingSlots <= 0) return false
  if (bid < state.minimumBid) return false
  return bid <= computeMaxBid(state)
}

export function createAuctionBudget(opts: {
  totalBudget?: number
  rosterSlots: number
  minimumBid?: number
}): AuctionBudgetState {
  return {
    totalBudget: opts.totalBudget ?? 200,
    spent: 0,
    remainingSlots: opts.rosterSlots,
    minimumBid: opts.minimumBid ?? 1,
  }
}

export function applyAuctionWin(state: AuctionBudgetState, winningBid: number): AuctionBudgetState {
  return {
    ...state,
    spent: state.spent + winningBid,
    remainingSlots: Math.max(0, state.remainingSlots - 1),
  }
}

export interface RosterConstraint {
  position: string
  min: number
  max: number
}

const DEFAULT_ROSTER_CONSTRAINTS: RosterConstraint[] = [
  { position: 'QB', min: 1, max: 4 },
  { position: 'RB', min: 2, max: 8 },
  { position: 'WR', min: 2, max: 8 },
  { position: 'TE', min: 1, max: 4 },
  { position: 'K', min: 0, max: 2 },
  { position: 'DEF', min: 0, max: 2 },
]

export function validateRosterConstraints(opts: {
  picks: DraftPick[]
  manager: string
  constraints?: RosterConstraint[]
  strict?: boolean
  draftComplete?: boolean
}): { valid: boolean; violations: string[] } {
  const { picks, manager, strict = true, draftComplete = false } = opts
  const constraints = opts.constraints || DEFAULT_ROSTER_CONSTRAINTS
  const violations: string[] = []

  const mgrPicks = picks.filter(p => p.manager === manager)
  const counts: Record<string, number> = {}
  for (const p of mgrPicks) {
    const pos = p.position?.toUpperCase() || 'UNKNOWN'
    counts[pos] = (counts[pos] || 0) + 1
  }

  for (const c of constraints) {
    const count = counts[c.position] || 0
    if (strict && count > c.max) {
      violations.push(`${manager}: ${c.position} count ${count} exceeds max ${c.max}`)
    }
    if (draftComplete && count < c.min) {
      violations.push(`${manager}: ${c.position} count ${count} below min ${c.min}`)
    }
  }

  return { valid: violations.length === 0, violations }
}

export function getNextOnClock(opts: {
  currentOverall: number
  numTeams: number
  draftType: DraftType
  draftOrder: string[]
  totalPicks: number
}): { overall: number; manager: string } | null {
  const next = opts.currentOverall + 1
  if (next > opts.totalPicks) return null
  return {
    overall: next,
    manager: getManagerAtPick({
      overall: next,
      numTeams: opts.numTeams,
      draftType: opts.draftType,
      draftOrder: opts.draftOrder,
    }),
  }
}

export function rewindToPick(events: DraftEvent[], targetOverall: number): DraftEvent[] {
  return events.filter(e => {
    if (e.type === 'pick' && e.overall != null) {
      return e.overall <= targetOverall
    }
    if (e.type === 'nomination' || e.type === 'bid') {
      return (e.payload?.overall ?? 0) <= targetOverall
    }
    return true
  })
}

export function rebuildSnapshotFromEvents(opts: {
  events: DraftEvent[]
  numTeams: number
  rounds: number
  draftType: DraftType
}): { picks: DraftPick[]; draftedNames: Set<string>; currentOverall: number } {
  const picks: DraftPick[] = []
  const draftedNames = new Set<string>()
  let currentOverall = 0

  for (const event of opts.events) {
    if (event.type === 'pick') {
      const pick = event.payload as DraftPick
      picks.push(pick)
      if (pick.playerName) draftedNames.add(pick.playerName.toLowerCase().trim())
      if (pick.overall > currentOverall) currentOverall = pick.overall
    }
  }

  return { picks, draftedNames, currentOverall }
}

export function summarizeDraftValidation(opts: {
  picks: DraftPick[]
  constraints?: ValidationConstraints
}): ValidationResult {
  const { picks, constraints } = opts
  const strict = constraints?.strict ?? true
  const draftType = constraints?.draftType ?? 'snake'
  const isAuction = draftType === 'auction'
  const errors: string[] = []
  const warnings: string[] = []

  if (!picks || picks.length === 0) {
    errors.push('No picks found in draft results')
    return { valid: false, errors, warnings }
  }

  if (constraints?.expectedPicks && picks.length < constraints.expectedPicks * 0.8) {
    warnings.push(`Draft has ${picks.length} picks but expected ~${constraints.expectedPicks}`)
  }

  const playersSeen = new Map<string, number>()
  for (const pick of picks) {
    const key = pick.playerName?.toLowerCase().trim()
    if (!key) {
      warnings.push(`Pick #${pick.overall || 0} has no player name`)
      continue
    }
    const prev = playersSeen.get(key)
    if (prev !== undefined) {
      const msg = `Duplicate player: "${pick.playerName}" drafted at pick #${prev} and #${pick.overall || 0}`
      if (strict) {
        errors.push(msg)
      } else {
        warnings.push(msg)
      }
    } else {
      playersSeen.set(key, pick.overall || 0)
    }
  }

  if (!isAuction) {
    const overallsSeen = new Set<number>()
    for (const pick of picks) {
      if (pick.overall != null && overallsSeen.has(pick.overall)) {
        if (strict) {
          errors.push(`Duplicate overall pick number: ${pick.overall}`)
        } else {
          warnings.push(`Duplicate overall pick number: ${pick.overall}`)
        }
      }
      if (pick.overall != null) overallsSeen.add(pick.overall)
    }
  }

  for (const pick of picks) {
    if (!pick.position || !pick.team) {
      warnings.push(`Pick #${pick.overall || 0} "${pick.playerName}" missing position or team`)
    }
    if (!pick.manager) {
      warnings.push(`Pick #${pick.overall || 0} missing manager assignment`)
    }
  }

  if (!isAuction) {
    const rounds = picks.map(p => p.round).filter(r => r != null)
    if (rounds.length > 0) {
      const maxRound = Math.max(...rounds)
      const managers = [...new Set(picks.map(p => p.manager).filter(Boolean))]
      for (const mgr of managers) {
        const mgrPicks = picks.filter(p => p.manager === mgr)
        if (mgrPicks.length < maxRound) {
          warnings.push(`${mgr} has ${mgrPicks.length} picks but expected ${maxRound}`)
        }
      }
    }
  }

  const hasUserPick = picks.some(p => p.isUser)
  if (!hasUserPick) {
    warnings.push('No picks marked as user picks (isUser: true)')
  }

  return { valid: errors.length === 0, errors, warnings }
}
