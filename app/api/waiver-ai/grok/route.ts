import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const grok = new OpenAI({ apiKey: process.env.XAI_API_KEY!, baseURL: 'https://api.x.ai/v1' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_TOOL_TURNS = 5;

const GROK_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search current web for NFL news, injuries, signings, rookie updates, waiver wire buzz',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'x_keyword_search',
      description: 'Search X (Twitter) for real-time player buzz, rookie hype, sentiment, injuries',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
    },
  },
];

async function executeWebSearch(query: string): Promise<any> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) return { note: 'Web search not configured' };
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `Search failed: ${res.status}` };
    const data = await res.json();
    const organic = data.organic?.slice(0, 5).map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
      link: r.link,
    })) || [];
    return { results: organic, answerBox: data.answerBox || null };
  } catch (err: any) {
    return { error: err.message || 'Search timeout' };
  }
}

async function runGrokWithTools(systemPrompt: string, useRealTime: boolean): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analyze this roster and find the best waiver wire targets. ' + (useRealTime ? 'Use your tools to search for the latest injuries, signings, rookie buzz, and X sentiment for relevant players.' : 'Focus on player profiles, roster fit, and value analysis.') },
  ];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await grok.chat.completions.create({
      model: 'grok-4-0709',
      messages,
      ...(useRealTime ? { tools: GROK_TOOLS, tool_choice: 'auto' as const } : {}),
      temperature: 0.65,
      max_tokens: 2000,
    });

    const msg = response.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content || '{}';
    }

    for (const toolCall of msg.tool_calls) {
      const fn = (toolCall as any).function;
      if (!fn) continue;
      const fnName = fn.name;
      let args: any = {};
      try { args = JSON.parse(fn.arguments || '{}'); } catch {}

      let result: any;

      if (fnName === 'web_search') {
        result = await executeWebSearch(args.query || 'NFL fantasy football waiver wire 2026');
      } else if (fnName === 'x_keyword_search') {
        try {
          const xRes = await fetch('https://api.x.ai/v1/tools/x_keyword_search', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.XAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: args.query, limit: args.limit || 12 }),
            signal: AbortSignal.timeout(5000),
          });
          result = xRes.ok ? await xRes.json().catch(() => ({ note: 'X search parse failed' })) : { note: `X search returned ${xRes.status}` };
        } catch (err: any) {
          result = { note: 'X search timeout or unavailable', query: args.query };
        }
      } else {
        result = { error: `Unknown tool: ${fnName}` };
      }

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  const finalMsg = messages[messages.length - 1];
  if (finalMsg.role === 'assistant' && typeof finalMsg.content === 'string') {
    return finalMsg.content;
  }
  return '{}';
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit(`waiver-grok:${ip}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json();
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;

    const {
      leagueId,
      userRoster: manualRoster,
      userContention = 'unknown',
      userFAAB = 100,
      useRealTimeNews = true,
      leagueSize = 12,
      scoring = 'ppr',
      isDynasty = true,
    } = body;

    let rosterData: string;
    let resolvedLeagueSize = leagueSize;
    let resolvedScoring = scoring;
    let resolvedIsDynasty = isDynasty;
    let resolvedFAAB = userFAAB;
    let leagueSettings = '';

    const sleeperUserId = body.sleeperUserId || body.platformUserId;

    if (leagueId && (userId || sleeperUserId)) {
      const league = await (prisma as any).league.findUnique({
        where: { id: leagueId },
        include: { rosters: true },
      });

      if (!league) {
        return NextResponse.json({ error: 'League not synced yet. Please sync your league first.' }, { status: 400 });
      }

      const lookupId = sleeperUserId || userId;
      const userRoster = league.rosters.find((r: any) => r.platformUserId === lookupId);
      if (!userRoster) {
        return NextResponse.json({ error: 'Roster not found for this user in this league' }, { status: 400 });
      }

      rosterData = JSON.stringify(userRoster.playerData);
      resolvedLeagueSize = league.leagueSize;
      resolvedScoring = league.scoring;
      resolvedIsDynasty = league.isDynasty;
      resolvedFAAB = userRoster.faabRemaining ?? userFAAB;
      leagueSettings = `\n- Full league settings: ${JSON.stringify(league.settings)}`;
    } else if (manualRoster && typeof manualRoster === 'string' && manualRoster.trim()) {
      rosterData = manualRoster;
    } else {
      return NextResponse.json({ error: 'Provide either a leagueId (synced) or paste your roster manually' }, { status: 400 });
    }

    let pickupClause = '';
    let profileClause = '';

    if (userId) {
      const [recentPickups, profile] = await Promise.all([
        (prisma as any).waiverPickup.findMany({
          where: { userId, ...(leagueId ? { leagueId } : {}) },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        (prisma as any).tradeProfile.findUnique({ where: { userId } }),
      ]);

      if (recentPickups.length > 0) {
        const pickupSummary = recentPickups.map((p: any) => `${p.playerName} → ${p.outcome || 'unknown'}`).join(', ');
        pickupClause = `\n\nPast waiver pickups (learn from these): ${pickupSummary}\nRecommend more players like past hits, avoid profiles similar to past misses.`;
      }

      if (profile?.summary) {
        profileClause = `\n\nUser preference profile: ${profile.summary}`;
      }
    }

    const realTimeClause = useRealTimeNews
      ? `\n\nREAL-TIME DATA ENABLED: Use your web_search and x_keyword_search tools to find the latest injuries, transactions, signings, coaching changes, rookie draft capital/landing spots, and breaking news. Flag any time-sensitive pickups.`
      : '';

    const systemPrompt = `You are the #1 Waiver Wire AI for 2026 fantasy football.
Analyze the user's roster, contention window, FAAB budget, and league context to surface the highest-impact waiver targets.

LEAGUE CONTEXT (CRITICAL):
- Format: ${resolvedLeagueSize}-team ${resolvedIsDynasty ? 'Dynasty' : 'Redraft'} ${resolvedScoring.toUpperCase()}
- Contention window: ${userContention}
- FAAB remaining: ${resolvedFAAB}%${leagueSettings}

USER ROSTER (analyze needs, surplus, potential busts, age curve):
"""
${rosterData}
"""

Prioritize waiver targets that:
1. Fill immediate roster holes based on the provided roster (identify positional weaknesses)
2. Fit the user's contention window (${userContention}) — win-now targets for contenders, stash/upside for rebuilders
3. Offer breakout upside or long-term stash value in dynasty formats
4. Replace potential busts, aging, or injury-prone players currently on the roster
5. Are realistic FAAB spends given ${resolvedFAAB}% remaining budget — don't blow the budget on marginal upgrades
6. Consider roster construction holistically — depth vs ceiling, bye week coverage, handcuff value
${pickupClause}${profileClause}${realTimeClause}

For each target, explain WHY they fit THIS specific roster and contention window. Be concrete — reference specific roster players they complement or replace.

If relevant, mention any players on the current roster that look like potential busts or sell-high candidates based on age, injury history, situation, or market trends.

Return 6–8 waiver targets ranked by priority. Output analysis as detailed text — the synthesis step will format it.`;

    const grokResearch = await runGrokWithTools(systemPrompt, useRealTimeNews);

    const synthesis = await openai.chat.completions.create({
      model: 'gpt-4o-2024-11-20',
      messages: [
        {
          role: 'system',
          content: `You are a fantasy football waiver wire synthesizer. Given Grok's research and analysis, produce a final structured JSON response. Be precise and actionable. Output ONLY valid JSON.

Required format:
{
  "suggestions": [
    {
      "playerName": string,
      "rank": number,
      "score": number (0-100 composite fit score),
      "reason": string[] (2-4 specific reasons tied to this roster),
      "projectedPoints": number (weekly PPR projection),
      "faabBidRecommendation": number | null (% of total budget),
      "sensitivityNote": string | null (injury risk, usage concern, or upside caveat)
    }
  ],
  "rosterAlerts": [
    {
      "playerName": string,
      "alertType": "bust_risk" | "sell_high" | "injury_concern" | "aging_out",
      "reason": string
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Grok research complete. Here is the analysis:\n\n${grokResearch}\n\nSynthesize into final ranked waiver suggestions with roster alerts.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const finalContent = synthesis.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(finalContent);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[waiver-ai/grok]', error);
    return NextResponse.json({ error: 'Failed to generate waiver suggestions' }, { status: 500 });
  }
}
