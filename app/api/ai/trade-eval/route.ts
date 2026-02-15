import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TRADE_EVALUATOR_SYSTEM_PROMPT, TradeEvaluationResponseSchema } from '@/lib/trade-evaluator-prompt';
import { rateLimit } from '@/lib/rate-limit';
import { getComprehensiveLearningContext } from '@/lib/comprehensive-trade-learning';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const ContextScopeSchema = z.object({
  sleeper_username: z.string().optional(),
  include_legacy: z.boolean().optional().default(true),
});

const PlayerInputSchema = z.object({
  name: z.string(),
  position: z.string().optional(),
  team: z.string().optional(),
  age: z.number().optional(),
  value_notes: z.string().optional(),
});

const PickInputSchema = z.object({
  year: z.number(),
  round: z.number(),
  projected_range: z.enum(['early', 'mid', 'late', 'unknown']).optional(),
});

const TeamInputSchema = z.object({
  team_id: z.string().optional(),
  manager_name: z.string(),
  is_af_pro: z.boolean().optional().default(false),
  record_or_rank: z.string().optional(),
  roster: z.array(z.any()).optional(),
  picks_owned: z.array(PickInputSchema).optional(),
  faab_remaining: z.number().optional(),
  gives_players: z.array(z.union([z.string(), PlayerInputSchema])),
  gives_picks: z.array(z.union([z.string(), PickInputSchema])).optional().default([]),
  gives_faab: z.number().optional().default(0),
});

const LeagueContextSchema = z.object({
  format: z.enum(['redraft', 'dynasty', 'keeper']).optional(),
  sport: z.string().optional(),
  scoring_summary: z.string().optional(),
  idp_enabled: z.boolean().optional().default(false),
  roster_requirements: z.string().optional(),
  waiver_type: z.string().optional(),
  trade_deadline: z.string().optional(),
  playoff_weeks: z.string().optional(),
  standings_summary: z.string().optional(),
  contender_notes: z.string().optional(),
  scarcity_notes: z.string().optional(),
  market_notes: z.string().optional(),
});

const TradeRequestSchema = z.object({
  context_scope: ContextScopeSchema.optional(),
  trade_id: z.string().optional(),
  league_id: z.string().optional(),
  sender: TeamInputSchema,
  receiver: TeamInputSchema,
  league: LeagueContextSchema.optional(),
});

function formatPlayerList(players: Array<string | { name: string; position?: string; team?: string; age?: number }>): string {
  return players.map(p => {
    if (typeof p === 'string') return p;
    let str = p.name;
    if (p.position) str += ` (${p.position})`;
    if (p.team) str += ` - ${p.team}`;
    if (p.age) str += `, Age ${p.age}`;
    return str;
  }).join(', ') || 'None';
}

function formatPicks(picks: Array<string | { year: number; round: number; projected_range?: string }>): string {
  return picks.map(p => {
    if (typeof p === 'string') return p;
    let str = `${p.year} Round ${p.round}`;
    if (p.projected_range) str += ` (${p.projected_range})`;
    return str;
  }).join(', ') || 'None';
}

