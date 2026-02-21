import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  assembleTradeDecisionContext,
  contextToPromptV1,
  type TradeParty,
  type LeagueContextInput,
} from '@/lib/trade-engine/trade-context-assembler';
import {
  runPeerReviewAnalysis,
} from '@/lib/trade-engine/dual-brain-trade-analyzer';
import { runQualityGate } from '@/lib/trade-engine/quality-gate';
import { formatTradeResponse } from '@/lib/trade-engine/trade-response-formatter';
import type { TradeDecisionContextV1 } from '@/lib/trade-engine/trade-decision-context';
import { buildTradeAnalyzerIntelPrompt } from '@/lib/trade-engine/trade-analyzer-intel'

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

function buildDataGapsPrompt(ctx: TradeDecisionContextV1): string {
  const flags: string[] = []
  if (ctx.missingData.valuationsMissing.length > 0) flags.push(`Missing valuations for: ${ctx.missingData.valuationsMissing.join(', ')}`)
  if (ctx.missingData.injuryDataStale) flags.push('Injury data may be stale')
  if (ctx.missingData.tradeHistoryInsufficient) flags.push('Limited trade history available')
  if (ctx.missingData.adpMissing.length > 0) flags.push(`Missing ADP for: ${ctx.missingData.adpMissing.join(', ')}`)
  if (ctx.missingData.analyticsMissing.length > 0) flags.push(`Missing analytics for: ${ctx.missingData.analyticsMissing.join(', ')}`)

  if (flags.length === 0) return ''

  return `DATA GAPS (reduce confidence accordingly):\n${flags.map(f => `- ${f}`).join('\n')}`
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sideA, sideB, leagueContext, leagueId } = await req.json();

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
    const tradeContext = await assembleTradeDecisionContext(partyA, partyB, parsedLeague)
    const stageALatency = Date.now() - stageAStart

    console.log(`[dynasty-trade-analyzer] Stage A assembled in ${stageALatency}ms — ctx=${tradeContext.contextId}, ${tradeContext.dataQuality.assetsCovered}/${tradeContext.dataQuality.assetsTotal} assets (${tradeContext.dataQuality.coveragePercent}%), ${tradeContext.dataQuality.warnings.length} warnings`)

    const intelPrompt = await buildTradeAnalyzerIntelPrompt(tradeContext).catch(() => '')
    const factLayerPrompt = [contextToPromptV1(tradeContext), intelPrompt].filter(Boolean).join('\n\n')
    const dataGapsPrompt = buildDataGapsPrompt(tradeContext)

    const stageBStart = Date.now()
    const consensus = await runPeerReviewAnalysis({
      factLayerPrompt,
      dataGapsPrompt: dataGapsPrompt || undefined,
    })
    const stageBLatency = Date.now() - stageBStart

    console.log(`[dynasty-trade-analyzer] Stage B completed in ${stageBLatency}ms`)

    if (!consensus) {
      return NextResponse.json({ error: 'Analysis failed — all AI providers returned empty results' }, { status: 500 });
    }

    const gate = runQualityGate(consensus, tradeContext)

    console.log(`[dynasty-trade-analyzer] Quality gate: ${gate.passed ? 'PASSED' : 'SOFT-FAIL'} | det-conf=${gate.deterministicConfidence} llm-conf=${gate.originalLLMConfidence} → final=${gate.adjustedConfidence} | ${gate.violations.length} violations`)
    for (const v of gate.violations) {
      console.log(`  [${v.severity}] ${v.rule}: ${v.detail}`)
    }

    const sections = formatTradeResponse(consensus, tradeContext, gate)

    const detVerdict = sections.deterministicVerdict

    return NextResponse.json({
      sections,
      deterministicVerdict: detVerdict,
      analysis: {
        winner: detVerdict.winner === 'Even' ? 'Even' : `Side ${detVerdict.winner}`,
        verdict: detVerdict.winnerLabel,
        confidence: detVerdict.confidence,
        factors: gate.filteredReasons,
        reasons: gate.filteredReasons,
        counters: gate.filteredCounters,
        warnings: gate.filteredWarnings,
        valueDelta: `Side A total=${tradeContext.sideA.totalValue}, Side B total=${tradeContext.sideB.totalValue}, delta=${tradeContext.valueDelta.absoluteDiff} (${tradeContext.valueDelta.percentageDiff}%)`,
        dynastyVerdict: detVerdict.winnerLabel,
        vetoRisk: detVerdict.vetoRisk,
        fairnessGrade: detVerdict.fairnessGrade,
        fairnessScore: detVerdict.fairnessScore,
        netValueDelta: detVerdict.netValueDelta,
        netValueDeltaPct: detVerdict.netValueDeltaPct,
        acceptanceProbability: detVerdict.acceptanceProbability,
        acceptanceLikelihood: detVerdict.acceptanceLikelihood,
        keyDrivers: detVerdict.keyDrivers,
        agingConcerns: gate.filteredWarnings.filter(w => w.toLowerCase().includes('age') || w.toLowerCase().includes('cliff') || w.toLowerCase().includes('declining')),
        recommendations: gate.filteredCounters.slice(0, 3),
      },
      aiCommentary: {
        aiVerdict: consensus.verdict,
        aiConfidence: gate.adjustedConfidence,
        reasons: gate.filteredReasons,
        counters: gate.filteredCounters,
        warnings: gate.filteredWarnings,
        consensusMethod: consensus.meta.consensusMethod,
        source: 'ai-peer-review',
      },
      peerReview: {
        verdict: consensus.verdict,
        confidence: gate.adjustedConfidence,
        deterministicConfidence: gate.deterministicConfidence,
        originalLLMConfidence: gate.originalLLMConfidence,
        reasons: gate.filteredReasons,
        counters: gate.filteredCounters,
        warnings: gate.filteredWarnings,
        consensusMethod: consensus.meta.consensusMethod,
        confidenceAdjustment: consensus.meta.confidenceAdjustment,
      },
      qualityGate: {
        passed: gate.passed,
        violationCount: gate.violations.length,
        violations: gate.violations.map(v => ({
          rule: v.rule,
          severity: v.severity,
          detail: v.detail,
          adjustment: v.adjustment,
        })),
        deterministicConfidence: gate.deterministicConfidence,
        originalLLMConfidence: gate.originalLLMConfidence,
        confidenceAdjusted: gate.adjustedConfidence,
      },
      stageA: {
        contextId: tradeContext.contextId,
        version: tradeContext.version,
        assembledAt: tradeContext.assembledAt,
        valueDelta: tradeContext.valueDelta,
        sideATotalValue: tradeContext.sideA.totalValue,
        sideBTotalValue: tradeContext.sideB.totalValue,
        dataQuality: tradeContext.dataQuality,
        missingData: tradeContext.missingData,
        tradeHistoryStats: tradeContext.tradeHistoryStats,
        dataSources: tradeContext.dataSources,
      },
      meta: {
        pipeline: '2-stage-v2-deterministic-first',
        stageALatencyMs: stageALatency,
        stageBLatencyMs: stageBLatency,
        totalLatencyMs: stageALatency + stageBLatency,
        providers: consensus.meta.providers.map(p => ({
          provider: p.provider,
          latencyMs: p.latencyMs,
          schemaValid: p.schemaValid,
          error: p.error,
        })),
        consensusMethod: consensus.meta.consensusMethod,
        confidenceAdjustment: consensus.meta.confidenceAdjustment,
        qualityGatePassed: gate.passed,
      },
    });
  } catch (err) {
    console.error('[dynasty-trade-analyzer] Error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
