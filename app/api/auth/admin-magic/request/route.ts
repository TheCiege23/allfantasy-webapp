import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { getResendClient } from "@/lib/resend-client";
import { signAdminMagicToken } from "@/lib/adminSession";

function isAdminAllowed(email: string) {
  const e = email.toLowerCase().trim();
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(e);
}

function sanitizeNext(next?: string) {
  if (!next) return "/admin";
  if (!next.startsWith("/")) return "/admin";
  if (next.startsWith("//")) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  return next;
}

export const POST = withApiUsage({ endpoint: "/api/auth/admin-magic/request", tool: "AuthAdminMagicRequest" })(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body?.email || "").trim().toLowerCase();
    const next = sanitizeNext(String(body?.next || "/admin"));

    const safeOk = NextResponse.json({ ok: true });

    if (!email || !email.includes("@")) return safeOk;
    if (!isAdminAllowed(email)) return safeOk;

    const token = signAdminMagicToken(email, next, 10 * 60);
    const baseUrl = process.env.PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
    const link = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/api/auth/admin-magic/consume?token=${encodeURIComponent(token)}`
      : `/api/auth/admin-magic/consume?token=${encodeURIComponent(token)}`;

    const { client: resend, fromEmail } = await getResendClient();
    const from = fromEmail || process.env.RESEND_FROM || "AllFantasy <no-reply@allfantasy.ai>";

    await resend.emails.send({
      from,
      to: email,
      subject: "Your AllFantasy Admin Magic Link",
      html: `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; font-size:16px; color:#111;">
          <p>Here's your one-time admin login link (expires in 10 minutes):</p>
          <p><a href="${link}">Login to Admin</a></p>
          <p style="color:#555;">If you didn't request this, you can ignore this email.</p>
        </div>
      `.trim(),
    });

    return safeOk;
  } catch {
    return NextResponse.json({ ok: true });
  }
})
