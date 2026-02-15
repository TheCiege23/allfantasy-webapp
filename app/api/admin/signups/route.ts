import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

function asInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

// DELETE by email - for testing purposes
export const DELETE = withApiUsage({ endpoint: "/api/admin/signups", tool: "AdminSignups" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email parameter required" }, { status: 400 });
    }

    const existing = await prisma.earlyAccessSignup.findUnique({
      where: { email },
      select: { id: true, email: true, createdAt: true, confirmedAt: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: true, deleted: false, reason: "not_found", email });
    }

    await prisma.earlyAccessSignup.delete({ where: { email } });

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signup_deleted_by_email",
        path: "/api/admin/signups",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          deletedId: existing.id,
          deletedEmail: existing.email,
          wasConfirmed: !!existing.confirmedAt,
          originalCreatedAt: existing.createdAt.toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true, deleted: true, email: existing.email });
  } catch (e) {
    console.error("Admin signup delete by email error:", e);
    return NextResponse.json({ error: "Failed to delete signup" }, { status: 500 });
  }
})

export const GET = withApiUsage({ endpoint: "/api/admin/signups", tool: "AdminSignups" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const { searchParams } = new URL(request.url);

    const limit = Math.min(5000, Math.max(1, asInt(searchParams.get("limit"), 250)));
    const status = (searchParams.get("status") || "all").trim();
    const source = (searchParams.get("source") || "all").trim();

    const where: any = {};
    if (status === "confirmed") where.confirmedAt = { not: null };
    if (status === "unconfirmed") where.confirmedAt = null;
    if (source !== "all") where.source = source;

    const signups = await prisma.earlyAccessSignup.findMany({
      where,
      select: { 
        id: true, 
        email: true, 
        createdAt: true, 
        confirmedAt: true, 
        source: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        referrer: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signups_list",
        path: "/api/admin/signups",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          limit,
          status,
          source,
          returned: signups.length,
        },
      },
    });

    return NextResponse.json({ ok: true, signups });
  } catch (e) {
    console.error("Admin signups GET error:", e);
    return NextResponse.json({ error: "Failed to load signups" }, { status: 500 });
  }
})
