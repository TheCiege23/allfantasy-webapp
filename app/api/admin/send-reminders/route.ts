import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { getResendClient } from "@/lib/resend-client";
import { getConfirmationReminderEmail } from "@/lib/email-templates/confirmation-reminder";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/send-reminders", tool: "AdminSendReminders" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const unconfirmed = await prisma.earlyAccessSignup.findMany({
      where: { confirmedAt: null },
      select: { id: true, email: true, createdAt: true, source: true },
      orderBy: { createdAt: "desc" },
    });

    const alreadyReminded = await prisma.analyticsEvent.findMany({
      where: {
        toolKey: "admin_confirmation_reminder_sent",
      },
      select: { meta: true },
    });

    const remindedEmails = new Set<string>();
    for (const evt of alreadyReminded) {
      const meta = evt.meta as any;
      if (meta?.email) remindedEmails.add(meta.email.toLowerCase());
    }

    const eligible = unconfirmed.filter(s => !remindedEmails.has(s.email.toLowerCase()));

    return NextResponse.json({
      ok: true,
      totalUnconfirmed: unconfirmed.length,
      alreadyReminded: remindedEmails.size,
      eligible: eligible.length,
      emails: eligible.map(s => ({ id: s.id, email: s.email, createdAt: s.createdAt, source: s.source })),
    });
  } catch (e: any) {
    console.error("Send reminders GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load" }, { status: 500 });
  }
});

export const POST = withApiUsage({ endpoint: "/api/admin/send-reminders", tool: "AdminSendReminders" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const body = await request.json().catch(() => ({}));
    const maxSend = Math.min(body?.limit || 50, 100);

    const unconfirmed = await prisma.earlyAccessSignup.findMany({
      where: { confirmedAt: null },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const alreadyReminded = await prisma.analyticsEvent.findMany({
      where: {
        toolKey: "admin_confirmation_reminder_sent",
      },
      select: { meta: true },
    });

    const remindedEmails = new Set<string>();
    for (const evt of alreadyReminded) {
      const meta = evt.meta as any;
      if (meta?.email) remindedEmails.add(meta.email.toLowerCase());
    }

    const eligible = unconfirmed.filter(s => !remindedEmails.has(s.email.toLowerCase()));
    const toSend = eligible.slice(0, maxSend);

    if (toSend.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: remindedEmails.size,
        totalUnconfirmed: unconfirmed.length,
        message: "No eligible signups to remind (all already reminded or confirmed)",
      });
    }

    const { client, fromEmail } = await getResendClient();
    const baseUrl = (process.env.APP_URL || "https://allfantasy.ai").trim();
    const from = fromEmail || "AllFantasy <noreply@allfantasy.ai>";

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const signup of toSend) {
      try {
        const { subject, html, text } = getConfirmationReminderEmail({
          email: signup.email,
          baseUrl,
        });

        const resp: any = await client.emails.send({
          from,
          to: signup.email,
          subject,
          html,
          text,
        });

        if (resp?.error) {
          throw new Error(resp.error?.message || "Send error");
        }

        await prisma.analyticsEvent.create({
          data: {
            event: "tool_use",
            toolKey: "admin_confirmation_reminder_sent",
            path: "/api/admin/send-reminders",
            userId: gate.user.id,
            meta: {
              email: signup.email,
              signupId: signup.id,
              messageId: resp?.data?.id || resp?.id || null,
              adminEmail: gate.user.email,
            },
          },
        });

        sent++;
        console.log(`[REMINDER] Sent to ${signup.email}`);

        if (sent % 10 === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err: any) {
        failed++;
        const msg = `${signup.email}: ${err?.message || "unknown error"}`;
        errors.push(msg);
        console.error(`[REMINDER] Failed:`, msg);
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_reminder_batch_complete",
        path: "/api/admin/send-reminders",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          sent,
          failed,
          totalEligible: eligible.length,
          totalUnconfirmed: unconfirmed.length,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sent,
      failed,
      totalEligible: eligible.length,
      totalUnconfirmed: unconfirmed.length,
      remaining: eligible.length - toSend.length,
      ...(errors.length > 0 ? { errors: errors.slice(0, 10) } : {}),
    });
  } catch (e: any) {
    console.error("Send reminders POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to send reminders" }, { status: 500 });
  }
});
