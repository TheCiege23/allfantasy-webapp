// lib/trade-engine/index.ts
export { runTradeEngine } from "./trade-engine";
export { attachNeedsSurplus } from "./value-context-service";
export { buildLeagueIntelligence } from "./league-intelligence";

export { detectSurplusAssets, buildTradablePool } from "./surplusDetection";
export { buildCheapestFairOfferPackages } from "./packageBuilder";
export { applyParityGuardrailsToCandidates, computeTpiByRosterId } from "./guardrails";

export type {
  GuardrailsConfig,
  GuardrailReasonCode,
  GuardrailCandidateDebug,
} from "./guardrails";

export { guardrailReasonToCopy, guardrailCodesToUiList } from "./guardrailCopy";

export { enrichTradeCandidateWithGrok } from "./grok-enrichment";
export { runGrokAssistOnTradeEngineOutput } from "./grok-ai-layer";
export { runAssistOrchestrator } from "./ai-assist-orchestrator";
export type { AiProviderMode, RunAssistOptions, AssistSnapshotLike } from "./ai-assist-orchestrator";

export { convertSleeperToAssets } from "./convertSleeperToAssets";

export type {
  Asset,
  TradeCandidate,
  TradeEngineOutput,
  LeagueIntelligence,
} from "./types";
