import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit';
import { trackLegacyToolUsage } from '@/lib/analytics-server';
import {
  evaluateRedraftTrade,
  getRedraftAIContext,
  RedraftTradeInput,
  RedraftPlayerInput,
  Position,
  LeagueSize,
  ScoringFormat,
  RedraftTradeResult,
} from '@/lib/redraft-tiers';
import { AI_CORE_PERSONALITY, getModeInstructions, SIGNATURE_PHRASES } from '@/lib/ai-personality';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const PlayerInputSchema = z.object({
  name: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
  weeklyProjection: z.number(),
  remainingWeeks: z.number().default(6),
  isStarterForTeam: z.boolean().default(true),
  playoffDifficultyRank: z.number().min(1).max(32).optional(),
  riskProfile: z.object({
    injuryRisk: z.number().min(0).max(1).default(0),
    roleVolatility: z.number().min(0).max(1).default(0),
    byeWeekRemaining: z.boolean().default(false),
  }).optional(),
});

const TeamContextSchema = z.object({
  wins: z.number(),
  losses: z.number(),
  playoffSpots: z.number().default(6),
  teamsInLeague: z.number().default(12),
  currentWeek: z.number(),
  playoffStartWeek: z.number().default(15),
});

const RequestSchema = z.object({
  senderPlayers: z.array(PlayerInputSchema).min(1),
  receiverPlayers: z.array(PlayerInputSchema).min(1),
  senderContext: TeamContextSchema.optional(),
  receiverContext: TeamContextSchema.optional(),
  leagueSize: z.number().refine(n => [8, 10, 12, 14, 16].includes(n)).default(12),
  scoring: z.enum(['standard', 'half_ppr', 'ppr', 'superflex']).default('half_ppr'),
  sleeper_username: z.string().optional(),
});

function buildSystemPrompt(deterministicResult: RedraftTradeResult): string {
  return `
${AI_CORE_PERSONALITY}

${getModeInstructions('analyst')}

${SIGNATURE_PHRASES}

${getRedraftAIContext()}

## YOUR ROLE
You are the AllFantasy REDRAFT Trade Evaluator. You explain trades based on REST-OF-SEASON value.

## DETERMINISTIC EVALUATION (ALREADY COMPUTED - DO NOT OVERRIDE)
The following values have been computed deterministically:

**Sender receives:** ${deterministicResult.receiverValues.map(v => 
  `${v.name} (${v.position}, Tier ${v.tier}, ${v.parPerWeek} PAR/week, Adj: ${v.adjustedValue})`
).join(', ')}

**Receiver receives:** ${deterministicResult.senderValues.map(v => 
  `${v.name} (${v.position}, Tier ${v.tier}, ${v.parPerWeek} PAR/week, Adj: ${v.adjustedValue})`
).join(', ')}

**Computed Results:**
- Sender Total Value: ${deterministicResult.senderTotalValue}
- Receiver Total Value: ${deterministicResult.receiverTotalValue}
- Value Ratio: ${deterministicResult.valueRatio}
- Verdict: ${deterministicResult.verdict}
- Winner: ${deterministicResult.winner}
- Sender Grade: ${deterministicResult.senderGrade}
- Receiver Grade: ${deterministicResult.receiverGrade}
${deterministicResult.maxGradeCap ? `- MAX GRADE CAP: ${deterministicResult.maxGradeCap} (${deterministicResult.capReason})` : ''}
${deterministicResult.tierViolation ? `- TIER VIOLATION: ${deterministicResult.tierViolationReason}` : ''}

**Indicators:**
- Starter Impact: ${deterministicResult.indicators.starterImpact}
- ROS Points Change: ${deterministicResult.indicators.rosPointsChange > 0 ? '+' : ''}${deterministicResult.indicators.rosPointsChange}
- Playoff Outlook: ${deterministicResult.indicators.playoffOutlook}

## YOUR JOB
1. Explain WHY the trade has this verdict using REDRAFT language
2. Focus on: starter impact, weekly points, playoff schedule, positional scarcity
3. DO NOT mention: age curves, picks, dynasty value, multi-year windows
4. DO NOT change the grades or verdict - they are final

## OUTPUT FORMAT
Return valid JSON only:
{
  "headline": "One punchy sentence summary",
  "analysis": "2-3 sentences explaining the trade using redraft concepts",
  "sender_perspective": "Why sender might accept/reject",
  "receiver_perspective": "Why receiver might accept/reject",
  "counter_offers": [
    { "description": "Suggestion 1", "adjustment": "What to add/remove" }
  ]
}
`;
}

export const POST = withApiUsage({ endpoint: "/api/redraft-trade", tool: "RedraftTrade" })(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }
    
    const ip = getClientIp(req);
    const rl = consumeRateLimit({
      scope: 'ai',
      action: 'redraft_trade',
      sleeperUsername: parsed.data.sleeper_username,
      ip,
      maxRequests: 20,
      windowMs: 60_000,
      includeIpInKey: true,
    });
    
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      );
    }
    
    // Run deterministic evaluation FIRST
    const tradeInput: RedraftTradeInput = {
      senderPlayers: parsed.data.senderPlayers as RedraftPlayerInput[],
      receiverPlayers: parsed.data.receiverPlayers as RedraftPlayerInput[],
      senderContext: parsed.data.senderContext,
      receiverContext: parsed.data.receiverContext,
      leagueSize: parsed.data.leagueSize as LeagueSize,
      scoring: parsed.data.scoring as ScoringFormat,
    };
    
    const deterministicResult = evaluateRedraftTrade(tradeInput);
    
    // Now get AI explanation
    const systemPrompt = buildSystemPrompt(deterministicResult);
    
    const userMessage = `Analyze this redraft trade:
    
SENDER GIVES UP: ${parsed.data.senderPlayers.map(p => `${p.name} (${p.position}, ${p.weeklyProjection} PPG)`).join(', ')}

SENDER RECEIVES: ${parsed.data.receiverPlayers.map(p => `${p.name} (${p.position}, ${p.weeklyProjection} PPG)`).join(', ')}

League: ${parsed.data.leagueSize}-team ${parsed.data.scoring}
${parsed.data.senderContext ? `Sender Record: ${parsed.data.senderContext.wins}-${parsed.data.senderContext.losses}` : ''}
${parsed.data.receiverContext ? `Receiver Record: ${parsed.data.receiverContext.wins}-${parsed.data.receiverContext.losses}` : ''}

Explain this trade for the SENDER's perspective.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });
    
    let aiExplanation: any = {};
    try {
      const content = completion.choices[0]?.message?.content || '{}';
      aiExplanation = JSON.parse(content);
    } catch (e) {
      aiExplanation = {
        headline: 'Trade evaluation complete',
        analysis: 'See deterministic results for details.',
        sender_perspective: '',
        receiver_perspective: '',
        counter_offers: [],
      };
    }
    
    // Track usage
    if (parsed.data.sleeper_username) {
      await trackLegacyToolUsage(parsed.data.sleeper_username, 'redraft-trade-eval');
    }
    
    return NextResponse.json({
      success: true,
      evaluation: {
        ...deterministicResult,
        ai: aiExplanation,
      },
    });
    
  } catch (error) {
    console.error('Redraft trade evaluation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
})
