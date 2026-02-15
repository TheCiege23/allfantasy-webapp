import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getResendClient } from "@/lib/resend-client";

const submissionSchema = z.object({
  leagueTypeName: z.string().min(1).max(200),
  tagline: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  sports: z.array(z.string()).min(1),
  recommendedSize: z.string().min(1),
  seasonFormat: z.string().min(1),
  draftType: z.string().min(1),
  winCondition: z.string().min(1),
  hasSpecialScoring: z.boolean(),
  scoringRules: z.string().max(2000).nullable().optional(),
  positionsImpacted: z.string().max(500).nullable().optional(),
  specialMechanics: z.array(z.string()).min(1),
  weeklyFlow: z.string().min(1).max(3000),
  edgeCases: z.string().max(2000).nullable().optional(),
  rosterSetup: z.string().max(500).nullable().optional(),
  waiverSystem: z.string().max(100).nullable().optional(),
  tradeRules: z.string().max(500).nullable().optional(),
  playoffSetup: z.string().max(500).nullable().optional(),
  commissionerTools: z.string().max(500).nullable().optional(),
  creditName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  socialHandle: z.string().max(200).nullable().optional(),
  permissionConsent: z.literal(true),
  rightsConsent: z.literal(true),
  canContact: z.boolean().optional(),
});

