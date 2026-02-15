import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/feedback", tool: "AdminFeedback" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const feedback = await prisma.legacyFeedback.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ feedback });
  } catch (e) {
    console.error("Admin feedback error:", e);
    return NextResponse.json({ error: "Failed to load feedback" }, { status: 500 });
  }
})

export const PATCH = withApiUsage({ endpoint: "/api/admin/feedback", tool: "AdminFeedback" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const body = await request.json();
    const { id, status, priority, assignedTo, adminNotes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const validStatuses = ["new", "triaged", "in_review", "in_progress", "resolved", "closed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const validPriorities = ["p0", "p1", "p2", "p3"];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      reviewedAt: new Date(),
      reviewedBy: gate.user?.email || "admin",
    };

    if (status !== undefined) {
      updateData.status = status;
      if (status === "resolved") {
        updateData.resolvedAt = new Date();
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo || null;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes || null;

    const updated = await prisma.legacyFeedback.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, feedback: updated });
  } catch (e) {
    console.error("Admin feedback update error:", e);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
})
