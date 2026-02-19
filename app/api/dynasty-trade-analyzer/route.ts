import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  assembleTradeContext,
  contextToPrompt,
  type TradeParty,
  type LeagueContextInput,
  type TradeContextSnapshot,
} from '@/lib/trade-engine/trade-context-assembler';
import {
  runDualBrainTradeAnalysis,
  type DualBrainRequest,
} from '@/lib/trade-engine/dual-brain-trade-analyzer';

function parseLeagueContext(raw: string | undefined): LeagueContextInput {
  if (!raw) return {}

  const lower = raw.toLowerCase()
  return {
    scoringType: lower.includes('half') ? 'Half PPR' : lower.includes('standard') ? 'Standard' : 'PPR',
    isSF: lower.includes('sf') || lower.includes('superflex') || lower.includes('super flex'),
    isTEP: lower.includes('tep') || lower.includes('te premium'),
    numTeams: (() => {
      const match = raw.match(/(\d+)\s*(?:team|man)/i)
      return match ? parseInt(match[1]) : 12
    })(),
  }
}

function buildSystemPrompt(ctx: TradeContextSnapshot, isCounter: boolean): string {
  const base = isCounter
    ? `You are a dynasty fantasy football team manager who just received a trade offer. You must return ONLY valid JSON. You are interested in the deal but want slightly better terms. Use the deterministic fact layer below as your SOLE source of truth for valuations, roster composition, and league context. Do not hallucinate values — use the numbers provided. Be reasonable — your counter should be close to fair, not a fleece.`
    : `You are a top dynasty fantasy football analyst. You must return ONLY valid JSON. Never hallucinate player stats or values — the deterministic fact layer below is your SOLE source of truth. Use the provided market values, ADP, injury data, analytics, and manager context to make your evaluation. If data quality warnings exist, factor uncertainty into your confidence score.`

  return `${base}

IMPORTANT: The fact layer below was assembled deterministically from live data sources. Trust these numbers over your training data. Your role is DECISION-MAKING only — the facts have already been established.`
}

function buildUserPrompt(ctx: TradeContextSnapshot, isCounter: boolean): string {
  const factLayer = contextToPrompt(ctx)

  if (isCounter) {
    return `${factLayer}

You are the partner team countering the user's offer. Suggest a realistic counter that improves your side slightly while still being acceptable.

The user offers Side A assets. You would give Side B assets.

Output JSON only:
{
  "winner": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "valueDelta": "short explanation of value gap based on the fact layer numbers",
  "factors": ["array of 3-5 reasons grounded in the data above"],
  "confidence": number 0-100 (lower if data quality is low),
  "dynastyVerdict": "1-2 sentence dynasty take referencing specific player ages, values, and needs",
  "vetoRisk": "None" | "Low" | "Moderate" | "High" with brief reason,
  "youGiveAdjusted": "what you would give instead (realistic counter)",
  "youWantAdded": "what extra piece you want from the user",
  "reason": "1-2 sentence explanation of why this counter is fair based on the numbers",
  "recommendations": ["1-2 suggestions grounded in the data"],
  "agingConcerns": ["any aging-related concerns based on player ages in the data"]
}`
  }

  return `${factLayer}

Evaluate this trade as a neutral analyst using the deterministic fact layer above as your sole source of truth.

Output JSON only:
{
  "winner": "Team A" | "Team B" | "Even" | "Slight edge to Team A" | "Slight edge to Team B",
  "valueDelta": "explanation referencing actual market values from the data (e.g. 'Side A total=X, Side B total=Y, delta=Z')",
  "factors": ["array of 4-7 bullet points grounded in the data above — reference specific values, ADP ranks, injury status, analytics scores"],
  "confidence": number 0-100 (reduce for low data quality, missing ADP, etc.),
  "dynastyVerdict": "1-2 sentence dynasty-specific take referencing player ages, cornerstones, and volatility",
  "vetoRisk": "None" | "Low" | "Moderate" | "High" — base on the percentage value delta,
  "agingConcerns": ["any aging-related concerns citing specific player ages"],
  "recommendations": ["1-3 actionable follow-up suggestions referencing needs/surplus data if available"]
}`
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sideA, sideB, leagueContext, leagueId, counterFromPartner } = await req.json();

  if (!sideA || !sideB) {
    return NextResponse.json(
      { error: 'Both sides of the trade are required' },
      { status: 400 },
    );
  }

  try {
    const parsedLeague = parseLeagueContext(leagueContext)
    if (leagueId) parsedLeague.leagueId = leagueId

    const sideAAssets = sideA.split(/,|and/i).map((s: string) => s.trim()).filter((s: string) => s.length > 1)
    const sideBAssets = sideB.split(/,|and/i).map((s: string) => s.trim()).filter((s: string) => s.length > 1)

    const partyA: TradeParty = { name: 'Team A', assets: sideAAssets }
    const partyB: TradeParty = { name: 'Team B', assets: sideBAssets }

    const stageAStart = Date.now()
    const tradeContext = await assembleTradeContext(partyA, partyB, parsedLeague)
    const stageALatency = Date.now() - stageAStart

    console.log(`[dynasty-trade-analyzer] Stage A assembled in ${stageALatency}ms — ${tradeContext.dataQuality.playersCovered}/${tradeContext.dataQuality.playersTotal} players valued, ${tradeContext.dataQuality.adpHitRate}% ADP hit, ${tradeContext.dataQuality.warnings.length} warnings`)

    const systemPrompt = buildSystemPrompt(tradeContext, !!counterFromPartner)
    const userPrompt = buildUserPrompt(tradeContext, !!counterFromPartner)

    const stageBStart = Date.now()
    const consensus = await runDualBrainTradeAnalysis({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 1800,
    })
    const stageBLatency = Date.now() - stageBStart

    console.log(`[dynasty-trade-analyzer] Stage B completed in ${stageBLatency}ms`)

    if (!consensus) {
      return NextResponse.json({ error: 'Analysis failed — all AI providers returned empty results' }, { status: 500 });
    }

    return NextResponse.json({
      analysis: {
        winner: consensus.winner,
        valueDelta: consensus.valueDelta,
        factors: consensus.factors,
        confidence: consensus.confidence,
        dynastyVerdict: consensus.dynastyVerdict,
        vetoRisk: consensus.vetoRisk,
        agingConcerns: consensus.agingConcerns,
        recommendations: consensus.recommendations,
        youGiveAdjusted: consensus.youGiveAdjusted,
        youWantAdded: consensus.youWantAdded,
        reason: consensus.reason,
      },
      stageA: {
        valueDelta: tradeContext.valueDelta,
        sideATotalValue: tradeContext.sideA.totalValue,
        sideBTotalValue: tradeContext.sideB.totalValue,
        dataQuality: tradeContext.dataQuality,
        leagueTradeHistory: tradeContext.leagueTradeHistory,
      },
      meta: {
        pipeline: '2-stage',
        stageALatencyMs: stageALatency,
        stageBLatencyMs: stageBLatency,
        totalLatencyMs: stageALatency + stageBLatency,
        providers: consensus.meta.providers.map(p => ({
          provider: p.provider,
          latencyMs: p.latencyMs,
          schemaValid: p.schemaValid,
          confidenceScore: p.confidenceScore,
          error: p.error,
        })),
        consensusMethod: consensus.meta.consensusMethod,
        primaryProvider: consensus.meta.primaryProvider,
      },
    });
  } catch (err) {
    console.error('[dynasty-trade-analyzer] Error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
