import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { logUserEventByUsername } from '@/lib/user-events';
import { prisma } from '@/lib/prisma';
import { 
  WaiverRequestSchema, 
  WaiverResponseSchema,
  WAIVER_AI_SYSTEM_PROMPT,
  buildWaiverUserPrompt
} from '@/lib/waiver-ai-prompt';
import { rateLimit } from '@/lib/rate-limit';
import { trackLegacyToolUsage } from '@/lib/analytics-server';
import { getComprehensiveLearningContext } from '@/lib/comprehensive-trade-learning';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const ContextScopeSchema = z.object({
  sleeper_username: z.string().optional(),
  include_legacy: z.boolean().optional().default(true),
});

const ExtendedWaiverRequestSchema = WaiverRequestSchema.extend({
  context_scope: ContextScopeSchema.optional(),
});

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

  const aiReport = user.aiReports[0];
  const insights = aiReport?.insights as Record<string, unknown> | null;

  return {
    display_name: user.displayName,
    archetype: insights?.archetype || 'Unknown',
    rating: aiReport?.rating || null,
    waiver_style: insights?.archetype === 'Sniper' ? 'selective' : 
                  insights?.archetype === 'Hoarder' ? 'aggressive' : 'balanced',
    strengths: (insights?.strengths as string[]) || [],
    weaknesses: (insights?.weaknesses as string[]) || [],
  };
}

export const POST = withApiUsage({ endpoint: "/api/ai/waiver", tool: "AiWaiver" })(async (request: NextRequest) => {
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
    const parseResult = ExtendedWaiverRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request format', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const waiverRequest = parseResult.data;

    const waiverUsername = waiverRequest.context_scope?.sleeper_username
    if (waiverUsername) {
      logUserEventByUsername(waiverUsername, 'waiver_analysis_started')
    }

    let legacyContext = null;
    if (waiverRequest.context_scope?.sleeper_username && waiverRequest.context_scope.include_legacy) {
      legacyContext = await getLegacyContext(waiverRequest.context_scope.sleeper_username);
    }

    let userPrompt = buildWaiverUserPrompt(waiverRequest);

    if (legacyContext) {
      const legacySection = `
LEGACY CONTEXT (from DB - do not call external APIs):
- Manager: ${legacyContext.display_name}
- Archetype: ${legacyContext.archetype}
- Legacy Rating: ${legacyContext.rating || 'Not rated'}
- Waiver Style Preference: ${legacyContext.waiver_style}
- Known Strengths: ${legacyContext.strengths.slice(0, 2).join(', ') || 'None identified'}
- Areas to Improve: ${legacyContext.weaknesses.slice(0, 2).join(', ') || 'None identified'}

Consider this manager's style when making recommendations.
`;
      userPrompt = legacySection + '\n' + userPrompt;
    }

    const learningContext = await getComprehensiveLearningContext();
    const enhancedSystemPrompt = learningContext 
      ? `${WAIVER_AI_SYSTEM_PROMPT}\n${learningContext}`
      : WAIVER_AI_SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    const aiResponse = JSON.parse(responseText);
    const validatedResponse = WaiverResponseSchema.safeParse(aiResponse);

    const sleeperUsername = waiverRequest.context_scope?.sleeper_username
    if (sleeperUsername) {
      trackLegacyToolUsage('waiver_ai', null, null, { sleeperUsername })
      logUserEventByUsername(sleeperUsername, 'waiver_analysis_completed')
    }

    return NextResponse.json({
      success: true,
      data: validatedResponse.success ? validatedResponse.data : aiResponse,
      validated: validatedResponse.success,
      legacy_context: legacyContext ? { included: true, archetype: legacyContext.archetype } : { included: false },
    });
  } catch (error) {
    console.error('Waiver AI error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze waivers', details: String(error) },
      { status: 500 }
    );
  }
})
