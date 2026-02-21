import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { computeDualModeTradeDelta, UserTrade, ValuationContext } from '@/lib/hybrid-valuation';
import { generateAlternatives, AlternativesResult } from '@/lib/trade-alternatives';

const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1' });

export interface AlternativeExplanation {
  recommended: string;
  reasoning: string[];
  confidence: 'High' | 'Medium' | 'Low';
  alternatives: AlternativesResult;
}

async function generateAIExplanation(
  originalTrade: string,
  alternatives: AlternativesResult
): Promise<{ recommended: string; reasoning: string[]; confidence: 'High' | 'Medium' | 'Low' }> {
  if (!alternatives.bestAlternative || alternatives.alternatives.length === 0) {
    return {
      recommended: 'No better alternatives found',
      reasoning: ['Your trade was reasonably valued at the time'],
      confidence: 'Low'
    };
  }

  const altDescriptions = alternatives.alternatives
    .slice(0, 3)
    .map((a, i) => `${i + 1}. ${a.label} (would improve by ${a.deltaImprovement.toFixed(0)} points)`)
    .join('\n');

  const prompt = `You are a fantasy football trade advisor. Analyze this trade and the alternatives that could have been better.

ORIGINAL TRADE: ${originalTrade}
ORIGINAL DELTA: ${alternatives.originalDelta.toFixed(0)} points
ORIGINAL GRADE: ${alternatives.originalGrade}

BETTER ALTERNATIVES IDENTIFIED:
${altDescriptions}

BEST ALTERNATIVE: ${alternatives.bestAlternative.label}
IMPROVEMENT: +${alternatives.bestAlternative.deltaImprovement.toFixed(0)} points

Your task:
1. Recommend the best alternative (use the one identified)
2. Provide 2-3 short, specific reasons why it would have been better
3. Assess your confidence (High/Medium/Low) based on how clear the improvement is

Respond in JSON format:
{
  "recommended": "brief statement of the better trade",
  "reasoning": ["reason 1", "reason 2", "reason 3"],
  "confidence": "High" | "Medium" | "Low"
}

Be coaching-focused, not judgmental. Focus on what could have been, not what was wrong.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    return {
      recommended: parsed.recommended || alternatives.bestAlternative.label,
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : ['This alternative would have yielded better value'],
      confidence: (['High', 'Medium', 'Low'].includes(parsed.confidence) ? parsed.confidence : 'Medium') as 'High' | 'Medium' | 'Low'
    };
  } catch (error) {
    console.error('AI explanation error:', error);
    return {
      recommended: alternatives.bestAlternative.label,
      reasoning: [
        `This alternative would improve your return by ${alternatives.bestAlternative.deltaImprovement.toFixed(0)} points`,
        'The market values at the time supported this alternative'
      ],
      confidence: 'Medium'
    };
  }
}

export const POST = withApiUsage({ endpoint: "/api/legacy/trade-alternatives", tool: "LegacyTradeAlternatives" })(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { trade, userId, isSuperFlex = false } = body;

    console.log('[trade-alternatives] Request received:', { 
      transactionId: trade?.transactionId,
      userId, 
      partiesCount: trade?.parties?.length,
      partyUserIds: trade?.parties?.map((p: any) => p.userId)
    });

    if (!trade || !userId) {
      return NextResponse.json({ error: 'Missing trade or userId' }, { status: 400 });
    }

    if (!trade.parties || trade.parties.length < 2) {
      return NextResponse.json({ error: 'Trade must have at least 2 parties' }, { status: 400 });
    }

    const userTrade = trade as UserTrade;
    const asOfDate = new Date(userTrade.timestamp).toISOString().split('T')[0];
    
    const ctx: ValuationContext = {
      asOfDate,
      isSuperFlex
    };

    const dual = await computeDualModeTradeDelta(userTrade, userId, isSuperFlex);
    const tradeDelta = dual.atTheTime;

    if (!tradeDelta) {
      return NextResponse.json({ error: 'Could not compute trade delta' }, { status: 400 });
    }

    const alternatives = await generateAlternatives(userTrade, userId, tradeDelta, ctx);

    const receivedNames = tradeDelta.receivedAssets.map(a => a.name).join(', ') || 'picks';
    const gaveNames = tradeDelta.gaveAssets.map(a => a.name).join(', ') || 'picks';
    const originalTradeSummary = `Received ${receivedNames} for ${gaveNames}`;

    const aiExplanation = await generateAIExplanation(originalTradeSummary, alternatives);

    const response: AlternativeExplanation = {
      ...aiExplanation,
      alternatives
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Trade alternatives error:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate alternatives' }, { status: 500 });
  }
})
