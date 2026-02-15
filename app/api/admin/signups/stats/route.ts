import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/signups/stats", tool: "AdminSignupsStats" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const [total, confirmed] = await Promise.all([
      prisma.earlyAccessSignup.count(),
      prisma.earlyAccessSignup.count({ where: { confirmedAt: { not: null } } }),
    ]);

    const unconfirmed = total - confirmed;
    const confirmRate = total > 0 ? confirmed / total : 0;

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signups_stats",
        path: "/api/admin/signups/stats",
        userId: gate.user.id,
        meta: { adminEmail: gate.user.email, total, confirmed, unconfirmed, confirmRate },
      },
    });

    return NextResponse.json({ ok: true, total, confirmed, unconfirmed, confirmRate });
  } catch (e) {
    console.error("Admin signups stats error:", e);
    return NextResponse.json({ error: "Failed to load signup stats" }, { status: 500 });
  }
})
