import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export const DELETE = withApiUsage({ endpoint: "/api/admin/signups/[id]", tool: "AdminSignups" })(async (request: NextRequest,
  { params }: { params: { id?: string } }) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const id = (params?.id || "").trim();
  if (!id) return bad("Missing id");

  try {
    const existing = await prisma.earlyAccessSignup.findUnique({
      where: { id },
      select: { id: true, email: true, confirmedAt: true, createdAt: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: true, deleted: false, reason: "not_found" });
    }

    await prisma.earlyAccessSignup.delete({ where: { id } });

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_signup_deleted",
        path: "/api/admin/signups/[id]",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          deletedId: existing.id,
          deletedEmail: existing.email,
          wasConfirmed: !!existing.confirmedAt,
        },
      },
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (e) {
    console.error("Admin signup delete error:", e);
    return NextResponse.json({ error: "Failed to delete signup" }, { status: 500 });
  }
})
