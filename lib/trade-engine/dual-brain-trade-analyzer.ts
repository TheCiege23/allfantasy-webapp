import { openaiChatJson, parseJsonContentFromChatCompletion } from "@/lib/openai-client";
import { xaiChatJson, parseTextFromXaiChatCompletion } from "@/lib/xai-client";
import {
  PEER_REVIEW_PROMPT_CONTRACT,
  PEER_REVIEW_TEMPERATURE,
  PEER_REVIEW_MAX_TOKENS,
  validateAndParsePeerReview,
  mergePeerReviews,
  type PeerReviewProviderResult,
  type PeerReviewConsensus,
  TradeAnalysisSchema,
  validateAndParseAnalysis,
  scoreProviderResult,
  mergeAnalyses,
  type TradeAnalysis,
  type ProviderResult,
  type ConsensusAnalysis,
} from "./trade-analysis-schema";

export type TradeAiMode = "openai" | "grok" | "both" | "off";
export type TradeAiPrimary = "openai" | "grok";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface DualBrainRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  mode?: TradeAiMode;
  primary?: TradeAiPrimary;
  timeoutMs?: number;
}

export interface PeerReviewRequest {
  factLayerPrompt: string;
  dataGapsPrompt?: string;
  mode?: TradeAiMode;
  timeoutMs?: number;
}

function envStr(name: string, fallback: string): string {
  const v = (process.env[name] ?? "").trim();
  return v || fallback;
}

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? "", 10);
  return isNaN(v) ? fallback : v;
}

function resolveMode(explicit?: TradeAiMode): TradeAiMode {
  if (explicit) return explicit;
  const m = envStr("TRADE_AI_MODE", "both").toLowerCase();
  if (m === "off" || m === "openai" || m === "grok" || m === "both") return m as TradeAiMode;
  return "both";
}

function resolvePrimary(explicit?: TradeAiPrimary): TradeAiPrimary {
  if (explicit) return explicit;
  const p = envStr("TRADE_AI_PRIMARY", "openai").toLowerCase();
  return p === "grok" ? "grok" : "openai";
}

function resolveTimeout(explicit?: number): number {
  return explicit ?? envInt("TRADE_AI_TIMEOUT_MS", 15000);
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function parseJsonFromText(text: string | null): any {
  if (!text) return null;
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {}
    }
  }
  return null;
}

async function callProviderForPeerReview(
  provider: "openai" | "grok",
  messages: ChatMessage[],
  timeoutMs: number
): Promise<PeerReviewProviderResult> {
  const start = Date.now();
  try {
    let parsed: any = null;

    if (provider === "openai") {
      const result = await withTimeout(
        openaiChatJson({ messages, temperature: PEER_REVIEW_TEMPERATURE, maxTokens: PEER_REVIEW_MAX_TOKENS }),
        timeoutMs,
        "OpenAI"
      );
      if (!result.ok) {
        return { provider, verdict: null, raw: null, latencyMs: Date.now() - start, error: result.details, schemaValid: false };
      }
      parsed = parseJsonContentFromChatCompletion(result.json);
    } else {
      const result = await withTimeout(
        xaiChatJson({
          messages,
          temperature: PEER_REVIEW_TEMPERATURE,
          maxTokens: PEER_REVIEW_MAX_TOKENS,
          tools: [
            { type: 'web_search', user_location_country: 'US' },
            { type: 'x_search' },
          ],
        }),
        timeoutMs,
        "Grok"
      );
      if (!result.ok) {
        return { provider, verdict: null, raw: null, latencyMs: Date.now() - start, error: result.details, schemaValid: false };
      }
      const text = parseTextFromXaiChatCompletion(result.json);
      parsed = parseJsonFromText(text);
    }

    const latencyMs = Date.now() - start;
    const { valid, verdict } = validateAndParsePeerReview(parsed);

    return { provider, verdict, raw: parsed, latencyMs, schemaValid: valid };
  } catch (e: any) {
    return { provider, verdict: null, raw: null, latencyMs: Date.now() - start, error: String(e?.message || e), schemaValid: false };
  }
}

export async function runPeerReviewAnalysis(
  req: PeerReviewRequest
): Promise<PeerReviewConsensus | null> {
  const mode = resolveMode(req.mode);
  const timeoutMs = resolveTimeout(req.timeoutMs);

  if (mode === "off") return null;

  const systemPrompt = `${PEER_REVIEW_PROMPT_CONTRACT}${req.dataGapsPrompt ? `\n\n${req.dataGapsPrompt}` : ""}`;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: req.factLayerPrompt },
  ];

  const results: PeerReviewProviderResult[] = [];

  if (mode === "both") {
    const [openaiResult, grokResult] = await Promise.allSettled([
      callProviderForPeerReview("openai", messages, timeoutMs),
      callProviderForPeerReview("grok", messages, timeoutMs),
    ]);

    results.push(
      openaiResult.status === "fulfilled"
        ? openaiResult.value
        : { provider: "openai", verdict: null, raw: null, latencyMs: 0, error: String(openaiResult.reason), schemaValid: false }
    );
    results.push(
      grokResult.status === "fulfilled"
        ? grokResult.value
        : { provider: "grok", verdict: null, raw: null, latencyMs: 0, error: String(grokResult.reason), schemaValid: false }
    );
  } else {
    const primary: "openai" | "grok" = mode === "openai" ? "openai" : "grok";
    const fallback: "openai" | "grok" = primary === "openai" ? "grok" : "openai";

    const result = await callProviderForPeerReview(primary, messages, timeoutMs);
    results.push(result);

    if (!result.verdict) {
      console.warn(`[peer-review] ${primary} failed, attempting ${fallback} fallback`);
      const fb = await callProviderForPeerReview(fallback, messages, timeoutMs);
      results.push(fb);
    }
  }

  const consensus = mergePeerReviews(results);

  if (consensus) {
    console.log(
      `[peer-review] ${consensus.meta.consensusMethod} | verdict=${consensus.verdict} conf=${consensus.confidence}% | adj=${consensus.meta.confidenceAdjustment}`
    );
  }

  return consensus;
}

