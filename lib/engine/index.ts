export type {
  EngineLeagueContext,
  EnginePlayerState,
  EngineAsset,
  EngineManagerProfile,
  EngineContext,
  EngineOutput,
  EngineCapabilities,
  ConfidenceState,
  TeamPhase,
  ArchetypeId,
  InjuryStatus,
  DepthRole,
  ScoringFormat,
  EngineAssetType,
} from './types'

export { ENGINE_VERSION } from './types'

export {
  normalizeLeagueContext,
  normalizePlayerState,
  normalizeManagerProfile,
  normalizeAssetFromPlayer,
  normalizeAssetFromPick,
  buildEngineContext,
} from './normalize'

export {
  resolveCapabilities,
  resolveConfidence,
  gracefulDowngrade,
  type FeatureFlags,
} from './capabilities'

export {
  computeScoringAdjustments,
  adjustValueForScoring,
  scoringFormatLabel,
  type ScoringAdjustment,
} from './scoring'

export {
  computePositionalScarcity,
  scarcityAdjustedValue,
  computeReplacementLevel,
  type PositionalScarcity,
} from './scarcity'

export {
  classifyTeamPhase,
  classifyAllTeams,
  phaseValueModifier,
  type ContenderClassification,
} from './contender'

export {
  classifyArchetype,
  classifyAllArchetypes,
  archetypeAcceptanceModifier,
  type ArchetypeClassification,
} from './archetypes'

export {
  computeLDIAcceptance,
  type LDIAcceptInput,
  type LDIAcceptResult,
  type AcceptDriver,
} from './ldi-accept'

import type { EngineContext, EngineOutput, EngineCapabilities, ConfidenceState } from './types'
import { ENGINE_VERSION } from './types'
import { resolveCapabilities, resolveConfidence, gracefulDowngrade, type FeatureFlags } from './capabilities'
import { computeScoringAdjustments, type ScoringAdjustment } from './scoring'
import { computePositionalScarcity, type PositionalScarcity } from './scarcity'
import { classifyAllTeams, type ContenderClassification } from './contender'
import { classifyAllArchetypes, type ArchetypeClassification } from './archetypes'

export interface EngineComputedContext {
  scoring: ScoringAdjustment
  scarcity: Record<string, PositionalScarcity>
  teamPhases: Record<number, ContenderClassification>
  archetypes: Record<number, ArchetypeClassification>
}

export function computeEngineContext(
  ctx: EngineContext,
  flags: Partial<FeatureFlags> = {},
  dataQuality: { tradeCount30d: number; rosterCompleteness: number } = { tradeCount30d: 0, rosterCompleteness: 0.5 }
): EngineOutput<EngineComputedContext> {
  const start = Date.now()
  const capabilities = resolveCapabilities(ctx, flags)
  const confidence = resolveConfidence(capabilities, dataQuality)

  const allPlayers = Object.values(ctx.managers)
    .flatMap(m => m.assets)
    .filter(a => a.type === 'player' && a.player)
    .map(a => a.player!)

  const scoring = gracefulDowngrade(
    'scoring',
    capabilities,
    () => computeScoringAdjustments(ctx.league),
    { baseMultiplier: 1, tepMultiplier: 1, sfMultiplier: 1, idpMultiplier: 1, positionMultiplier: {} }
  )

  const scarcity = gracefulDowngrade(
    'scarcity',
    capabilities,
    () => computePositionalScarcity(ctx.league, allPlayers),
    {}
  )

  const teamPhases = gracefulDowngrade(
    'contenderClassifier',
    capabilities,
    () => classifyAllTeams(ctx.managers, ctx.league),
    {}
  )

  const archetypes = gracefulDowngrade(
    'managerArchetypes',
    capabilities,
    () => classifyAllArchetypes(ctx.managers),
    {}
  )

  return {
    data: { scoring, scarcity, teamPhases, archetypes },
    capabilities,
    confidence,
    meta: {
      computedAt: Date.now(),
      engineVersion: ENGINE_VERSION,
      computeTimeMs: Date.now() - start,
    },
  }
}
