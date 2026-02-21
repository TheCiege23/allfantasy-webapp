import OpenAI from 'openai'

export type OpenAIConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('OpenAI API key is not configured.')

  const baseUrl = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = (process.env.OPENAI_MODEL || 'gpt-4o').trim()

  return { apiKey, baseUrl, model }
}

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const { apiKey, baseUrl } = getOpenAIConfig()
    _client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    })
  }
  return _client
}

export async function openaiChatJson(args: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<
  | { ok: true; json: any; model: string; baseUrl: string }
  | { ok: false; status: number; details: string; model: string; baseUrl: string }
> {
  const { model, baseUrl } = getOpenAIConfig()
  const client = getOpenAIClient()

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: args.temperature ?? 0.7,
      max_completion_tokens: args.maxTokens ?? 1500,
      messages: args.messages,
      response_format: { type: 'json_object' },
    })

    return { ok: true, json: response, model, baseUrl }
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode ?? 0
    const details = String(e?.message || e || '').slice(0, 800)
    return { ok: false, status, details, model, baseUrl }
  }
}

export async function openaiChatText(args: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<
  | { ok: true; text: string; model: string; baseUrl: string }
  | { ok: false; status: number; details: string; model: string; baseUrl: string }
> {
  const { model, baseUrl } = getOpenAIConfig()
  const client = getOpenAIClient()

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: args.temperature ?? 0.7,
      max_completion_tokens: args.maxTokens ?? 1500,
      messages: args.messages,
    })

    const content = response.choices?.[0]?.message?.content
    if (typeof content === 'string') {
      return { ok: true, text: content, model, baseUrl }
    }
    return { ok: false, status: 200, details: 'No content in response', model, baseUrl }
  } catch (e: any) {
    const status = e?.status ?? e?.statusCode ?? 0
    const details = String(e?.message || e || '').slice(0, 800)
    return { ok: false, status, details, model, baseUrl }
  }
}

export function parseJsonContentFromChatCompletion(data: any) {
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') return null
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}
