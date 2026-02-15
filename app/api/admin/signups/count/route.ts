import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/signups/count", tool: "AdminSignupsCount" })(async () => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const count = await prisma.earlyAccessSignup.count();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Admin signups count error:", error);
    return NextResponse.json({ error: "Failed to load count" }, { status: 500 });
  }
})
