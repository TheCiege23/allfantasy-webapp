import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrBearer } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const POST = withApiUsage({ endpoint: "/api/admin/bulk-import", tool: "AdminBulkImport" })(async (request: NextRequest) => {
  const gate = await requireAdminOrBearer(request);
  if (!gate.ok) return gate.res;

  try {
    const { signups, leagueIdeas, feedback } = await request.json();
    const results: Record<string, { inserted: number; skipped: number }> = {};

    if (Array.isArray(signups)) {
      let inserted = 0;
      let skipped = 0;
      const existing = await prisma.earlyAccessSignup.findMany({ select: { email: true } });
      const existingEmails = new Set(existing.map((s) => s.email.toLowerCase()));
      const seen = new Set<string>();

      for (const s of signups) {
        const email = (s.email || "").trim().toLowerCase();
        if (!email || existingEmails.has(email) || seen.has(email)) { skipped++; continue; }
        seen.add(email);
        await prisma.earlyAccessSignup.create({
          data: {
            email,
            name: s.name || null,
            createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            source: s.source || "old_site",
            referrer: s.referrer || null,
            utmSource: s.utmSource || null,
            utmMedium: s.utmMedium || null,
            utmCampaign: s.utmCampaign || null,
            utmContent: s.utmContent || null,
            utmTerm: s.utmTerm || null,
          },
        });
        inserted++;
      }
      results.signups = { inserted, skipped };
    }

    if (Array.isArray(leagueIdeas)) {
      let inserted = 0;
      let skipped = 0;
      const existing = await prisma.leagueTypeSubmission.findMany({ select: { email: true, leagueTypeName: true } });
      const existingKeys = new Set(existing.map((i) => `${i.email.toLowerCase()}|${i.leagueTypeName.toLowerCase()}`));

      for (const idea of leagueIdeas) {
        const email = (idea.email || "").trim().toLowerCase();
        const name = (idea.leagueTypeName || "").trim();
        const key = `${email}|${name.toLowerCase()}`;
        if (!email || !name || existingKeys.has(key)) { skipped++; continue; }
        existingKeys.add(key);

        await prisma.leagueTypeSubmission.create({
          data: {
            leagueTypeName: idea.leagueTypeName,
            tagline: idea.tagline || "",
            description: idea.description || "",
            sports: idea.sports || ["NFL"],
            recommendedSize: idea.recommendedSize || "12",
            seasonFormat: idea.seasonFormat || "Full Season",
            draftType: idea.draftType || "Snake Draft",
            winCondition: idea.winCondition || "Standard",
            hasSpecialScoring: idea.hasSpecialScoring || false,
            specialMechanics: idea.specialMechanics || [],
            weeklyFlow: idea.weeklyFlow || "Standard weekly matchup format",
            creditName: idea.creditName || "Anonymous",
            email,
            permissionConsent: idea.permissionConsent ?? true,
            rightsConsent: idea.rightsConsent ?? true,
            canContact: idea.canContact ?? true,
            status: idea.status || "received",
            createdAt: idea.createdAt ? new Date(idea.createdAt) : new Date(),
          },
        });
        inserted++;
      }
      results.leagueIdeas = { inserted, skipped };
    }

    if (Array.isArray(feedback)) {
      let inserted = 0;
      let skipped = 0;
      const existing = await prisma.legacyFeedback.findMany({ select: { email: true, feedbackText: true } });
      const existingKeys = new Set(existing.map((f) => `${(f.email || "").toLowerCase()}|${f.feedbackText.toLowerCase().trim()}`));

      for (const fb of feedback) {
        const email = (fb.email || "").trim().toLowerCase();
        const text = (fb.feedbackText || "").trim();
        const key = `${email}|${text.toLowerCase()}`;
        if (!text || existingKeys.has(key)) { skipped++; continue; }
        existingKeys.add(key);

        await prisma.legacyFeedback.create({
          data: {
            feedbackType: fb.feedbackType || "general",
            tool: fb.tool || "signup_questionnaire",
            feedbackText: text,
            email: email || null,
            canContact: fb.canContact ?? false,
            status: fb.status || "new",
            createdAt: fb.createdAt ? new Date(fb.createdAt) : new Date(),
          },
        });
        inserted++;
      }
      results.feedback = { inserted, skipped };
    }

    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("Bulk import error:", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
})
