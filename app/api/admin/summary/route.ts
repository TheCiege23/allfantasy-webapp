import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/summary", tool: "AdminSummary" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const totalVisits = 0;
    const uniqueSessions = 0;
    const paidLeagues = 0;

    // Use UTC to ensure consistent behavior across environments
    const now = new Date();
    const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeekUTC = new Date(startOfTodayUTC);
    startOfWeekUTC.setUTCDate(startOfWeekUTC.getUTCDate() - 7);

    const [totalEarlyAccess, confirmedEarlyAccess, totalLegacyUsers, thisWeekCount, todayCount] = await Promise.all([
      prisma.earlyAccessSignup.count(),
      prisma.earlyAccessSignup.count({ where: { confirmedAt: { not: null } } }),
      prisma.legacyUser.count(),
      prisma.earlyAccessSignup.count({ where: { createdAt: { gte: startOfWeekUTC } } }),
      prisma.earlyAccessSignup.count({ where: { createdAt: { gte: startOfTodayUTC } } }),
    ]);

    const unconfirmedEarlyAccess = totalEarlyAccess - confirmedEarlyAccess;
    const confirmRate = totalEarlyAccess > 0 ? confirmedEarlyAccess / totalEarlyAccess : 0;

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_summary",
        path: "/api/admin/summary",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          totalEarlyAccess,
          confirmedEarlyAccess,
          unconfirmedEarlyAccess,
          confirmRate,
          totalLegacyUsers,
          thisWeekCount,
          todayCount,
        },
      },
    });

    return NextResponse.json({
      totalVisits,
      uniqueSessions,
      totalUsers: totalEarlyAccess,
      paidLeagues,
      legacyUsers: totalLegacyUsers,
      confirmedUsers: confirmedEarlyAccess,
      unconfirmedUsers: unconfirmedEarlyAccess,
      confirmRate,
      thisWeek: thisWeekCount,
      today: todayCount,
    });
  } catch (e) {
    console.error("Admin summary error:", e);
    return NextResponse.json({ error: "Failed to load summary" }, { status: 500 });
  }
})
