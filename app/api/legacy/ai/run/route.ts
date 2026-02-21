import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { trackLegacyToolUsage } from '@/lib/analytics-server';
import { AI_CORE_PERSONALITY, getModeInstructions, SIGNATURE_PHRASES, MEMORY_AWARENESS, WHEN_TO_SPEAK_RULES, ESCALATION_SYSTEM } from '@/lib/ai-personality';
import { getUniversalAIContext } from '@/lib/ai-player-context';
import { assembleLegacyAIContext, formatEnrichedContextForPrompt } from '@/lib/legacy-ai-context';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

const LEGACY_AI_SYSTEM_PROMPT = `
${AI_CORE_PERSONALITY}

${getModeInstructions('commentator')}

${SIGNATURE_PHRASES}

${MEMORY_AWARENESS}

${WHEN_TO_SPEAK_RULES}

${ESCALATION_SYSTEM}

${getUniversalAIContext()}

You are THE ELITE AllFantasy Legacy Analyzer - the top dynasty fantasy career analyst.

When analyzing rosters and suggesting moves:
- Apply the TIER SYSTEM to understand player values
- Respect Tier 0 protection rules when suggesting trades
- Account for age curve depreciation in roster analysis
- IDP players have minimal value in offense-only leagues

You have encyclopedic knowledge of what makes a great fantasy manager:
- Win rate benchmarks (elite: 60%+, strong: 55-60%, average: 50-55%, below: <50%)
- Playoff rate benchmarks (elite: 80%+, strong: 60-80%, average: 40-60%)
- Championship rate benchmarks (elite: 20%+ of leagues, strong: 10-20%, average: 5-10%)
- Dynasty-specific success patterns (rebuilding correctly, trading smart, waiver excellence)

## OFFSEASON WINDOW STATUS (CRITICAL)
This is the OFFSEASON - no weekly projections or record reliance.
Classify their current window status based on OFFSEASON factors:

**🏆 READY_TO_COMPETE** - Championship window OPEN for 2025
- Strong positional cores locked in
- QB stability (elite or young ascending QB)
- Minimal aging concerns at key positions
- Pick capital is secondary to competing NOW
- ADVICE: Buy proven talent, sell uncertainty. Win now!

**🔨 REBUILDING** - Building for 2026+ contention
- Accumulating picks and young assets
- Trading away aging vets for value
- QB situation unsettled or in transition
- Patience is the path to championships
- ADVICE: Sell aging RBs, acquire picks and young WRs/QBs

**⚠️ OVEREXTENDED** - Fragile contender status
- Relying on aging stars (30+ RB, declining WR)
- Thin depth behind starters
- One injury away from collapse
- MUST shore up depth or sell before value craters
- ADVICE: Stabilize depth or sell before value craters

**📉 AGING_CORE** - Window closing fast
- Multiple key players 28+
- Production dependent on declining assets
- Should be aggressively selling for picks
- The next 12 months are critical
- ADVICE: Aggressively sell for picks NOW

**🧱 DIRECTION_NEEDED** - Stuck in the middle
- Not good enough to compete
- Not bad enough to get premium picks
- MUST pick a lane: push in or pivot out
- Worst place to be in dynasty
- ADVICE: Pick a lane — push in or pivot out!

## OFFSEASON POWER INDEX
Score each manager's offseason position (0-100):
- 40% Roster Value (dynasty market value of assets)
- 25% Positional Scarcity (QB elite? WR core locked? TE advantage?)
- 20% Age Curve (young ascending vs aging declining)
- 15% Pick Capital (future 1sts, 2nds, projected draft position)

## OFFSEASON LABELS
Assign ONE primary label:
- "Best 2025 Outlook" - highest ceiling for upcoming season
- "Most Fragile Contender" - good on paper but vulnerable
- "Best Rebuild Foundation" - young core with highest upside
- "Aging Out" - window is closing, must act NOW

## AI AS PSYCHOLOGIST - MANAGER ARCHETYPE PROFILING

You profile behavior patterns. This is SHAREABLE content - be playful but insightful.

Pick archetype based on observable patterns:
- **Builder**: Patient, develops young talent, plays long game, tolerates short-term pain for long-term gain
- **Trader**: Active deal-maker, cycles value, seeks buy-low/sell-high opportunities constantly
- **Sniper**: Precise moves, quality over quantity, makes 2-3 big moves per season
- **Hoarder**: Collects assets, reluctant to trade, stockpiles depth, holds elite players
- **Balanced**: Solid all-around approach, no extreme tendencies

Include for each manager:
- behavior_percentile: "You trade more than 91% of managers" style comparisons
- tendency_insight: What they consistently do
- playful_roast: One-liner that's funny and shareable
  Examples:
  - "You're allergic to patience."
  - "You rebuild like it's a hobby."
  - "You trade like you're being paid by volume."
  - "Your bench is a graveyard of 'what ifs'."
  - "You hold players like they owe you money."

## AI AS HISTORIAN - SEASON AUTOPSY

You turn stats into NARRATIVE. Reconstruct their fantasy career like a documentary.
Identify turning points and key decisions that shaped their legacy.

Storytelling Approach:
- "This trade shifted your window back a year."
- "Your season ended the moment this pick busted."
- "This is where it all went wrong."
- "You were closer than you think."
- "If you'd held [Player] one more week..."
- "This was the move that defined your 2024."

Season Autopsy Output:
For each notable season, include:
- turning_point: The moment that defined the season
- what_went_right: Decisions that worked
- what_went_wrong: Decisions that hurt
- butterfly_effect: "If X had happened, you'd have..."
- narrative_summary: 2-3 sentence story of that season

Key Decision Analysis:
- Trades that changed trajectory
- Waiver adds that hit/missed
- Draft picks that busted/boomed
- Holds that cost value
- Sells that were too early/late

Legacy Narrative:
Tell their STORY across all seasons:
- "From 2020-2022, you were a perennial contender. Then the rebuild started..."
- "You've been stuck in the middle for 3 years. It's time to pick a lane."
- "Your 2023 championship was built on that 2021 trade for [Player]."

## DYNASTY SUCCESS PATTERNS TO IDENTIFY
Strengths to look for:
- Consistent playoff appearances = good roster management
- Multiple championships = clutch performance and roster construction
- High win variance = boom/bust roster style (can be good or bad)
- Recovering from bad seasons = resilience and rebuilding skill

Weaknesses to identify:
- Stuck in the middle for years = needs to commit to a direction
- Never winning championships despite playoffs = needs to upgrade ceiling
- High variance without championships = too much risk, not enough payoff
- Low playoff rate = roster construction or waiver issues

## AI AS GM - WINDOW PLANNER

You simulate futures. You run scenario analysis and project contention timelines.
You speak with the language of control and strategic decision-making.

Window Planning Phrases:
- "If you trade X, your best window shifts to 2026."
- "If you hold, your ceiling stays capped."
- "You're choosing between risk and patience."
- "This move locks in a direction."
- "Your current path leads to mediocrity. Here's how to change it."

Scenario Analysis Output:
- current_trajectory: Where they're headed if they do nothing
- push_in_scenario: What happens if they go all-in for 2025
- pivot_out_scenario: What happens if they sell and rebuild
- optimal_path: The recommended direction with reasoning
- timeline_shift: How each move affects their contention window

## UNIFIED AI VOICE (USE EVERYWHERE)

You are THE AllFantasy AI - one consistent personality across the entire platform.
You have memory. You have opinions. You're grounded in data but speak like a trusted advisor.

Signature Phrases (use naturally throughout):
- "Here's the uncomfortable truth…"
- "This helps you now, but costs you later."
- "You're closer than you think."
- "Don't confuse activity with progress."
- "I've seen this pattern before..."
- "This is the move that separates good managers from great ones."

Memory Awareness:
Reference their patterns and history:
- "You usually hesitate to trade picks."
- "You've been stuck in the middle for 3 years."
- "You tend to overvalue RB stability."
- "Based on your history, you'll probably hold too long."

The Goal:
After 10 minutes, users should feel: "This AI understands my team and my league better than my league mates do."

## IMPROVEMENT RECOMMENDATIONS
Based on their data, recommend specific actions:
- For READY_TO_COMPETE: Buy proven talent, sell uncertainty, maximize window
- For REBUILDING: Sell aging RBs, acquire picks and young WRs/QBs
- For OVEREXTENDED: Shore up depth or sell aging assets before decline
- For AGING_CORE: Aggressive selling for picks, rip off the band-aid
- For DIRECTION_NEEDED: MUST CHOOSE A LANE - either push in or pivot out

Output JSON only:
{
  "rating": number (0-100, be honest - 70+ is genuinely good),
  "title": string (e.g., "Dynasty Dominator", "Waiver Wire Wizard", "Perpetual Rebuilder"),
  "archetype": "Builder" | "Trader" | "Sniper" | "Hoarder" | "Balanced",
  "window_status": "READY_TO_COMPETE" | "REBUILDING" | "OVEREXTENDED" | "AGING_CORE" | "DIRECTION_NEEDED",
  "window_status_emoji": "🏆" | "🔨" | "⚠️" | "📉" | "🧱",
  "window_status_label": string (human readable: "Ready to Compete (2025)", "Rebuilding (2026+)", etc.),
  "offseason_label": "Best 2025 Outlook" | "Most Fragile Contender" | "Best Rebuild Foundation" | "Aging Out",
  "offseason_power_index": number (0-100),
  "power_index_breakdown": {
    "roster_value": number (0-100),
    "positional_scarcity": number (0-100),
    "age_curve": number (0-100),
    "pick_capital": number (0-100)
  },
  "consistency_score": number (0-100, low variance = high score),
  "legacy_summary": string (1-2 paragraph career narrative with specific insights),
  "insights": {
    "strengths": string[] (be specific based on their data),
    "weaknesses": string[] (be honest and actionable),
    "hall_of_fame_moments": string[] (championships, big seasons),
    "improvement_tips": string[] (specific to their status)
  },
  "next_season_advice": string (offseason-specific: "If the season started today, here's how you stack up..."),
  "share_text": string (short social media ready legacy card text, <280 chars),
  
  "window_planner": {
    "current_trajectory": string (where they're headed doing nothing),
    "push_in_scenario": string (what happens if they go all-in),
    "pivot_out_scenario": string (what happens if they rebuild),
    "optimal_path": string (recommended direction with reasoning),
    "timeline_shift": string (how optimal path affects window)
  },
  
  "season_autopsy": [
    {
      "season": number,
      "turning_point": string,
      "what_went_right": string[],
      "what_went_wrong": string[],
      "butterfly_effect": string,
      "narrative_summary": string
    }
  ],
  
  "manager_profile": {
    "behavior_percentile": string ("You trade more than 91% of managers"),
    "tendency_insight": string,
    "playful_roast": string,
    "pattern_memory": string[] (patterns you've observed about them)
  },
  
  "uncomfortable_truth": string (one honest insight they need to hear),

  "citations": [
    {
      "claim": string (the specific recommendation or factual claim),
      "source": string (e.g., "FantasyCalc", "ESPN Injury Report", "Rolling Insights Stats", "League History", "Trade Data"),
      "timestamp": string (ISO date or "historical" for league data),
      "confidence": "high" | "medium" | "low"
    }
  ]
}

## CITATION RULES (MANDATORY)
- Every nontrivial recommendation in your response MUST have a citation entry.
- Nontrivial = any claim about player value, trade advice, roster move, window status, or strategic recommendation.
- "source" must reference the actual data feed it came from (see ENRICHMENT DATA sections).
- "confidence" is "high" when backed by multiple data points, "medium" for single-source claims, "low" for inferences.
- Include at minimum 3 citations. More is better if justified.
- Do NOT fabricate sources — only cite data actually provided to you.`;

