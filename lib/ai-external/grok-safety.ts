// lib/ai-external/grok-safety.ts
import type { GrokEnrichmentResult, GrokEnrichmentKind } from "./grok-types";

// --- Numeric safety helpers ---

const ALLOWED_NUMBER_PATTERNS = [
  /\bweek\s+\d+\b/i,
  /\bwr\d+\b/i,
  /\brb\d+\b/i,
  /\bte\d+\b/i,
  /\bqb\d+\b/i,
  /\bidp\d*\b/i,
  /\bround\s+\d+\b/i,
  /\b\d+(st|nd|rd|th)\s+round\b/i,
  /\b\d{4}\b/, // seasons like 2024
  /\b\d+\s*year[- ]old\b/i,
  /\bage\s+\d+\b/i,
];

const BLOCKED_NUMBER_PATTERNS = [
  /%/,
  /\bvalue\b/i,
  /\bratio\b/i,
  /\bfair\b/i,
  /\bfairness\b/i,
  /\bpoints?\b/i,
  /\bprojection\b/i,
  /\bproj\b/i,
  /\bscore\b/i,
  /\bexpected\b/i,
  /\bworth\b/i,
  /\b\d+\.\d+\b/, // decimals (values like 92.5)
];

function containsBlockedNumericContext(text: string): boolean {
  const lower = text.toLowerCase();

  // If it matches a blocked numeric concept → fail
  if (BLOCKED_NUMBER_PATTERNS.some((rx) => rx.test(lower))) return true;

  // If it contains digits but none match allowed patterns → suspicious
  const hasDigits = /\d/.test(lower);
  if (!hasDigits) return false;

  const allowed = ALLOWED_NUMBER_PATTERNS.some((rx) => rx.test(lower));
  return !allowed;
}

// --- Directive detection ---

const DIRECTIVE_PATTERNS = [
  /\b(trade|accept|reject|drop|add|start|bench|buy|sell)\b/i,
];

function containsDirective(text: string): boolean {
  return DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text));
}

// --- Key allowlist ---

const ALLOWED_KEYS = new Set([
  "confidence",
  "narrative",
  "messageTemplate",
  "tags",
  "evidenceLinks",
]);

// --- Sanitization helpers ---

function sanitizeStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === "string")
    .filter((s) => !containsBlockedNumericContext(s) && !containsDirective(s))
    .slice(0, 10);
}

function sanitizeEvidenceLinks(
  arr: unknown
): Array<{ label: string; url: string }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (item): item is { label: string; url: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as any).label === "string" &&
        typeof (item as any).url === "string"
    )
    .filter(
      (item) =>
        !containsBlockedNumericContext(item.label) &&
        !containsDirective(item.label) &&
        item.url.startsWith("http")
    )
    .slice(0, 5);
}

// --- Main validation ---

export function validateAndSanitizeGrokJson(args: {
  kind: GrokEnrichmentKind;
  rawText: string;
}): GrokEnrichmentResult {
  const { kind, rawText } = args;

  function blockedBase(reasons: string[]): GrokEnrichmentResult {
    return {
      ok: false,
      kind,
      confidence: "low",
      blocked: true,
      blockReasons: reasons,
      error: reasons[0],
    };
  }

  let parsed: any;
  try {
    const cleaned = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      kind,
      confidence: "low",
      error: "Grok output is not valid JSON",
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      ok: false,
      kind,
      confidence: "low",
      error: "Grok output is not a JSON object",
    };
  }

  const extraKeys = Object.keys(parsed).filter((k) => !ALLOWED_KEYS.has(k));
  if (extraKeys.length > 0) {
    return blockedBase([`Grok output contains disallowed keys: ${extraKeys.join(", ")}`]);
  }

  // Check for blocked numeric context in entire output
  const raw = JSON.stringify(parsed);
  if (containsBlockedNumericContext(raw)) {
    return blockedBase([
      "Output contained numeric context outside allowed categories (values, ratios, projections, or scores).",
    ]);
  }

  const confidence =
    parsed.confidence === "high" || parsed.confidence === "medium"
      ? parsed.confidence
      : "low";

  const narrative = sanitizeStringArray(parsed.narrative);
  const tags = sanitizeStringArray(parsed.tags);
  const evidenceLinks = sanitizeEvidenceLinks(parsed.evidenceLinks);

  let messageTemplate: string | undefined;
  if (typeof parsed.messageTemplate === "string") {
    if (!containsBlockedNumericContext(parsed.messageTemplate) && !containsDirective(parsed.messageTemplate)) {
      messageTemplate = parsed.messageTemplate.slice(0, 500);
    }
  }

  return {
    ok: true,
    kind,
    confidence,
    narrative: narrative.length > 0 ? narrative : undefined,
    messageTemplate,
    tags: tags.length > 0 ? tags : undefined,
    evidenceLinks: evidenceLinks.length > 0 ? evidenceLinks : undefined,
  };
}
