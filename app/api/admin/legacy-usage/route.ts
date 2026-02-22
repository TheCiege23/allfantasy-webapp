import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

const LEGACY_TOOL_KEYS = [
  "legacy_import",
  "legacy_profile",
  "legacy_ai_run",
  "trade_eval",
  "trade_analyzer",
  "trade_finder",
  "player_finder",
  "trade_check",
  "waiver_ai",
  "league_rankings",
  "social_pulse",
  "manager_compare",
  "share_generate",
  "ai_coach",
  "ai_chat",
  "rank_refresh",
  "trade_proposal_generator",
  "mock_draft",
  "bracket_challenge",
  "market_timing",
  "manager_psychology",
  "rivalry_week",
  "draft_assistant",
  "board_drift",
  "scenario_lab",
  "snipe_radar",
  "trade_window",
  "devy_intel",
  "monte_carlo",
];

const TIME_PERIODS = [
  { key: "1h", label: "1 Hour", hours: 1 },
  { key: "5h", label: "5 Hours", hours: 5 },
  { key: "7h", label: "7 Hours", hours: 7 },
  { key: "12h", label: "12 Hours", hours: 12 },
  { key: "15h", label: "15 Hours", hours: 15 },
  { key: "24h", label: "24 Hours", hours: 24 },
  { key: "7d", label: "7 Days", hours: 168 },
] as const;

function getToolLabel(toolKey: string): string {
  const labels: Record<string, string> = {
    legacy_import: "Legacy Import",
    legacy_profile: "Profile View",
    legacy_ai_run: "AI Career Analysis",
    trade_eval: "Trade Analyzer",
    trade_analyzer: "Trade Analyzer (Inline)",
    trade_finder: "Trade Finder",
    player_finder: "Player Finder",
    trade_check: "Trade Notifications",
    waiver_ai: "Waiver AI",
    league_rankings: "League Rankings",
    social_pulse: "Social Pulse",
    manager_compare: "Manager Compare",
    share_generate: "Share to X",
    ai_coach: "AI Coach / Chat",
    ai_chat: "AI Chat (Chimmy)",
    rank_refresh: "Rank Refresh",
    trade_proposal_generator: "Trade Proposal Generator",
    mock_draft: "Mock Draft",
    bracket_challenge: "NCAA Bracket Challenge",
    market_timing: "Market Timing Alerts",
    manager_psychology: "Manager Psychology",
    rivalry_week: "Rivalry Week",
    draft_assistant: "Draft-Day Assistant",
    board_drift: "Board Drift Report",
    scenario_lab: "Scenario Lab",
    snipe_radar: "Snipe Radar",
    trade_window: "Trade-Window Optimizer",
    devy_intel: "Devy Intelligence",
    monte_carlo: "Monte Carlo Sim",
  };
  return labels[toolKey] || toolKey;
}

