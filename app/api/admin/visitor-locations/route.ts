import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/visitor-locations", tool: "AdminVisitorLocations" })(async () => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const locations = await prisma.visitorLocation.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        city: true,
        region: true,
        country: true,
        countryCode: true,
        lat: true,
        lng: true,
        visits: true,
        lastSeen: true,
      },
      orderBy: { lastSeen: "desc" },
      take: 500,
    });

    const byCountry: Record<string, number> = {};
    locations.forEach((loc) => {
      const key = loc.country || "Unknown";
      byCountry[key] = (byCountry[key] || 0) + loc.visits;
    });

    return NextResponse.json({
      ok: true,
      locations,
      totalUnique: locations.length,
      totalVisits: locations.reduce((sum, l) => sum + l.visits, 0),
      byCountry: Object.entries(byCountry)
        .map(([country, visits]) => ({ country, visits }))
        .sort((a, b) => b.visits - a.visits),
    });
  } catch (e) {
    console.error("Visitor locations error:", e);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
})
