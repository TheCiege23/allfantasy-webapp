import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAdminSessionCookie } from "@/lib/adminSession";

export type AdminUser = {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
};

export function adminUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function isAdminEmailAllowed(email?: string | null) {
  const e = (email || "").toLowerCase();
  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return e && allow.includes(e);
}

export function isAdminRole(role?: string | null) {
  return (role || "").toLowerCase() === "admin";
}

export async function requireAdmin() {
  const cookieStore = cookies();
  const adminSession = cookieStore.get("admin_session");
  if (!adminSession?.value) return { ok: false as const, res: adminUnauthorized() };

  const payload = verifyAdminSessionCookie(adminSession.value);
  if (!payload?.authenticated) return { ok: false as const, res: adminUnauthorized() };

  const email = payload.email?.toLowerCase();
  const role = payload.role?.toLowerCase();

  if (!(role === "admin" || isAdminEmailAllowed(email))) {
    return { ok: false as const, res: adminUnauthorized() };
  }

  const user: AdminUser = {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };

  return { ok: true as const, user };
}
