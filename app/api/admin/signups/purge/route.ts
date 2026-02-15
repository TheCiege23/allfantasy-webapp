import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

type Body = {
  olderThanDays?: number;
  dryRun?: boolean;
  limitSample?: number;
};

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export const POST = withApiUsage({ endpoint: "/api/admin/signups/purge", tool: "AdminSignupsPurge" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) return bad("Missing JSON body");

    const olderThanDaysRaw = Number(body.olderThanDays);
    const olderThanDays = Math.min(3650, Math.max(1, Number.isFinite(olderThanDaysRaw) ? olderThanDaysRaw : 0));
    if (!olderThanDays) return bad("olderThanDays is required (>= 1)");

    const dryRun = !!body.dryRun;
    const limitSampleRaw = Number(body.limitSample);
    const limitSample = Math.min(50, Math.max(0, Number.isFinite(limitSampleRaw) ? limitSampleRaw : 10));

    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const where = {
      confirmedAt: null as any,
      createdAt: { lt: cutoff },
    };

    const count = await prisma.earlyAccessSignup.count({ where });

    const sample = limitSample
      ? await prisma.earlyAccessSignup.findMany({
          where,
          orderBy: { createdAt: "asc" },
          take: limitSample,
          select: { id: true, email: true, createdAt: true },
        })
      : [];

    if (dryRun) {
      await prisma.analyticsEvent.create({
        data: {
          event: "tool_use",
          toolKey: "admin_signups_purge",
          path: "/api/admin/signups/purge",
          userId: gate.user.id,
          meta: {
            adminEmail: gate.user.email,
            dryRun: true,
            olderThanDays,
            cutoff: cutoff.toISOString(),
            count,
            sample: sample.map((s) => s.email),
          },
        },
      });

      return NextResponse.json({
        ok: true,
        dryRun: true,
        olderThanDays,
        cutoff: cutoff.toISOString(),
        count,
        sample,
      });
    }

    const res = await prisma.earlyAccessSignup.deleteMany({ where });

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signups_purge",
        path: "/api/admin/signups/purge",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          dryRun: false,
          olderThanDays,
          cutoff: cutoff.toISOString(),
          deleted: res.count,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      dryRun: false,
      olderThanDays,
      cutoff: cutoff.toISOString(),
      deleted: res.count,
    });
  } catch (e) {
    console.error("Admin purge signups error:", e);
    return NextResponse.json({ error: "Failed to purge signups" }, { status: 500 });
  }
})
