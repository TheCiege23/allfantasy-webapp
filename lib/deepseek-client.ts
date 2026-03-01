import OpenAI from 'openai'

if (!process.env.DEEPSEEK_API_KEY) {
  console.warn('[DeepSeek] DEEPSEEK_API_KEY is not set')
}

export const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? '',
  baseURL: 'https://api.deepseek.com/v1',
})

export interface DeepSeekChatOptions {
  prompt: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

export interface DeepSeekResult {
  content: string
  usage?: { promptTokens: number; completionTokens: number }
  error?: string
}

export async function deepseekChat(
  options: DeepSeekChatOptions
): Promise<DeepSeekResult> {
  const {
    prompt,
    systemPrompt = 'You are a quantitative fantasy sports analyst.',
    temperature = 0.2,
    maxTokens = 1000,
  } = options

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''
    return {
      content,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
      },
    }
  } catch (e: any) {
    console.error('[DeepSeek] Chat error:', e?.message)
    return { content: '', error: e?.message ?? 'DeepSeek unavailable' }
  }
}

export async function deepseekQuantAnalysis(
  prompt: string
): Promise<{ json: Record<string, any> | null; raw: string; error?: string }> {
  const result = await deepseekChat({
    prompt,
    systemPrompt: `You are a quantitative fantasy sports engine. 
Always respond in valid JSON only. No markdown. No explanation outside JSON.`,
    temperature: 0.1,
    maxTokens: 1200,
  })

  if (result.error || !result.content) {
    return { json: null, raw: '', error: result.error }
  }

  try {
    const cleaned = result.content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const json = JSON.parse(cleaned)
    return { json, raw: result.content }
  } catch {
    console.warn('[DeepSeek] Failed to parse JSON from response:', result.content.slice(0, 200))
    return { json: null, raw: result.content, error: 'Invalid JSON in response' }
  }
}
