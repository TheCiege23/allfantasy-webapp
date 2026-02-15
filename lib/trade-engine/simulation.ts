// lib/trade-engine/simulation.ts
import { prisma } from "@/lib/prisma";
import { buildLeagueIntelSnapshot } from "./pipeline";
import { attachNeedsSurplus } from "./value-context-service";
import { runTradeEngine } from "./trade-engine";

export async function simulateFromSleeperImportCache(params: {
  sleeperUsername: string;
  sleeperLeagueId?: string;
}) {
  const sleeperUsername = params.sleeperUsername.toLowerCase();

  const cache = params.sleeperLeagueId
    ? await prisma.sleeperImportCache.findUnique({
        where: {
          sleeperUsername_sleeperLeagueId: {
            sleeperUsername,
            sleeperLeagueId: params.sleeperLeagueId,
          },
        },
        select: { leagueContext: true, managerRosters: true, fantasyCalcValueMap: true },
      })
    : await prisma.sleeperImportCache.findFirst({
        where: { sleeperUsername },
        orderBy: { updatedAt: "desc" },
        select: { leagueContext: true, managerRosters: true, fantasyCalcValueMap: true, sleeperLeagueId: true },
      });

  if (!cache) {
    return { ok: false, error: "No SleeperImportCache found. Run Trade Analyzer first." };
  }

  const league: any = cache.leagueContext;
  const rosters: any[] = cache.managerRosters as any[];
  const fantasyCalcValueMap: any = cache.fantasyCalcValueMap;

  const userRoster = rosters[0];

  const snapshot = await buildLeagueIntelSnapshot({
    league: { ...league, leagueId: league.leagueId || params.sleeperLeagueId || (cache as any).sleeperLeagueId },
    userRoster,
    rosters,
    fantasyCalcValueMap,
    prisma,
  });

  attachNeedsSurplus(snapshot, rosters);

  const result = runTradeEngine(userRoster.rosterId, snapshot as any);
  const trades = result.validTrades;

  const stats = {
    leagueName: snapshot.league.leagueName,
    totalTrades: trades.length,
    byLabel: trades.reduce((m: any, t: any) => ((m[t.acceptanceLabel] = (m[t.acceptanceLabel] || 0) + 1), m), {}),
    byVeto: trades.reduce((m: any, t: any) => ((m[t.vetoLikelihood] = (m[t.vetoLikelihood] || 0) + 1), m), {}),
    parityFlagCount: trades.filter((t: any) => t.parityFlags?.length).length,
    idpEnabled: snapshot.idpConfig.enabled,
    candidatesGenerated: result.stats.candidatesGenerated,
    candidatesRejected: result.stats.candidatesRejected,
  };

  return { ok: true, stats, sample: trades.slice(0, 8) };
}
