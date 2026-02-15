// lib/ai-external/grok.ts
import type { GrokChatRequest, GrokChatResponse, GrokEnrichmentRequest, GrokEnrichmentResult } from "./grok-types";
import { validateAndSanitizeGrokJson } from "./grok-safety";

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function buildSystemPrompt(kind: GrokEnrichmentRequest["kind"]): string {
  return [
    "You are an assistant that produces PRESENTATION-ONLY metadata for a fantasy sports app.",
    "You must NOT propose trades, waivers, or decisions.",
    "You must NOT output any numbers (no player values, ratios, scores, ranks, percentages, projections, or counts).",
    "You must NOT output any instructions like 'trade', 'accept', 'reject', 'drop', 'add', 'start', 'bench'.",
    "You may only output narrative language, tags, and optional evidence links.",
    "",
    "Output MUST be a single JSON object, no surrounding text.",
    "Allowed keys only: confidence, narrative, messageTemplate, tags, evidenceLinks.",
    "confidence must be one of: high, medium, low.",
    "narrative is an array of short bullet strings (no numbers).",
    "messageTemplate is a short message the user could send (no directives).",
    "tags is an array of short strings.",
    "evidenceLinks is an array of {label, url} (urls only if you are confident they are legitimate).",
    "",
    `Your task kind: ${kind}`,
  ].join("\n");
}

function buildUserPrompt(req: GrokEnrichmentRequest): string {
  return JSON.stringify(
    {
      kind: req.kind,
      context: req.context ?? {},
      payload: req.payload ?? {},
      rules: {
        doNotOutputNumbers: true,
        doNotGiveDirectives: true,
        outputJsonOnly: true,
      },
    },
    null,
    2
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export type GrokClientConfig = {
  baseUrl: string;
  apiKey: string;
  model?: string;
  timeoutMs?: number;
};

export function getGrokConfigFromEnv(): GrokClientConfig | null {
  const baseUrl = env("GROK_BASE_URL");
  const apiKey = env("GROK_API_KEY") || env("XAI_API_KEY");
  const model = env("GROK_MODEL");
  if (!baseUrl || !apiKey) return null;
  return {
    baseUrl,
    apiKey,
    model: model || undefined,
    timeoutMs: Number(env("GROK_TIMEOUT_MS") || "12000"),
  };
}

export async function grokEnrich(
  request: GrokEnrichmentRequest,
  cfg?: Partial<GrokClientConfig>
): Promise<GrokEnrichmentResult> {
  const envCfg = getGrokConfigFromEnv();
  const finalCfg: GrokClientConfig | null = envCfg
    ? { ...envCfg, ...cfg, baseUrl: cfg?.baseUrl ?? envCfg.baseUrl, apiKey: cfg?.apiKey ?? envCfg.apiKey }
    : (cfg?.baseUrl && cfg?.apiKey
        ? { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, timeoutMs: cfg.timeoutMs ?? 12000 }
        : null);

  if (!finalCfg) {
    return {
      ok: false,
      kind: request.kind,
      confidence: "low",
      error: "Grok not configured. Set GROK_BASE_URL and GROK_API_KEY.",
    };
  }

  const body: GrokChatRequest = {
    model: finalCfg.model,
    temperature: 0.2,
    max_tokens: 550,
    messages: [
      { role: "system", content: buildSystemPrompt(request.kind) },
      { role: "user", content: buildUserPrompt(request) },
    ],
  };

  try {
    const res = await fetchWithTimeout(
      finalCfg.baseUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${finalCfg.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      finalCfg.timeoutMs ?? 12000
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        kind: request.kind,
        confidence: "low",
        error: `Grok HTTP ${res.status}: ${text?.slice(0, 300) || "Request failed"}`,
      };
    }

    const data = (await res.json()) as GrokChatResponse;
    const content = data?.choices?.[0]?.message?.content ?? "";

    return validateAndSanitizeGrokJson({ kind: request.kind, rawText: content });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Unknown error";
    return {
      ok: false,
      kind: request.kind,
      confidence: "low",
      error: `Grok call failed: ${msg}`,
    };
  }
}
