// lib/ai-external/grok-types.ts

export type GrokRole = "system" | "user" | "assistant";

export type GrokMessage = {
  role: GrokRole;
  content: string;
};

export type GrokChatRequest = {
  model?: string;
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
};

export type GrokChatResponse = {
  id?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type GrokEnrichmentKind = "trade_message" | "trade_narrative" | "waiver_narrative" | "id_mapping_hint";

export type GrokEnrichmentRequest = {
  kind: GrokEnrichmentKind;
  payload: Record<string, any>;
  context?: Record<string, any>;
};

export type GrokEnrichmentResult = {
  ok: boolean;
  kind: GrokEnrichmentKind;
  confidence: "high" | "medium" | "low";
  narrative?: string[];
  messageTemplate?: string;
  tags?: string[];
  evidenceLinks?: Array<{ label: string; url: string }>;
  rawText?: string;
  blocked?: boolean;
  blockReasons?: string[];
  error?: string;
};
