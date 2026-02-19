export type OpenAIConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.')

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, '')
  const model = (process.env.OPENAI_MODEL || 'gpt-4o').trim()

  return { apiKey, baseUrl, model }
}

export async function openaiChatJson(args: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<
  | { ok: true; json: any; model: string; baseUrl: string }
  | { ok: false; status: number; details: string; model: string; baseUrl: string }
> {
  const { apiKey, baseUrl, model } = getOpenAIConfig()

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens ?? 1500,
        messages: args.messages,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      details: `network: ${String(e?.message || e || '').slice(0, 800)}`,
      model,
      baseUrl,
    }
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    return {
      ok: false,
      status: resp.status,
      details: errText.slice(0, 800),
      model,
      baseUrl,
    }
  }

  const data = await resp.json().catch(() => null)
  return { ok: true, json: data, model, baseUrl }
}

export async function openaiChatText(args: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<
  | { ok: true; text: string; model: string; baseUrl: string }
  | { ok: false; status: number; details: string; model: string; baseUrl: string }
> {
  const { apiKey, baseUrl, model } = getOpenAIConfig()

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens ?? 1500,
        messages: args.messages,
      }),
    })
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      details: `network: ${String(e?.message || e || '').slice(0, 800)}`,
      model,
      baseUrl,
    }
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    return {
      ok: false,
      status: resp.status,
      details: errText.slice(0, 800),
      model,
      baseUrl,
    }
  }

  const data = await resp.json().catch(() => null)
  const content = data?.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return { ok: true, text: content, model, baseUrl }
  }
  return { ok: false, status: 200, details: 'No content in response', model, baseUrl }
}

export async function openaiChatStream(args: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
}): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array>; fullText: () => Promise<string> }
  | { ok: false; status: number; details: string }
> {
  const { apiKey, baseUrl, model } = getOpenAIConfig()

  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: args.temperature ?? 0.7,
        max_tokens: args.maxTokens ?? 1500,
        messages: args.messages,
        stream: true,
      }),
    })
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      details: `network: ${String(e?.message || e || '').slice(0, 800)}`,
    }
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '')
    return { ok: false, status: resp.status, details: errText.slice(0, 800) }
  }

  let completionResolve: (val: string) => void
  const completionPromise = new Promise<string>((res) => {
    completionResolve = res
  })
  let fullContent = ''

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const transformedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = resp.body!.getReader()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith('data: ')) continue
            const payload = trimmed.slice(6)
            if (payload === '[DONE]') continue

            try {
              const parsed = JSON.parse(payload)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                fullContent += delta
                controller.enqueue(encoder.encode(delta))
              }
            } catch {}
          }
        }
      } catch (e) {
        controller.error(e)
      } finally {
        completionResolve!(fullContent)
        controller.close()
      }
    },
  })

  return {
    ok: true,
    stream: transformedStream,
    fullText: () => completionPromise,
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
