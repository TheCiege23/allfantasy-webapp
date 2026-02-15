import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/legacy-usage", tool: "AdminLegacyUsage" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const where: any = dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {};

    const legacyToolKeys = [
      "legacy_import",
      "legacy_profile",
      "legacy_ai_run",
      "trade_eval",
      "trade_finder",
      "player_finder",
      "trade_check",
      "waiver_ai",
      "league_rankings",
      "social_pulse",
      "manager_compare",
      "share_generate",
      "ai_coach",
      "rank_refresh",
    ];

    where.toolKey = { in: legacyToolKeys };

    const events = await prisma.analyticsEvent.findMany({
      where,
      select: {
        toolKey: true,
        userId: true,
        emailHash: true,
        sessionId: true,
        createdAt: true,
      },
    });

    const toolStats: Record<string, { total: number; uniqueUsers: Set<string> }> = {};

    for (const key of legacyToolKeys) {
      toolStats[key] = { total: 0, uniqueUsers: new Set() };
    }

    for (const event of events) {
      const key = event.toolKey || "unknown";
      if (!toolStats[key]) continue;

      toolStats[key].total += 1;

      const userKey = event.userId || event.emailHash || event.sessionId;
      if (userKey) {
        toolStats[key].uniqueUsers.add(userKey);
      }
    }

    const result = Object.entries(toolStats).map(([tool, data]) => ({
      tool,
      toolLabel: getToolLabel(tool),
      totalUses: data.total,
      uniqueUsers: data.uniqueUsers.size,
    }));

    result.sort((a, b) => b.totalUses - a.totalUses);

    const totalEvents = events.length;
    const allUsers = new Set<string>();
    for (const event of events) {
      const userKey = event.userId || event.emailHash || event.sessionId;
      if (userKey) allUsers.add(userKey);
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalToolUses: totalEvents,
        totalUniqueUsers: allUsers.size,
      },
      tools: result,
    });
  } catch (e) {
    console.error("Admin legacy-usage GET error:", e);
    return NextResponse.json({ error: "Failed to load legacy usage stats" }, { status: 500 });
  }
})

function getToolLabel(toolKey: string): string {
  const labels: Record<string, string> = {
    legacy_import: "Legacy Import",
    legacy_profile: "Profile View",
    legacy_ai_run: "AI Career Analysis",
    trade_eval: "Trade Analyzer",
    trade_finder: "Trade Finder",
    player_finder: "Player Finder",
    trade_check: "Trade Notifications",
    waiver_ai: "Waiver AI",
    league_rankings: "League Rankings",
    social_pulse: "Social Pulse",
    manager_compare: "Manager Compare",
    share_generate: "Share to X",
    ai_coach: "AI Coach / Chat",
    rank_refresh: "Rank Refresh",
  };
  return labels[toolKey] || toolKey;
}
