import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

function asInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : def;
}

export const GET = withApiUsage({ endpoint: "/api/admin/analytics/events", tool: "AdminAnalyticsEvents" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const { searchParams } = new URL(request.url);

    const toolKey = (searchParams.get("toolKey") || "").trim();
    const event = (searchParams.get("event") || "").trim();
    const path = (searchParams.get("path") || "").trim();
    const q = (searchParams.get("q") || "").trim();
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    const page = Math.max(1, asInt(searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(10, asInt(searchParams.get("pageSize"), 25)));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    const isExplicitSearch = !!toolKey || !!q || !!path || !!event || !!from || !!to;
    if (!isExplicitSearch) {
      where.OR = [
        { toolKey: { startsWith: "admin_" } },
        { toolKey: { startsWith: "admin" } },
      ];
    }

    if (toolKey) where.toolKey = toolKey;
    if (event) where.event = event;
    if (path) where.path = path;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    if (q) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { toolKey: { contains: q, mode: "insensitive" } },
            { event: { contains: q, mode: "insensitive" } },
            { path: { contains: q, mode: "insensitive" } },
            { userAgent: { contains: q, mode: "insensitive" } },
            { referrer: { contains: q, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.analyticsEvent.count({ where }),
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          event: true,
          toolKey: true,
          path: true,
          userId: true,
          emailHash: true,
          sessionId: true,
          userAgent: true,
          referrer: true,
          meta: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, page, pageSize, total, rows });
  } catch (e) {
    console.error("Admin analytics GET error:", e);
    return NextResponse.json({ error: "Failed to load analytics events" }, { status: 500 });
  }
})