async function getLegacyContext(sleeperUsername: string) {
  const user = await prisma.legacyUser.findUnique({
    where: { sleeperUsername: sleeperUsername.toLowerCase() },
    include: {
      leagues: { include: { rosters: true } },
      aiReports: {
        where: { reportType: 'legacy' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) return null;

  const allRosters = user.leagues.flatMap(l => l.rosters);
  const totalWins = allRosters.reduce((sum, r) => sum + r.wins, 0);
  const totalLosses = allRosters.reduce((sum, r) => sum + r.losses, 0);
  const championships = allRosters.filter(r => r.isChampion).length;
  const aiReport = user.aiReports[0];
  const insights = aiReport?.insights as Record<string, unknown> | null;

  return {
    display_name: user.displayName,
    total_leagues: user.leagues.length,
    record: `${totalWins}-${totalLosses}`,
    championships,
    archetype: insights?.archetype || 'Unknown',
    rating: aiReport?.rating || null,
    trading_style: insights?.archetype === 'Trader' ? 'aggressive' : 
                   insights?.archetype === 'Hoarder' ? 'conservative' : 'balanced',
  };
}

export const POST = withApiUsage({ endpoint: "/api/ai/trade-eval", tool: "AiTradeEval" })(async (request: NextRequest) => {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = rateLimit(ip, 10, 60000);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const data = TradeRequestSchema.parse(body);

    let legacyContext = null;
    if (data.context_scope?.sleeper_username && data.context_scope.include_legacy) {
      legacyContext = await getLegacyContext(data.context_scope.sleeper_username);
    }

    const biasMode = (data.sender.is_af_pro && data.receiver.is_af_pro) ? 'neutral' : 'protect_receiver';

    let legacySection = '';
    if (legacyContext) {
      legacySection = `
Legacy Context (from DB - do not call external APIs):
- Manager: ${legacyContext.display_name}
- Career Record: ${legacyContext.record}
- Championships: ${legacyContext.championships}
- Archetype: ${legacyContext.archetype}
- Legacy Rating: ${legacyContext.rating || 'Not rated'}
- Trading Style: ${legacyContext.trading_style}
`;
    }

    const learningContext = await getComprehensiveLearningContext();

    const userPrompt = `Evaluate this trade proposal using the rules in your system instructions.
${legacySection}
OUTPUT FORMAT: Return ONLY JSON matching the comprehensive trade evaluation schema.

NOW HERE IS THE DATA:

trade_id: ${data.trade_id || 'N/A'}
league_id: ${data.league_id || 'N/A'}
timestamp_utc: ${new Date().toISOString()}

League:
- format: ${data.league?.format || 'dynasty'}
- sport: ${data.league?.sport || 'NFL'}
- scoring_summary: ${data.league?.scoring_summary || 'PPR'}
- idp_enabled: ${data.league?.idp_enabled || false}
- roster_requirements: ${data.league?.roster_requirements || 'Standard'}
- waiver_type: ${data.league?.waiver_type || 'FAAB'}
- trade_deadline: ${data.league?.trade_deadline || 'None specified'}
- playoff_weeks: ${data.league?.playoff_weeks || 'Weeks 15-17'}

Bias control:
- sender_is_af_pro: ${data.sender.is_af_pro}
- receiver_is_af_pro: ${data.receiver.is_af_pro}
- bias_mode: ${biasMode}

League-wide balance snapshot:
- standings_or_rankings: ${data.league?.standings_summary || 'Not provided'}
- contenders_vs_rebuilders: ${data.league?.contender_notes || 'Not provided'}
- positional_scarcity_notes: ${data.league?.scarcity_notes || 'Not provided'}
- league_market_notes: ${data.league?.market_notes || 'Not provided'}

Sender team:
- team_id: ${data.sender.team_id || 'sender_1'}
- manager_name: ${data.sender.manager_name}
- record_or_rank: ${data.sender.record_or_rank || 'Not provided'}
- roster: ${data.sender.roster ? JSON.stringify(data.sender.roster) : 'Not provided'}
- picks_owned: ${data.sender.picks_owned ? JSON.stringify(data.sender.picks_owned) : 'Not provided'}
- faab_remaining: ${data.sender.faab_remaining ?? 'Not provided'}

Receiver team:
- team_id: ${data.receiver.team_id || 'receiver_1'}
- manager_name: ${data.receiver.manager_name}
- record_or_rank: ${data.receiver.record_or_rank || 'Not provided'}
- roster: ${data.receiver.roster ? JSON.stringify(data.receiver.roster) : 'Not provided'}
- picks_owned: ${data.receiver.picks_owned ? JSON.stringify(data.receiver.picks_owned) : 'Not provided'}
- faab_remaining: ${data.receiver.faab_remaining ?? 'Not provided'}

Trade proposal:
- sender_gives_players: ${formatPlayerList(data.sender.gives_players)}
- sender_gives_picks: ${formatPicks(data.sender.gives_picks || [])}
- sender_gives_faab: $${data.sender.gives_faab || 0}
- receiver_gives_players: ${formatPlayerList(data.receiver.gives_players)}
- receiver_gives_picks: ${formatPicks(data.receiver.gives_picks || [])}
- receiver_gives_faab: $${data.receiver.gives_faab || 0}`;

    const enhancedSystemPrompt = learningContext 
      ? `${TRADE_EVALUATOR_SYSTEM_PROMPT}\n${learningContext}`
      : TRADE_EVALUATOR_SYSTEM_PROMPT;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 502 });
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 });
    }

    const validationResult = TradeEvaluationResponseSchema.safeParse(parsedContent);
    
    return NextResponse.json({
      success: true,
      evaluation: validationResult.success ? validationResult.data : parsedContent,
      legacy_context: legacyContext ? { included: true, archetype: legacyContext.archetype } : { included: false },
    });
  } catch (error) {
    console.error('Trade evaluator error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Failed to evaluate trade' }, { status: 500 });
  }
})
