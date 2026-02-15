import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/league-submissions", tool: "AdminLeagueSubmissions" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const submissions = await prisma.leagueTypeSubmission.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ submissions });
  } catch (e) {
    console.error("Admin league submissions error:", e);
    return NextResponse.json({ error: "Failed to load submissions" }, { status: 500 });
  }
})

export const PATCH = withApiUsage({ endpoint: "/api/admin/league-submissions", tool: "AdminLeagueSubmissions" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const body = await request.json();
    const { id, status, adminNotes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const validStatuses = ["received", "in_review", "accepted", "rejected", "needs_clarification"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.leagueTypeSubmission.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes || null,
        reviewedAt: new Date(),
        reviewedBy: gate.user?.email || "admin",
      },
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (e) {
    console.error("Admin league submissions update error:", e);
    return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
  }
})
