export type {
  WaiverSide,
  WaiverPlayerRef,
  WaiverSuggestionAI,
  WaiverSuggestion,
} from "./waiver-types";

export { enrichWaiverSuggestionWithGrok } from "./grok-waiver-enrichment";
export { runGrokAssistOnWaiverSuggestions } from "./grok-waiver-ai-layer";

export {
  enrichRawWaiverSuggestionsWithGrok,
  mapRawSuggestionToWaiverSuggestion,
} from "./waiver-grok-adapter";
export type { PlayerLookup, WaiverGrokAdapterOptions } from "./waiver-grok-adapter";

export { scoreWaiverCandidates } from "./waiver-scoring";
export type {
  WaiverCandidate,
  WaiverRosterPlayer,
  WaiverScoringContext,
  WaiverDimensions,
  WaiverDriverId,
  WaiverDriver,
  ScoredWaiverTarget,
} from "./waiver-scoring";

export { computeTeamNeeds, deriveGoalFromContext } from "./team-needs";
export type {
  SlotNeed,
  ByeWeekCluster,
  PositionalDepth,
  DropRiskOfRegret,
  TeamNeedsMap,
  UserGoal,
} from "./team-needs";
