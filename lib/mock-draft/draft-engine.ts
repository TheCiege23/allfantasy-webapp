export type DraftType = 'snake' | 'linear' | 'auction'

interface DraftPick {
  round: number
  pick: number
  overall: number
  playerName: string
  position: string
  team: string
  manager: string
  isUser?: boolean
  [key: string]: any
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