async function callOpenAI(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number
): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(
      openaiChatJson({ messages, temperature, maxTokens }),
      timeoutMs,
      "OpenAI"
    );

    const latencyMs = Date.now() - start;

    if (!result.ok) {
      return {
        provider: "openai",
        analysis: null,
        raw: null,
        latencyMs,
        error: result.details,
        schemaValid: false,
        confidenceScore: 0,
      };
    }

    const parsed = parseJsonContentFromChatCompletion(result.json);
    const { valid, analysis } = validateAndParseAnalysis(parsed);

    const providerResult: ProviderResult = {
      provider: "openai",
      analysis,
      raw: parsed,
      latencyMs,
      schemaValid: valid,
      confidenceScore: 0,
    };
    providerResult.confidenceScore = scoreProviderResult(providerResult);
    return providerResult;
  } catch (e: any) {
    return {
      provider: "openai",
      analysis: null,
      raw: null,
      latencyMs: Date.now() - start,
      error: String(e?.message || e),
      schemaValid: false,
      confidenceScore: 0,
    };
  }
}

async function callGrok(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
  timeoutMs: number
): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const result = await withTimeout(
      xaiChatJson({ messages, temperature, maxTokens }),
      timeoutMs,
      "Grok"
    );

    const latencyMs = Date.now() - start;

    if (!result.ok) {
      return {
        provider: "grok",
        analysis: null,
        raw: null,
        latencyMs,
        error: result.details,
        schemaValid: false,
        confidenceScore: 0,
      };
    }

    const text = parseTextFromXaiChatCompletion(result.json);
    const parsed = parseJsonFromText(text);
    const { valid, analysis } = validateAndParseAnalysis(parsed);

    const providerResult: ProviderResult = {
      provider: "grok",
      analysis,
      raw: parsed,
      latencyMs,
      schemaValid: valid,
      confidenceScore: 0,
    };
    providerResult.confidenceScore = scoreProviderResult(providerResult);
    return providerResult;
  } catch (e: any) {
    return {
      provider: "grok",
      analysis: null,
      raw: null,
      latencyMs: Date.now() - start,
      error: String(e?.message || e),
      schemaValid: false,
      confidenceScore: 0,
    };
  }
}

export async function runDualBrainTradeAnalysis(
  req: DualBrainRequest
): Promise<ConsensusAnalysis | null> {
  const mode = resolveMode(req.mode);
  const primary = resolvePrimary(req.primary);
  const timeoutMs = resolveTimeout(req.timeoutMs);
  const temperature = req.temperature ?? 0.45;
  const maxTokens = req.maxTokens ?? 1500;

  if (mode === "off") {
    return null;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: req.systemPrompt },
    { role: "user", content: req.userPrompt },
  ];

  const results: ProviderResult[] = [];

  if (mode === "both") {
    const [openaiResult, grokResult] = await Promise.allSettled([
      callOpenAI(messages, temperature, maxTokens, timeoutMs),
      callGrok(messages, temperature, maxTokens, timeoutMs),
    ]);

    if (openaiResult.status === "fulfilled") results.push(openaiResult.value);
    else
      results.push({
        provider: "openai",
        analysis: null,
        raw: null,
        latencyMs: 0,
        error: String(openaiResult.reason),
        schemaValid: false,
        confidenceScore: 0,
      });

    if (grokResult.status === "fulfilled") results.push(grokResult.value);
    else
      results.push({
        provider: "grok",
        analysis: null,
        raw: null,
        latencyMs: 0,
        error: String(grokResult.reason),
        schemaValid: false,
        confidenceScore: 0,
      });
  } else if (mode === "openai") {
    const result = await callOpenAI(messages, temperature, maxTokens, timeoutMs);
    results.push(result);

    if (!result.analysis) {
      console.warn("[dual-brain] OpenAI failed, attempting Grok fallback");
      const fallback = await callGrok(messages, temperature, maxTokens, timeoutMs);
      results.push(fallback);
    }
  } else if (mode === "grok") {
    const result = await callGrok(messages, temperature, maxTokens, timeoutMs);
    results.push(result);

    if (!result.analysis) {
      console.warn("[dual-brain] Grok failed, attempting OpenAI fallback");
      const fallback = await callOpenAI(messages, temperature, maxTokens, timeoutMs);
      results.push(fallback);
    }
  }

  return mergeAnalyses(results, primary);
}
