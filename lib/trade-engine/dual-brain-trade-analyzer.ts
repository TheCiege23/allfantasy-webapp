import { openaiChatJson, parseJsonContentFromChatCompletion } from "@/lib/openai-client";
import { xaiChatJson, parseTextFromXaiChatCompletion } from "@/lib/xai-client";
import {
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
    let parsed: any = null;
    if (text) {
      try {
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {}
        }
      }
    }

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

function checkContradictions(results: ProviderResult[]): string[] {
  const contradictions: string[] = [];
  const valid = results.filter((r) => r.analysis);

  if (valid.length < 2) return contradictions;

  const [a, b] = valid;
  const aWinner = a.analysis!.winner;
  const bWinner = b.analysis!.winner;

  const isTeamAWin = (w: string) => w === "Team A" || w === "Slight edge to Team A";
  const isTeamBWin = (w: string) => w === "Team B" || w === "Slight edge to Team B";

  if (
    (isTeamAWin(aWinner) && isTeamBWin(bWinner)) ||
    (isTeamBWin(aWinner) && isTeamAWin(bWinner))
  ) {
    contradictions.push(
      `Winner disagreement: ${a.provider} says "${aWinner}", ${b.provider} says "${bWinner}"`
    );
  }

  const confDiff = Math.abs(a.analysis!.confidence - b.analysis!.confidence);
  if (confDiff > 25) {
    contradictions.push(
      `Confidence gap: ${a.provider}=${a.analysis!.confidence}, ${b.provider}=${b.analysis!.confidence} (Δ${confDiff})`
    );
  }

  return contradictions;
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

  const contradictions = checkContradictions(results);
  if (contradictions.length > 0) {
    console.log("[dual-brain] Contradictions detected:", contradictions);
  }

  const consensus = mergeAnalyses(results, primary);

  if (consensus && contradictions.length > 0) {
    consensus.meta.providers = consensus.meta.providers.map((p) => ({
      ...p,
      contradictions,
    })) as any;
  }

  return consensus;
}
