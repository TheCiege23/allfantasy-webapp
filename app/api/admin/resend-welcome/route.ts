import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend-client";
import { getEarlyAccessWelcomeEmailV2 } from "@/lib/email-templates/early-access-welcome";
import { prisma } from "@/lib/prisma";
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const POST = withApiUsage({ endpoint: "/api/admin/resend-welcome", tool: "AdminResendWelcome" })(async (req: NextRequest) => {
  if (!isAuthorizedRequest(req)) return adminUnauthorized();

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const { client, fromEmail, source: resendSource } = await getResendClient();

    const baseUrl = (process.env.APP_URL || "https://allfantasy.ai").trim();
    const { subject, html, text } = getEarlyAccessWelcomeEmailV2({
      email,
      baseUrl,
    });

    const from = fromEmail || "AllFantasy <noreply@allfantasy.ai>";

    const resp: any = await client.emails.send({
      from,
      to: email,
      subject,
      html,
      text,
    });

    if (resp?.error) {
      throw new Error(resp.error?.message || "Resend send error");
    }

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_resend_welcome_email",
        path: "/api/admin/resend-welcome",
        meta: {
          email,
          from,
          source: resendSource,
          messageId: resp?.data?.id || resp?.id || null,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      messageId: resp?.data?.id || resp?.id,
      from,
      source: resendSource,
    });
  } catch (error: any) {
    console.error("Resend welcome email error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send email" },
      { status: 500 }
    );
  }
})