export const GET = withApiUsage({ endpoint: "/api/admin/legacy-usage", tool: "AdminLegacyUsage" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 168 * 60 * 60 * 1000);

    const events = await prisma.analyticsEvent.findMany({
      where: {
        toolKey: { in: LEGACY_TOOL_KEYS },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        toolKey: true,
        userId: true,
        emailHash: true,
        sessionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const allTimeEvents = await prisma.analyticsEvent.findMany({
      where: {
        toolKey: { in: LEGACY_TOOL_KEYS },
      },
      select: {
        toolKey: true,
        userId: true,
        emailHash: true,
        sessionId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const getUserKey = (e: { userId: string | null; emailHash: string | null; sessionId: string | null }) =>
      e.userId || e.emailHash || e.sessionId || "anon";

    const firstSeenMap = new Map<string, Date>();
    for (const e of allTimeEvents) {
      const key = getUserKey(e);
      if (!firstSeenMap.has(key) || e.createdAt < firstSeenMap.get(key)!) {
        firstSeenMap.set(key, e.createdAt);
      }
    }

    const timePeriodStats: Record<string, {
      totalUses: number;
      uniqueUsers: Set<string>;
      newUsers: Set<string>;
      repeatUsers: Set<string>;
      toolBreakdown: Record<string, { uses: number; uniqueUsers: Set<string> }>;
    }> = {};

    for (const tp of TIME_PERIODS) {
      const cutoff = new Date(now.getTime() - tp.hours * 60 * 60 * 1000);
      const periodEvents = events.filter(e => e.createdAt >= cutoff);

      const toolBreakdown: Record<string, { uses: number; uniqueUsers: Set<string> }> = {};
      for (const key of LEGACY_TOOL_KEYS) {
        toolBreakdown[key] = { uses: 0, uniqueUsers: new Set() };
      }

      const uniqueUsers = new Set<string>();
      const newUsers = new Set<string>();
      const repeatUsers = new Set<string>();

      for (const e of periodEvents) {
        const tk = e.toolKey || "unknown";
        if (toolBreakdown[tk]) {
          toolBreakdown[tk].uses += 1;
          const ukey = getUserKey(e);
          toolBreakdown[tk].uniqueUsers.add(ukey);
          uniqueUsers.add(ukey);
        }
      }

      for (const ukey of uniqueUsers) {
        const firstSeen = firstSeenMap.get(ukey);
        if (firstSeen && firstSeen >= cutoff) {
          newUsers.add(ukey);
        } else {
          repeatUsers.add(ukey);
        }
      }

      timePeriodStats[tp.key] = {
        totalUses: periodEvents.length,
        uniqueUsers,
        newUsers,
        repeatUsers,
        toolBreakdown,
      };
    }

    const sessionDurations: Record<string, { first: Date; last: Date; toolKeys: Set<string> }> = {};
    for (const e of events) {
      const sid = e.sessionId;
      if (!sid) continue;
      if (!sessionDurations[sid]) {
        sessionDurations[sid] = { first: e.createdAt, last: e.createdAt, toolKeys: new Set() };
      } else {
        if (e.createdAt < sessionDurations[sid].first) sessionDurations[sid].first = e.createdAt;
        if (e.createdAt > sessionDurations[sid].last) sessionDurations[sid].last = e.createdAt;
      }
      if (e.toolKey) sessionDurations[sid].toolKeys.add(e.toolKey);
    }

    const durations = Object.values(sessionDurations)
      .map(s => (s.last.getTime() - s.first.getTime()) / 1000 / 60)
      .filter(d => d > 0);

    durations.sort((a, b) => a - b);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const medianDuration = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
    const totalSessions = Object.keys(sessionDurations).length;
    const multiToolSessions = Object.values(sessionDurations).filter(s => s.toolKeys.size > 1).length;

    const periods = TIME_PERIODS.map(tp => {
      const stats = timePeriodStats[tp.key];
      const tools = LEGACY_TOOL_KEYS.map(tk => ({
        tool: tk,
        toolLabel: getToolLabel(tk),
        uses: stats.toolBreakdown[tk].uses,
        uniqueUsers: stats.toolBreakdown[tk].uniqueUsers.size,
      })).filter(t => t.uses > 0)
        .sort((a, b) => b.uses - a.uses);

      return {
        key: tp.key,
        label: tp.label,
        hours: tp.hours,
        totalUses: stats.totalUses,
        uniqueUsers: stats.uniqueUsers.size,
        newUsers: stats.newUsers.size,
        repeatUsers: stats.repeatUsers.size,
        tools,
      };
    });

    const allToolsAllTime: Record<string, { uses: number; uniqueUsers: Set<string> }> = {};
    for (const key of LEGACY_TOOL_KEYS) {
      allToolsAllTime[key] = { uses: 0, uniqueUsers: new Set() };
    }
    for (const e of allTimeEvents) {
      const tk = e.toolKey || "unknown";
      if (allToolsAllTime[tk]) {
        allToolsAllTime[tk].uses += 1;
        allToolsAllTime[tk].uniqueUsers.add(getUserKey(e));
      }
    }

    const allTimeToolsList = LEGACY_TOOL_KEYS.map(tk => ({
      tool: tk,
      toolLabel: getToolLabel(tk),
      totalUses: allToolsAllTime[tk].uses,
      uniqueUsers: allToolsAllTime[tk].uniqueUsers.size,
    })).sort((a, b) => b.totalUses - a.totalUses);

    const allTimeUsers = new Set<string>();
    for (const e of allTimeEvents) {
      allTimeUsers.add(getUserKey(e));
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalToolUses: allTimeEvents.length,
        totalUniqueUsers: allTimeUsers.size,
      },
      tools: allTimeToolsList,
      periods,
      sessionInsights: {
        totalSessions,
        avgDurationMinutes: Math.round(avgDuration * 10) / 10,
        medianDurationMinutes: Math.round(medianDuration * 10) / 10,
        multiToolSessions,
        multiToolRate: totalSessions > 0 ? Math.round((multiToolSessions / totalSessions) * 100) : 0,
      },
      timePeriods: TIME_PERIODS.map(tp => ({ key: tp.key, label: tp.label })),
    });
  } catch (e) {
    console.error("Admin legacy-usage GET error:", e);
    return NextResponse.json({ error: "Failed to load legacy usage stats" }, { status: 500 });
  }
})
