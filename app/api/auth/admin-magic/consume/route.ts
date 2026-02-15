import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { verifyAdminMagicToken, signAdminSessionCookie } from "@/lib/adminSession";

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

export const GET = withApiUsage({ endpoint: "/api/auth/admin-magic/consume", tool: "AuthAdminMagicConsume" })(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const payload = verifyAdminMagicToken(token);

  if (!payload?.email || !isAdminAllowed(payload.email)) {
    return NextResponse.redirect(new URL("/login?err=magic", url));
  }

  const next = sanitizeNext(payload.next || "/admin");

  const cookie = signAdminSessionCookie({
    authenticated: true,
    role: "admin",
    email: payload.email,
    name: "Admin",
  });

  const res = NextResponse.redirect(new URL(next, url), { status: 303 });

  res.cookies.set("admin_session", cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
})
