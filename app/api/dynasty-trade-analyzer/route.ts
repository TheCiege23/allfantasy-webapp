import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { openaiChatJson, parseJsonContentFromChatCompletion } from '@/lib/openai-client';
import { xaiChatJson, parseTextFromXaiChatCompletion } from '@/lib/xai-client';
import { getPlayerADP, formatADPForPrompt } from '@/lib/adp-data';

type AnalyzerMode = 'openai' | 'grok' | 'both';

type TradeAnalysis = {
  winner?: string;
  valueDelta?: string;
  factors?: string[];
  confidence?: number;
  dynastyVerdict?: string;
  vetoRisk?: string;
  agingConcerns?: string[];
  recommendations?: string[];
  youGiveAdjusted?: string;
  youWantAdded?: string;
  reason?: string;
};

function readMode(): AnalyzerMode {
  const mode = String(process.env.TRADE_ANALYZER_MODE || 'openai').toLowerCase();
  if (mode === 'grok' || mode === 'both' || mode === 'openai') return mode;
  return 'openai';
}

function normalizeAnalysis(raw: unknown): TradeAnalysis | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const toStringList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : undefined;

  const normalized: TradeAnalysis = {
    winner: typeof obj.winner === 'string' ? obj.winner : undefined,
    valueDelta: typeof obj.valueDelta === 'string' ? obj.valueDelta : undefined,
    factors: toStringList(obj.factors),
    confidence:
      typeof obj.confidence === 'number'
        ? Math.max(0, Math.min(100, Math.round(obj.confidence)))
        : undefined,
    dynastyVerdict: typeof obj.dynastyVerdict === 'string' ? obj.dynastyVerdict : undefined,
    vetoRisk: typeof obj.vetoRisk === 'string' ? obj.vetoRisk : undefined,
    agingConcerns: toStringList(obj.agingConcerns),
    recommendations: toStringList(obj.recommendations),
    youGiveAdjusted: typeof obj.youGiveAdjusted === 'string' ? obj.youGiveAdjusted : undefined,
    youWantAdded: typeof obj.youWantAdded === 'string' ? obj.youWantAdded : undefined,
    reason: typeof obj.reason === 'string' ? obj.reason : undefined,
  };

  return normalized.winner || normalized.valueDelta || normalized.dynastyVerdict ? normalized : null;
}

function mergeAnalyses(openaiAnalysis: TradeAnalysis | null, grokAnalysis: TradeAnalysis | null): TradeAnalysis | null {
  if (!openaiAnalysis && !grokAnalysis) return null;
  if (openaiAnalysis && !grokAnalysis) return openaiAnalysis;
  if (!openaiAnalysis && grokAnalysis) return grokAnalysis;

  const oa = openaiAnalysis as TradeAnalysis;
  const ga = grokAnalysis as TradeAnalysis;

  const chooseWinner = () => {
    if (oa.winner && ga.winner && oa.winner === ga.winner) return oa.winner;
    const oaConf = oa.confidence ?? 50;
    const gaConf = ga.confidence ?? 50;
    return oaConf >= gaConf ? oa.winner || ga.winner : ga.winner || oa.winner;
  };

  const mergedFactors = Array.from(new Set([...(oa.factors || []), ...(ga.factors || [])])).slice(0, 7);
  const mergedRecs = Array.from(new Set([...(oa.recommendations || []), ...(ga.recommendations || [])])).slice(0, 4);

  return {
    winner: chooseWinner(),
    valueDelta: oa.valueDelta || ga.valueDelta,
    factors: mergedFactors.length ? mergedFactors : undefined,
    confidence: Math.round(((oa.confidence ?? 55) + (ga.confidence ?? 55)) / 2),
    dynastyVerdict: oa.dynastyVerdict || ga.dynastyVerdict,
    vetoRisk: oa.vetoRisk || ga.vetoRisk,
    agingConcerns: Array.from(new Set([...(oa.agingConcerns || []), ...(ga.agingConcerns || [])])).slice(0, 5),
    recommendations: mergedRecs.length ? mergedRecs : undefined,
    youGiveAdjusted: oa.youGiveAdjusted || ga.youGiveAdjusted,
    youWantAdded: oa.youWantAdded || ga.youWantAdded,
    reason: oa.reason || ga.reason,
  };
}

async function callOpenAI(systemPrompt: string, userPrompt: string) {
  const result = await openaiChatJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.45,
    maxTokens: 1500,
  });

  if (!result.ok) {
    return { ok: false as const, error: result.details };
  }

  const parsed = parseJsonContentFromChatCompletion(result.json);
  return { ok: true as const, analysis: normalizeAnalysis(parsed) };
}

async function callGrok(systemPrompt: string, userPrompt: string) {
  const result = await xaiChatJson({
    messages: [
      { role: 'system', content: `${systemPrompt}\nYou must return valid JSON only.` },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.35,
    maxTokens: 1500,
    tools: [{ type: 'web_search' }],
  });

  if (!result.ok) {
    return { ok: false as const, error: result.details };
  }

  const text = parseTextFromXaiChatCompletion(result.json);
  if (!text) return { ok: true as const, analysis: null };

  try {
    return { ok: true as const, analysis: normalizeAnalysis(JSON.parse(text)) };
  } catch {
    return { ok: true as const, analysis: null };
  }
}

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
    const mode = readMode();

    const [openAiRes, grokRes] = await Promise.all([
      mode === 'grok' ? Promise.resolve(null) : callOpenAI(systemPrompt, userPrompt),
      mode === 'openai' ? Promise.resolve(null) : callGrok(systemPrompt, userPrompt),
    ]);

    const analysis = mergeAnalyses(openAiRes?.analysis ?? null, grokRes?.analysis ?? null);

    if (!analysis) {
      console.error('[dynasty-trade-analyzer] All providers failed', {
        mode,
        openai: openAiRes && !openAiRes.ok ? openAiRes.error : undefined,
        grok: grokRes && !grokRes.ok ? grokRes.error : undefined,
      });
      return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
    }

    return NextResponse.json({
      analysis,
      meta: {
        mode,
        providerStatus: {
          openai: openAiRes ? (openAiRes.ok && openAiRes.analysis ? 'ok' : 'failed') : 'skipped',
          grok: grokRes ? (grokRes.ok && grokRes.analysis ? 'ok' : 'failed') : 'skipped',
        },
      },
    });
  } catch (err) {
    console.error('[dynasty-trade-analyzer] Error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
