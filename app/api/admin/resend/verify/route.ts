import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getResendClient } from "@/lib/resend-client";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

type Body = {
  to?: string;
};

function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

function looksLikeEmail(email: string) {
  const e = email.trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export const GET = withApiUsage({ endpoint: "/api/admin/resend/verify", tool: "AdminResendVerify" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const userAgent = request.headers.get("user-agent") || undefined;
  const referrer = request.headers.get("referer") || undefined;

  try {
    const { fromEmail, source } = await getResendClient();

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_resend_verify",
        path: "/api/admin/resend/verify",
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          source,
          fromEmail,
          ok: true,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      source,
      fromEmail,
      note:
        "Credentials loaded. Use POST with {to} to send a test email.",
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "verify failed");

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_resend_verify_failed",
        path: "/api/admin/resend/verify",
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          ok: false,
          error: msg,
        },
      },
    });

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
})

export const POST = withApiUsage({ endpoint: "/api/admin/resend/verify", tool: "AdminResendVerify" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const userAgent = request.headers.get("user-agent") || undefined;
  const referrer = request.headers.get("referer") || undefined;

  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) return bad("Missing JSON body");

    const to = (body.to || "").trim();
    if (!to) return bad("Missing 'to' email");
    if (!looksLikeEmail(to)) return bad("Invalid 'to' email");

    const { client, fromEmail, source } = await getResendClient();

    const rawFrom = (fromEmail || "").trim();
    const fallbackFrom = "AllFantasy <noreply@allfantasy.ai>";
    const from = rawFrom && !rawFrom.toLowerCase().includes("@gmail.com")
      ? rawFrom
      : fallbackFrom;

    const subject = "AllFantasy Resend Test";
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
      <h2>Resend test email ✅</h2>
      <p>This confirms Resend is working for your current deployment.</p>
      <p><b>Source:</b> ${source}</p>
      <p><b>From:</b> ${from}</p>
      <p style="opacity:.7;font-size:12px">Sent at ${new Date().toISOString()}</p>
    </div>`;

    const resp: any = await client.emails.send({
      from,
      to,
      subject,
      html,
      text: `Resend test email. Source=${source}. From=${from}.`,
    });

    if (resp?.error) {
      throw new Error(resp.error?.message || "Resend send error");
    }

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_resend_test_sent",
        path: "/api/admin/resend/verify",
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          source,
          from,
          to,
          messageId: resp?.data?.id || resp?.id || null,
          ok: true,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      source,
      from,
      to,
      messageId: resp?.data?.id || resp?.id || null,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "send failed");

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_resend_test_failed",
        path: "/api/admin/resend/verify",
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          ok: false,
          error: msg,
        },
      },
    });

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
})
