import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runDualBrainTradeAnalysis } from '@/lib/trade-engine/dual-brain-trade-analyzer';
import { getPlayerADP, getLiveADP, formatADPForPrompt } from '@/lib/adp-data';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sideA, sideB, leagueContext, counterFromPartner } = await req.json();

  if (!sideA || !sideB) {
    return NextResponse.json(
      { error: 'Both sides of the trade are required' },
      { status: 400 },
    );
  }

  let adpContext = '';
  try {
    const allAssets = `${sideA}, ${sideB}`;
    const playerNames = allAssets
      .split(/,|and/i)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 2 && !/^\d{4}\s/.test(s) && !/pick/i.test(s));

    const adpLookups = await Promise.all(
      playerNames.slice(0, 12).map((name: string) => getPlayerADP(name))
    );
    const foundAdp = adpLookups.filter(Boolean);

    if (foundAdp.length > 0) {
      adpContext = `\n\nLive Dynasty ADP & Values (use these for accurate valuation):\n${formatADPForPrompt(foundAdp as any, 20)}`;
    }
  } catch (err) {
    console.warn('[dynasty-trade-analyzer] ADP fetch failed, continuing without:', err);
  }

  const systemPrompt = counterFromPartner
    ? `You are a dynasty fantasy football team manager who just received a trade offer. You must return ONLY valid JSON. You are interested in the deal but want slightly better terms. Use realistic dynasty valuation logic grounded in age curves, positional scarcity, draft capital value, and long-term production windows. When ADP data is provided, use it as the primary source for player values. Be reasonable — your counter should be close to fair, not a fleece.`
    : `You are a top dynasty fantasy football analyst. You must return ONLY valid JSON. Never hallucinate player stats or values — if uncertain, say so. Use realistic dynasty valuation logic grounded in age curves, positional scarcity, draft capital value, and long-term production windows. When ADP data is provided, use it as the primary source for player values.`;

  let promptRole = 'Evaluate this trade as a neutral analyst.';
  if (counterFromPartner) {
    promptRole = `You are the partner team countering the user's offer. Suggest a realistic counter that improves your side slightly while still being acceptable.`;
  }

  const userPrompt = counterFromPartner
    ? `${promptRole}

Trade proposed to you:
User offers: ${sideA}
You would give: ${sideB}${adpContext}

Suggest a counter-offer — what do you ask for instead to make the deal work for you?

Output JSON only:
{
  "winner": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "valueDelta": "short explanation of value gap you see in the original offer",
  "factors": ["array of 3-5 reasons why you want a better deal"],
  "confidence": number 0-100,
  "dynastyVerdict": "1-2 sentence take on the trade from your perspective",
  "youGiveAdjusted": "what you would give instead (realistic counter)",
  "youWantAdded": "what extra piece you want from the user (e.g. a future pick, a prospect)",
  "reason": "1-2 sentence explanation of why this counter is fair",
  "recommendations": ["1-2 suggestions for how the user could sweeten the deal"]
}`
    : `${promptRole}

Evaluate this trade in a dynasty context (${leagueContext || 'standard SF PPR'}).

Trade:
Team A receives: ${sideA}
Team B receives: ${sideB}${adpContext}

Output JSON only:
{
  "winner": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "valueDelta": "short explanation of value difference (e.g. Team A wins by ~15-20% long-term value)",
  "factors": ["array of 4-7 bullet points explaining key reasons (aging, position scarcity, future picks, etc.)"],
  "confidence": number 0-100,
  "dynastyVerdict": "1-2 sentence dynasty-specific take",
  "vetoRisk": "None" | "Low" | "Moderate" | "High" with brief reason,
  "agingConcerns": ["any aging-related concerns for either side"],
  "recommendations": ["1-3 actionable follow-up suggestions"]
}`;

  try {
    const consensus = await runDualBrainTradeAnalysis({
      systemPrompt,
      userPrompt,
      temperature: 0.45,
      maxTokens: 1500,
    });

    if (!consensus) {
      console.error('[dynasty-trade-analyzer] Dual-brain returned no consensus');
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    return NextResponse.json({ analysis: consensus });
  } catch (err) {
    console.error('[dynasty-trade-analyzer] Error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
