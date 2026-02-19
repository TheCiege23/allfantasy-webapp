import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { openaiChatStream } from '@/lib/openai-client'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { messages, leagueId, context } = body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
  }
  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
  }

  const archetype = context?.archetype || 'Unknown'
  const score = context?.score ?? 0
  const rosterSummary = context?.rosterSummary || 'No roster data available'
  const insights = context?.insights || 'No recent insights'

  const systemPrompt = `You are AllFantasy's elite dynasty fantasy football strategist. You give direct, actionable advice grounded in real roster data.

TEAM CONTEXT:
- Team archetype: ${archetype} (score: ${score}/100)
- Roster summary: ${typeof rosterSummary === 'string' ? rosterSummary : JSON.stringify(rosterSummary)}
- Recent insights: ${insights}

RULES:
- Respond conversationally but always back up claims with data from the roster context.
- Focus on dynasty strategy with a 2026–2028 window.
- When suggesting trades, always consider both sides — fair trades where both teams improve are ideal.
- Never encourage exploiting other managers.
- Keep answers concise unless the user asks for depth.
- If asked about players not in the roster context, give general dynasty consensus but note you don't have their specific league data.
- Use markdown formatting for lists and emphasis when helpful.`

  try {
    const result = await openaiChatStream({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-20).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(m.content || ''),
        })),
      ],
      temperature: 0.7,
      maxTokens: 1500,
    })

    if (!result.ok) {
      console.error('[Strategy Chat] OpenAI error:', result.details)
      return NextResponse.json(
        { error: 'AI chat failed. Please try again.' },
        { status: 502 }
      )
    }

    const { stream, fullText } = result

    const [browserStream, saveStream] = stream.tee()

    const decoder = new TextDecoder()
    ;(async () => {
      try {
        const reader = saveStream.getReader()
        let full = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
        }

        if (full.length > 10) {
          await prisma.aIStrategyReport.create({
            data: {
              userId,
              leagueId,
              title: `Strategy Chat — ${new Date().toLocaleDateString()}`,
              content: {
                type: 'chat',
                userMessages: messages.slice(-5),
                assistantResponse: full,
              },
              archetype,
              score,
            },
          })
        }
      } catch (e) {
        console.warn('[Strategy Chat] Save failed (non-critical):', e)
      }
    })()

    return new Response(browserStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error: any) {
    console.error('[Strategy Chat] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
