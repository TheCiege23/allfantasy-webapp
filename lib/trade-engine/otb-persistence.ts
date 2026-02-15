// lib/trade-engine/otb-persistence.ts
import { prisma } from "@/lib/prisma";

export async function applyOtbTagsToAssetsByRosterId(opts: {
  leagueId: string;
  assetsByRosterId: Record<string, any[]>;
}) {
  const { leagueId, assetsByRosterId } = opts;

  const rows = await prisma.tradeBlockEntry.findMany({
    where: {
      sleeperLeagueId: leagueId,
      isActive: true,
    },
    select: {
      rosterId: true,
      playerId: true,
    },
  });

  const otbSet = new Set<string>((rows || []).map((r) => `${r.rosterId}:${r.playerId}`));

  for (const [rid, assets] of Object.entries(assetsByRosterId)) {
    if (!Array.isArray(assets)) continue;
    for (const a of assets) {
      if (String(a?.type || "").toUpperCase() !== "PLAYER") continue;
      const key = `${rid}:${a?.id}`;
      if (!otbSet.has(key)) continue;

      const tags = Array.isArray(a.tags) ? a.tags.slice() : [];
      if (!tags.some((t: string) => String(t).toLowerCase() === "otb")) tags.push("OTB");
      a.tags = tags;
    }
  }

  return assetsByRosterId;
}
