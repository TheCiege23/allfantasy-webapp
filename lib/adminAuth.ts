import crypto from "crypto";
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

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

function checkBearerToken(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminPassword || !token) return false;
  return timingSafeCompare(token, adminPassword);
}

function checkAdminSecret(request: Request): boolean {
  const headerSecret =
    request.headers.get("x-admin-secret") ??
    request.headers.get("x-cron-secret") ??
    "";
  if (!headerSecret) return false;
  const adminSecret =
    process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD || "";
  if (!adminSecret) return false;
  return timingSafeCompare(headerSecret, adminSecret);
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

export async function requireAdminOrBearer(request: Request) {
  if (checkBearerToken(request) || checkAdminSecret(request)) {
    return { ok: true as const, user: { role: "admin" } as AdminUser };
  }

  return requireAdmin();
}

export function isAuthorizedRequest(request: Request): boolean {
  if (checkBearerToken(request) || checkAdminSecret(request)) return true;

  try {
    const cookieStore = cookies();
    const adminSession = cookieStore.get("admin_session");
    if (!adminSession?.value) return false;
    const payload = verifyAdminSessionCookie(adminSession.value);
    if (!payload?.authenticated) return false;
    const role = payload.role?.toLowerCase();
    return role === "admin" || !!isAdminEmailAllowed(payload.email);
  } catch {
    return false;
  }
}
