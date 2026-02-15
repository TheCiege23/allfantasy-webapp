type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export type XaiChatJsonResult =
  | { ok: true; status: number; json: any }
  | { ok: false; status: number; details: string }

export type XaiTool = 
  | { type: "x_search"; from_date?: string; to_date?: string; allowed_x_handles?: string[]; excluded_x_handles?: string[] }
  | { type: "web_search"; allowed_domains?: string[]; excluded_domains?: string[] }

export async function xaiChatJson(opts: {
  messages: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: XaiTool[]
}) : Promise<XaiChatJsonResult> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) {
    return { ok: false, status: 500, details: "Missing XAI_API_KEY env var" }
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? "grok-4-fast-non-reasoning",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 700,
  }
  
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text().catch(() => "")
  if (!res.ok) return { ok: false, status: res.status, details: text.slice(0, 3000) }

  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, status: 500, details: `Failed to parse xAI JSON. Raw: ${text.slice(0, 3000)}` }
  }

  return { ok: true, status: res.status, json }
}

export function parseTextFromXaiChatCompletion(json: any): string | null {
  const content = json?.choices?.[0]?.message?.content
  return typeof content === "string" ? content : null
}
