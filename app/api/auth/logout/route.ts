import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";

export const POST = withApiUsage({ endpoint: "/api/auth/logout", tool: "AuthLogout" })(async () => {
  // Relative redirect avoids 0.0.0.0 / origin issues in dev + Replit
  const res = NextResponse.redirect("/login", { status: 303 });

  res.cookies.set("admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
})