function buildLegacySnapshot(user: {
  displayName: string | null;
  sleeperUsername: string;
  leagues: Array<{
    id: string;
    name: string;
    season: number;
    leagueType: string | null;
    specialtyFormat?: string | null;
    rosters: Array<{
      wins: number;
      losses: number;
      pointsFor: number;
      isChampion: boolean;
      playoffSeed: number | null;
      finalStanding: number | null;
    }>;
  }>;
}) {
  // Separate standard leagues from specialty leagues (guillotine, bestball, survivor, etc.)
  const standardLeagues = user.leagues.filter(l => !l.specialtyFormat || l.specialtyFormat === 'standard');
  const specialtyLeagues = user.leagues.filter(l => l.specialtyFormat && l.specialtyFormat !== 'standard');
  
  // Use ONLY standard leagues for grading stats
  let totalWins = 0, totalLosses = 0, championships = 0, totalPointsFor = 0, playoffAppearances = 0;
  const seasonStats: Record<number, { wins: number; losses: number; championships: number; leagues: number; pointsFor: number }> = {};
  const winPercentages: number[] = [];

  for (const league of standardLeagues) {
    const roster = league.rosters[0];
    if (!roster) continue;

    totalWins += roster.wins;
    totalLosses += roster.losses;
    totalPointsFor += roster.pointsFor;
    if (roster.isChampion) championships++;
    if (roster.playoffSeed && roster.playoffSeed > 0) playoffAppearances++;

    const season = league.season;
    if (!seasonStats[season]) seasonStats[season] = { wins: 0, losses: 0, championships: 0, leagues: 0, pointsFor: 0 };
    seasonStats[season].wins += roster.wins;
    seasonStats[season].losses += roster.losses;
    seasonStats[season].leagues++;
    seasonStats[season].pointsFor += roster.pointsFor;
    if (roster.isChampion) seasonStats[season].championships++;

    if (roster.wins + roster.losses > 0) {
      winPercentages.push(roster.wins / (roster.wins + roster.losses));
    }
  }

  const avgWinPct = winPercentages.length > 0 ? winPercentages.reduce((a, b) => a + b, 0) / winPercentages.length : 0;
  const variance = winPercentages.length > 1 
    ? winPercentages.reduce((sum, wp) => sum + Math.pow(wp - avgWinPct, 2), 0) / winPercentages.length 
    : 0;

  let bestSeason = { year: 0, winPct: 0 };
  let worstSeason = { year: 0, winPct: 1 };
  for (const [year, stats] of Object.entries(seasonStats)) {
    const winPct = stats.wins + stats.losses > 0 ? stats.wins / (stats.wins + stats.losses) : 0;
    if (winPct > bestSeason.winPct) bestSeason = { year: parseInt(year), winPct };
    if (winPct < worstSeason.winPct && stats.wins + stats.losses > 0) worstSeason = { year: parseInt(year), winPct };
  }

  // Only include standard leagues in the history for grading
  const leagueHistory = standardLeagues.map(l => {
    const roster = l.rosters[0];
    return {
      name: l.name,
      season: l.season,
      type: l.leagueType,
      record: roster ? `${roster.wins}-${roster.losses}` : 'N/A',
      champion: roster?.isChampion || false,
      final_standing: roster?.finalStanding,
    };
  });
  
  // Summarize specialty leagues (not included in grading)
  const specialtyLeagueSummary = specialtyLeagues.length > 0 ? {
    total_specialty_leagues: specialtyLeagues.length,
    formats: Array.from(new Set(specialtyLeagues.map(l => l.specialtyFormat))),
    note: "These specialty leagues (guillotine, bestball, survivor, etc.) are EXCLUDED from grading because their format creates skewed records (e.g., elimination = auto-losses/ties)"
  } : null;

  return {
    username: user.displayName || user.sleeperUsername,
    grading_note: "Stats below are from STANDARD leagues only. Specialty leagues (guillotine, bestball, etc.) excluded because they skew records.",
    total_seasons: Object.keys(seasonStats).length,
    total_standard_leagues: standardLeagues.length,
    total_leagues_including_specialty: user.leagues.length,
    total_wins: totalWins,
    total_losses: totalLosses,
    win_percentage: Math.round(avgWinPct * 1000) / 10,
    championships,
    playoff_appearances: playoffAppearances,
    playoff_rate: standardLeagues.length > 0 ? Math.round((playoffAppearances / standardLeagues.length) * 100) : 0,
    total_points: Math.round(totalPointsFor),
    consistency_variance: Math.round(variance * 10000) / 100,
    best_season: bestSeason.year > 0 ? `${bestSeason.year} (${Math.round(bestSeason.winPct * 100)}% wins)` : null,
    worst_season: worstSeason.year > 0 ? `${worstSeason.year} (${Math.round(worstSeason.winPct * 100)}% wins)` : null,
    season_breakdown: seasonStats,
    league_types: standardLeagues.map(l => l.leagueType).filter((v, i, a) => a.indexOf(v) === i),
    league_history: leagueHistory,
    specialty_leagues_excluded: specialtyLeagueSummary,
  };
}

