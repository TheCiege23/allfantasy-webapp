import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAdminOrBearer } from "@/lib/adminAuth";

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

export const POST = withApiUsage({ endpoint: "/api/admin/questionnaire", tool: "AdminQuestionnaireRestore" })(async (request: NextRequest) => {
  const gate = await requireAdminOrBearer(request);
  if (!gate.ok) return gate.res;

  try {
    const { rows } = await request.json();
    if (!Array.isArray(rows)) return NextResponse.json({ error: "rows must be an array" }, { status: 400 });

    let inserted = 0;
    for (const r of rows) {
      const exists = await prisma.questionnaireResponse.findFirst({
        where: { email: r.email, createdAt: new Date(r.createdAt) },
      });
      if (exists) continue;

      await prisma.questionnaireResponse.create({
        data: {
          email: r.email,
          favoriteSport: r.favoriteSport,
          favoriteLeagueType: r.favoriteLeagueType,
          competitiveness: r.competitiveness,
          draftPreference: r.draftPreference,
          painPoint: r.painPoint,
          experimentalInterest: Array.isArray(r.experimentalInterest)
            ? r.experimentalInterest
            : typeof r.experimentalInterest === "string"
              ? r.experimentalInterest.split("; ")
              : [],
          freeText: r.freeText || null,
          createdAt: new Date(r.createdAt),
        },
      });
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (e) {
    console.error("Questionnaire restore error:", e);
    return NextResponse.json({ error: "Restore failed" }, { status: 500 });
  }
})