function getConfirmationEmailHtml(data: {
  creditName: string;
  leagueTypeName: string;
  sports: string[];
  submittedAt: string;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 28px; font-weight: bold; background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .check { display: inline-block; width: 64px; height: 64px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; line-height: 64px; text-align: center; font-size: 32px; margin: 16px 0; }
    .message { text-align: center; color: #f1f5f9; font-size: 18px; margin: 16px 0; }
    .summary-box { background: rgba(34, 211, 238, 0.1); border-left: 3px solid #22d3ee; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
    .summary-item { margin: 8px 0; }
    .summary-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; }
    .summary-value { color: #f1f5f9; font-size: 14px; margin-top: 2px; }
    .notice { background: rgba(168, 85, 247, 0.1); border-left: 3px solid #a855f7; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; font-size: 14px; color: #e2e8f0; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">AllFantasy.ai</div>
    </div>
    
    <div style="text-align: center;">
      <div class="check">✓</div>
      <h2 style="margin: 8px 0; color: #4ade80;">Submission Received!</h2>
    </div>
    
    <p class="message">Hi ${data.creditName},</p>
    <p style="text-align: center; color: #94a3b8; margin-top: -8px;">
      Thanks for submitting your league idea to AllFantasy — we've received it successfully.
    </p>
    
    <div class="summary-box">
      <h3 style="margin: 0 0 16px 0; color: #22d3ee; font-size: 14px;">Submission Summary</h3>
      <div class="summary-item">
        <div class="summary-label">League Name</div>
        <div class="summary-value">${data.leagueTypeName}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Sport(s)</div>
        <div class="summary-value">${data.sports.join(", ")}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Submitted</div>
        <div class="summary-value">${data.submittedAt}</div>
      </div>
    </div>
    
    <div class="notice">
      <strong style="color: #a855f7;">What happens next?</strong>
      <p style="margin: 8px 0 0 0;">
        Our team will review your idea. If we want to feature it, we may reach out for clarifications.
      </p>
      <p style="margin: 8px 0 0 0;">
        <strong>Important:</strong> We will not use your idea unless you agreed to the submission permissions during checkout of this form. If accepted, your creator credit will appear in the app as: <strong>${data.creditName}</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>Thanks again,</p>
      <p style="color: #22d3ee;">AllFantasy Team</p>
    </div>
  </div>
</body>
</html>
`;
}

function getAdminNotificationHtml(data: {
  leagueTypeName: string;
  creditName: string;
  email: string;
  sports: string[];
  hasSpecialScoring: boolean;
  permissionConsent: boolean;
  rightsConsent: boolean;
  canContact: boolean;
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .header { text-align: center; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: bold; background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .info-box { background: rgba(0, 0, 0, 0.3); border-radius: 12px; padding: 16px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #94a3b8; }
    .info-value { color: #f1f5f9; text-align: right; }
    .cta { display: block; text-align: center; background: linear-gradient(90deg, #22d3ee, #a855f7); color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">AllFantasy Admin</div>
      <h2 style="margin: 8px 0; color: #f1f5f9;">New League Type Submission</h2>
    </div>
    
    <div class="info-box">
      <div class="info-row">
        <span class="info-label">League Name</span>
        <span class="info-value">${data.leagueTypeName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Creator Credit</span>
        <span class="info-value">${data.creditName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${data.email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Sports</span>
        <span class="info-value">${data.sports.join(", ")}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Special Scoring</span>
        <span class="info-value">${data.hasSpecialScoring ? "Yes" : "No"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Permission Consent</span>
        <span class="info-value" style="color: ${data.permissionConsent ? "#4ade80" : "#f87171"};">${data.permissionConsent ? "Yes" : "No"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Rights Consent</span>
        <span class="info-value" style="color: ${data.rightsConsent ? "#4ade80" : "#f87171"};">${data.rightsConsent ? "Yes" : "No"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Can Contact</span>
        <span class="info-value">${data.canContact ? "Yes" : "No"}</span>
      </div>
    </div>
    
    <a href="https://allfantasy.ai/admin?tab=ideas" class="cta">Review in Admin Panel</a>
  </div>
</body>
</html>
`;
}

export const POST = withApiUsage({ endpoint: "/api/submit-league", tool: "SubmitLeague" })(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = submissionSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { error: firstError?.message || "Invalid submission data" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const submission = await prisma.leagueTypeSubmission.create({
      data: {
        leagueTypeName: data.leagueTypeName,
        tagline: data.tagline,
        description: data.description,
        sports: data.sports,
        recommendedSize: data.recommendedSize,
        seasonFormat: data.seasonFormat,
        draftType: data.draftType,
        winCondition: data.winCondition,
        hasSpecialScoring: data.hasSpecialScoring,
        scoringRules: data.scoringRules || null,
        positionsImpacted: data.positionsImpacted || null,
        specialMechanics: data.specialMechanics,
        weeklyFlow: data.weeklyFlow,
        edgeCases: data.edgeCases || null,
        rosterSetup: data.rosterSetup || null,
        waiverSystem: data.waiverSystem || null,
        tradeRules: data.tradeRules || null,
        playoffSetup: data.playoffSetup || null,
        commissionerTools: data.commissionerTools || null,
        creditName: data.creditName,
        email: data.email.toLowerCase(),
        socialHandle: data.socialHandle || null,
        permissionConsent: data.permissionConsent,
        rightsConsent: data.rightsConsent,
        canContact: data.canContact || false,
        status: "received",
      },
    });

    try {
      const { client, fromEmail } = await getResendClient();
      const submittedAt = new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await client.emails.send({
        from: fromEmail,
        to: data.email,
        subject: `We received your AllFantasy league idea: ${data.leagueTypeName}`,
        html: getConfirmationEmailHtml({
          creditName: data.creditName,
          leagueTypeName: data.leagueTypeName,
          sports: data.sports,
          submittedAt,
        }),
      });

      const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (adminEmails.length > 0) {
        await client.emails.send({
          from: fromEmail,
          to: adminEmails,
          subject: `New League Type Submission: ${data.leagueTypeName}`,
          html: getAdminNotificationHtml({
            leagueTypeName: data.leagueTypeName,
            creditName: data.creditName,
            email: data.email,
            sports: data.sports,
            hasSpecialScoring: data.hasSpecialScoring,
            permissionConsent: data.permissionConsent,
            rightsConsent: data.rightsConsent,
            canContact: data.canContact || false,
          }),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send league submission emails:", emailErr);
    }

    return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("League submission error:", err);
    return NextResponse.json(
      { error: "Failed to submit league idea" },
      { status: 500 }
    );
  }
})
