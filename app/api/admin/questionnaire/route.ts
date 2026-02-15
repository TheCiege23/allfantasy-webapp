import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/questionnaire", tool: "AdminQuestionnaire" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const responses = await prisma.questionnaireResponse.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ responses });
  } catch (e) {
    console.error("Admin questionnaire error:", e);
    return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });
  }
})
