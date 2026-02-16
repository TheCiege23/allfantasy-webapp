import { withApiUsage } from "@/lib/telemetry/usage";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export const GET = withApiUsage({
  endpoint: "/api/admin/player-analytics",
  tool: "AdminPlayerAnalytics",
})(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const total = await prisma.playerAnalyticsSnapshot.count();
    const byPosition = await prisma.playerAnalyticsSnapshot.groupBy({
      by: ["position"],
      _count: true,
      orderBy: { _count: { position: "desc" } },
    });
    const bySeason = await prisma.playerAnalyticsSnapshot.groupBy({
      by: ["season"],
      _count: true,
      orderBy: { season: "desc" },
    });
    const byStatus = await prisma.playerAnalyticsSnapshot.groupBy({
      by: ["status"],
      _count: true,
    });

    const latest = await prisma.playerAnalyticsSnapshot.findFirst({
      orderBy: { importedAt: "desc" },
      select: { importedAt: true, dataVersion: true, source: true },
    });

    const withBreakoutAge = await prisma.playerAnalyticsSnapshot.count({
      where: { breakoutAge: { not: null } },
    });
    const withCombine = await prisma.playerAnalyticsSnapshot.count({
      where: { fortyYardDash: { not: null } },
    });
    const withComps = await prisma.playerAnalyticsSnapshot.count({
      where: { bestComparablePlayers: { not: null } },
    });

    return NextResponse.json({
      ok: true,
      total,
      byPosition: byPosition.map((p) => ({ position: p.position, count: p._count })),
      bySeason: bySeason.map((s) => ({ season: s.season, count: s._count })),
      byStatus: byStatus.map((s) => ({ status: s.status || "unknown", count: s._count })),
      coverage: {
        breakoutAge: withBreakoutAge,
        combineData: withCombine,
        comparablePlayers: withComps,
      },
      lastImport: latest
        ? { importedAt: latest.importedAt, dataVersion: latest.dataVersion, source: latest.source }
        : null,
    });
  } catch (e: any) {
    console.error("Player analytics GET error:", e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
});

export const POST = withApiUsage({
  endpoint: "/api/admin/player-analytics",
  tool: "AdminPlayerAnalyticsImport",
})(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const csvDir = path.join(process.cwd(), "attached_assets");
    const csvFiles = fs.existsSync(csvDir)
      ? fs.readdirSync(csvDir).filter((f) => f.endsWith(".csv") && f.includes("data_analysis"))
      : [];

    if (csvFiles.length === 0) {
      return NextResponse.json(
        { error: "No player analytics CSV file found in attached_assets/" },
        { status: 400 }
      );
    }

    const csvPath = path.join(csvDir, csvFiles[csvFiles.length - 1]);

    const { importPlayerAnalyticsCSV } = await import(
      "@/scripts/import-player-analytics"
    );
    const result = await importPlayerAnalyticsCSV(csvPath);

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_player_analytics_import",
        path: "/api/admin/player-analytics",
        userId: gate.user.id,
        meta: {
          adminEmail: gate.user.email,
          total: result.total,
          imported: result.imported,
          skipped: result.skipped,
          errorCount: result.errors.length,
          csvFile: csvFiles[csvFiles.length - 1],
        },
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error("Player analytics import error:", e);
    return NextResponse.json({ error: e.message || "Import failed" }, { status: 500 });
  }
});
