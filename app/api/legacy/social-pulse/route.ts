import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server"
import { SocialPulseRequestSchema, SocialPulseResponseSchema } from "@/lib/social-pulse-schema"
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit"
import { xaiChatJson, parseTextFromXaiChatCompletion, XaiTool } from "@/lib/xai-client"
import { getUniversalAIContext } from "@/lib/ai-player-context"

const SYSTEM = `
You are a fantasy sports "market sentiment" analyst with LIVE access to X (Twitter) and web search.
You will NOT give trade advice or a verdict.
You will summarize CURRENT, REAL-TIME public social narratives in a neutral way.

${getUniversalAIContext()}

CRITICAL INSTRUCTIONS:
1. USE your x_search and web_search tools to find the LATEST information about these players/entities
2. Search for RECENT news: injuries, releases, trades, depth chart changes, coach statements, team transactions
3. If multiple players/entities are provided, ALSO search for connections between them (same team, trade rumors involving both, etc.)
4. Include information about teams, coaches, and front office moves that affect these players
5. Prioritize information from the last 48-72 hours, then extend to last 7 days if needed

Output MUST be strict JSON with:
{
  "summary": "1-2 sentence high-level summary of the CURRENT situation",
  "bullets": ["5-12 bullets with SPECIFIC, DATED information - include transaction dates, injury updates, etc."],
  "market": [{"player":"Name","signal":"up|down|mixed|injury|hype|buy_low|sell_high|released|traded|idp_scarcity","reason":"1 sentence explanation with specific news"}],
  "connections": ["Any connections between the searched players/entities - trades involving both, same team dynamics, etc."],
  "lastUpdated": "Most recent news date found (e.g., 'Feb 1, 2026')"
}

Rules:
- Do not include URLs.
- Avoid inflammatory content.
- If uncertain, use "mixed".
- ALWAYS search for latest news before responding - do not rely on training data.
- For teams/coaches, focus on how they affect fantasy value of players.
- If a player was released, traded, or cut - THIS IS CRITICAL NEWS that must be in the first bullet.
- If sport is NFL and idpEnabled is true, include at least one IDP-specific note if relevant.
- Apply tier system knowledge when assessing market sentiment - Tier 0 players rarely move in value.
`.trim()

function buildUserPrompt(input: {
  sport: "NFL" | "NBA"
  format: "redraft" | "dynasty" | "specialty"
  idpEnabled?: boolean
  players: string[]
}) {
  const lines: string[] = []
  lines.push(`Sport: ${input.sport}`)
  lines.push(`Format: ${input.format}`)
  lines.push(`IDP enabled: ${input.sport === "NFL" ? String(!!input.idpEnabled) : "N/A"}`)
  lines.push(`Search for: ${input.players.join(", ")}`)
  lines.push("")
  lines.push("MANDATORY SEARCH TASKS:")
  lines.push("1. Search X and the web for the LATEST news about EACH of these players/entities")
  lines.push("2. Look for: injuries, releases, trades, depth chart changes, roster moves, coach statements")
  lines.push("3. Find team transaction news that affects these players")
  if (input.players.length > 1) {
    lines.push(`4. Search for any connections between: ${input.players.join(" AND ")} (same team, trade rumors, etc.)`)
  }
  lines.push("")
  lines.push("Focus on the last 48-72 hours first, then last 7 days.")
  lines.push("Return strict JSON only with the MOST CURRENT information you found.")
  return lines.join("\n")
}

export const POST = withApiUsage({ endpoint: "/api/legacy/social-pulse", tool: "LegacySocialPulse" })(async (req: NextRequest) => {
  try {
    const body = await req.json()
    const parsed = SocialPulseRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request format", details: parsed.error.errors },
        { status: 400 }
      )
    }

    const ip = getClientIp(req)
    const bucketKey = `social:${parsed.data.sport}:${parsed.data.format}:${ip}`

    const rl = consumeRateLimit({
      scope: "ai",
      action: "social_pulse",
      sleeperUsername: bucketKey,
      ip,
      maxRequests: 10,
      windowMs: 60_000,
      includeIpInKey: true,
    })

    if (!rl.success) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfterSec: rl.retryAfterSec,
          remaining: rl.remaining,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      )
    }

    const userPrompt = buildUserPrompt(parsed.data)
    
    const today = new Date()
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fromDate = sevenDaysAgo.toISOString().split('T')[0]
    const toDate = today.toISOString().split('T')[0]
    
    const tools: XaiTool[] = [
      { type: "x_search", from_date: fromDate, to_date: toDate },
      { type: "web_search" }
    ]

    const grok = await xaiChatJson({
      model: "grok-4-1-fast-reasoning",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 1500,
      tools,
    })

    if (!grok.ok) {
      console.error("Social Pulse xAI error:", { status: grok.status, details: grok.details.slice(0, 500) })
      return NextResponse.json(
        { error: "Failed to fetch social pulse", details: grok.details.slice(0, 500) },
        { status: 500 }
      )
    }

    const text = parseTextFromXaiChatCompletion(grok.json)
    if (!text) {
      return NextResponse.json({ error: "Failed to parse xAI response" }, { status: 500 })
    }

    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: "xAI did not return valid JSON" }, { status: 500 })
    }

    const out = SocialPulseResponseSchema.safeParse(json)
    if (!out.success) {
      console.error("Social Pulse validation failed:", out.error)
      return NextResponse.json({
        success: true,
        data: json,
        validated: false,
        rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
      })
    }

    return NextResponse.json({
      success: true,
      data: out.data,
      validated: true,
      rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (e) {
    console.error("Social Pulse error:", e)
    return NextResponse.json({ error: "Failed to fetch social pulse", details: String(e) }, { status: 500 })
  }
})