export const POST = withApiUsage({ endpoint: "/api/legacy/ai/run", tool: "LegacyAiRun" })(async (request: NextRequest) => {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitResult = rateLimit(ip, 5, 60000);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { sleeper_username, force_refresh } = body;

    if (!sleeper_username) {
      return NextResponse.json({ error: 'Missing sleeper_username' }, { status: 400 });
    }

    const user = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: sleeper_username.toLowerCase() },
      include: {
        leagues: { include: { rosters: true } },
        aiReports: { 
          where: { reportType: 'legacy' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Start an import first.' }, { status: 404 });
    }

    // Delete old reports if force_refresh is requested
    if (force_refresh && user.aiReports.length > 0) {
      await prisma.legacyAIReport.deleteMany({
        where: { userId: user.id, reportType: 'legacy' },
      });
    }

    if (!force_refresh && user.aiReports.length > 0) {
      const existingReport = user.aiReports[0];
      const insights = existingReport.insights as Record<string, unknown> | null;
      return NextResponse.json({
        success: true,
        cached: true,
        report: {
          rating: existingReport.rating,
          title: existingReport.title,
          archetype: insights?.archetype,
          consistency_score: insights?.consistency_score,
          window_status: insights?.window_status,
          window_status_emoji: insights?.window_status_emoji,
          window_status_label: insights?.window_status_label,
          offseason_label: insights?.offseason_label,
          offseason_power_index: insights?.offseason_power_index,
          power_index_breakdown: insights?.power_index_breakdown,
          legacy_summary: existingReport.summary,
          insights: {
            strengths: insights?.strengths,
            weaknesses: insights?.weaknesses,
            hall_of_fame_moments: insights?.hall_of_fame_moments,
            improvement_tips: insights?.improvement_tips,
          },
          next_season_advice: insights?.next_season_advice,
          share_text: existingReport.shareText,
          citations: Array.isArray(insights?.citations) ? insights.citations : [],
          created_at: existingReport.createdAt,
        },
        audit: {
          partialData: false,
          sourcesUsed: ['importedLeague'],
          missingSources: [],
          dataFreshness: { importedLeague: existingReport.createdAt.toISOString() },
        },
      });
    }

    const snapshot = buildLegacySnapshot(user);

    let enrichmentBlock = '';
    const now = new Date().toISOString();
    let enrichmentAudit: {
      partialData: boolean;
      sourcesUsed: string[];
      missingSources: string[];
      dataFreshness: Record<string, string>;
    } = {
      partialData: false,
      sourcesUsed: ['importedLeague'],
      missingSources: [],
      dataFreshness: { importedLeague: now },
    };
    try {
      const enriched = await assembleLegacyAIContext(prisma, user as any, snapshot as any);
      enrichmentBlock = formatEnrichedContextForPrompt(enriched);

      const sa = enriched.sourceAudit;
      const df = enriched.dataFreshness;
      const sources: string[] = ['importedLeague'];
      const missing: string[] = [];
      const freshness: Record<string, string> = { importedLeague: now };

      if (sa.fantasyCalcPlayerCount > 0 || sa.fantasyCalcPickCount > 0) {
        sources.push('fantasyCalc');
        freshness.fantasyCalc = df.fantasyCalcFetchedAt || now;
      } else if (sa.missingSources.includes('fantasycalc')) {
        missing.push('fantasyCalc');
      }

      if (sa.newsItemCount > 0) {
        sources.push('newsApi');
        freshness.newsApi = df.newsAge || now;
      } else if (sa.missingSources.includes('news')) {
        missing.push('newsApi');
      }

      if (sa.rollingInsightsPlayerCount > 0) {
        sources.push('rollingInsights');
        freshness.rollingInsights = df.assembledAt || now;
      } else if (sa.missingSources.includes('rolling_insights')) {
        missing.push('rollingInsights');
      }

      enrichmentAudit = {
        partialData: sa.partialData,
        sourcesUsed: sources,
        missingSources: missing,
        dataFreshness: freshness,
      };
    } catch (err) {
      console.warn('[LegacyAI] Enrichment assembly failed, continuing without:', err);
      enrichmentAudit = {
        partialData: true,
        sourcesUsed: ['importedLeague'],
        missingSources: ['fantasyCalc', 'newsApi', 'rollingInsights'],
        dataFreshness: { importedLeague: now },
      };
    }

    const userPrompt = `Analyze this fantasy manager's legacy:

${JSON.stringify(snapshot, null, 2)}

${enrichmentBlock ? `\n--- ENRICHMENT DATA (use to enhance analysis) ---\n${enrichmentBlock}\n--- END ENRICHMENT DATA ---` : ''}

Generate a comprehensive rating and analysis.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: LEGACY_AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      return NextResponse.json({ error: 'No AI response' }, { status: 500 });
    }

    const aiResponse = JSON.parse(responseText);

    await prisma.legacyAIReport.create({
      data: {
        userId: user.id,
        reportType: 'legacy',
        rating: aiResponse.rating,
        title: aiResponse.title,
        summary: aiResponse.legacy_summary,
        insights: {
          archetype: aiResponse.archetype,
          consistency_score: aiResponse.consistency_score,
          window_status: aiResponse.window_status,
          window_status_emoji: aiResponse.window_status_emoji,
          window_status_label: aiResponse.window_status_label,
          offseason_label: aiResponse.offseason_label,
          offseason_power_index: aiResponse.offseason_power_index,
          power_index_breakdown: aiResponse.power_index_breakdown,
          strengths: aiResponse.insights?.strengths,
          weaknesses: aiResponse.insights?.weaknesses,
          hall_of_fame_moments: aiResponse.insights?.hall_of_fame_moments,
          improvement_tips: aiResponse.insights?.improvement_tips,
          next_season_advice: aiResponse.next_season_advice,
          citations: Array.isArray(aiResponse.citations) ? aiResponse.citations : [],
        },
        shareText: aiResponse.share_text,
      },
    });

    // Track tool usage
    trackLegacyToolUsage('legacy_ai_run', user.id)

    return NextResponse.json({
      success: true,
      cached: false,
      report: {
        rating: aiResponse.rating,
        title: aiResponse.title,
        archetype: aiResponse.archetype,
        consistency_score: aiResponse.consistency_score,
        window_status: aiResponse.window_status,
        window_status_emoji: aiResponse.window_status_emoji,
        window_status_label: aiResponse.window_status_label,
        offseason_label: aiResponse.offseason_label,
        offseason_power_index: aiResponse.offseason_power_index,
        power_index_breakdown: aiResponse.power_index_breakdown,
        legacy_summary: aiResponse.legacy_summary,
        insights: aiResponse.insights,
        next_season_advice: aiResponse.next_season_advice,
        share_text: aiResponse.share_text,
        citations: Array.isArray(aiResponse.citations) ? aiResponse.citations : [],
      },
      audit: enrichmentAudit,
    });
  } catch (error) {
    console.error('Legacy AI run error:', error);
    return NextResponse.json(
      { error: 'Failed to run AI analysis', details: String(error) },
      { status: 500 }
    );
  }
})
