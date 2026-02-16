import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/signups/stats", tool: "AdminSignupsStats" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const [total, confirmed, last24h, last7d, todaySignups] = await Promise.all([
      prisma.earlyAccessSignup.count(),
      prisma.earlyAccessSignup.count({ where: { confirmedAt: { not: null } } }),
      prisma.earlyAccessSignup.count({ where: { createdAt: { gte: h24 } } }),
      prisma.earlyAccessSignup.count({ where: { createdAt: { gte: d7 } } }),
      prisma.earlyAccessSignup.findMany({
        where: { createdAt: { gte: todayStart } },
        select: {
          id: true,
          email: true,
          createdAt: true,
          confirmedAt: true,
          source: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          referrer: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const unconfirmed = total - confirmed;
    const confirmRate = total > 0 ? confirmed / total : 0;

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signups_stats",
        path: "/api/admin/signups/stats",
        userId: gate.user.id,
        meta: { adminEmail: gate.user.email, total, confirmed, unconfirmed, confirmRate, last24h, last7d },
      },
    });

    return NextResponse.json({
      ok: true,
      total,
      confirmed,
      unconfirmed,
      confirmRate,
      last24h,
      last7d,
      todaySignups,
      serverTime: now.toISOString(),
    });
  } catch (e) {
    console.error("Admin signups stats error:", e);
    return NextResponse.json({ error: "Failed to load signup stats" }, { status: 500 });
  }
})
