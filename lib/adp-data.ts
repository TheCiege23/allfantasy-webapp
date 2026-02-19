import { prisma } from '@/lib/prisma';

export interface ADPEntry {
  name: string;
  position: string;
  team: string | null;
  adp: number;
  adpTrend: number | null;
  age: number | null;
  value: number | null;
  source: 'analytics' | 'devy';
}

let adpCache: { data: ADPEntry[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export async function getLiveADP(
  type: 'dynasty' | 'redraft' | 'devy' = 'dynasty',
  limit = 150
): Promise<ADPEntry[]> {
  if (type === 'devy') {
    return getDevyADP(limit);
  }

  if (adpCache && Date.now() - adpCache.ts < CACHE_TTL) {
    return adpCache.data.slice(0, limit);
  }

  const players = await (prisma as any).playerAnalyticsSnapshot.findMany({
    where: {
      currentAdp: { not: null },
      position: { in: ['QB', 'RB', 'WR', 'TE'] },
    },
    select: {
      name: true,
      position: true,
      currentTeam: true,
      currentAdp: true,
      currentAdpTrend: true,
      lifetimeValue: true,
      rawData: true,
    },
    orderBy: { currentAdp: 'asc' },
    take: 300,
  });

  const entries: ADPEntry[] = [];
  for (const p of players) {
    let age: number | null = null;
    if (p.rawData && typeof p.rawData === 'object') {
      age = (p.rawData as any).age || (p.rawData as any).Age || null;
    }

    entries.push({
      name: p.name,
      position: p.position,
      team: p.currentTeam || null,
      adp: p.currentAdp,
      adpTrend: p.currentAdpTrend || null,
      age,
      value: p.lifetimeValue || null,
      source: 'analytics',
    });
  }

  adpCache = { data: entries, ts: Date.now() };
  return entries.slice(0, limit);
}

async function getDevyADP(limit: number): Promise<ADPEntry[]> {
  const devyPlayers = await (prisma as any).devyPlayer.findMany({
    where: { devyEligible: true, graduatedToNFL: false },
    include: {
      devyAdpHistory: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
    },
    take: limit * 2,
  });

  const entries: ADPEntry[] = [];
  for (const p of devyPlayers) {
    const latestAdpRecord = p.devyAdpHistory?.[0];
    const adpValue = latestAdpRecord?.adp ?? p.devyAdp;
    if (adpValue == null) continue;

    let trend: number | null = null;
    if (latestAdpRecord && p.devyAdp != null) {
      trend = latestAdpRecord.adp - p.devyAdp;
    }

    entries.push({
      name: p.name,
      position: p.position,
      team: p.school || p.nflTeam || null,
      adp: adpValue,
      adpTrend: trend,
      age: null,
      value: null,
      source: 'devy',
    });
  }

  entries.sort((a, b) => a.adp - b.adp);
  return entries.slice(0, limit);
}

export async function getPlayerADP(playerName: string): Promise<ADPEntry | null> {
  const normalizedSearch = playerName.toLowerCase().trim();

  const player = await (prisma as any).playerAnalyticsSnapshot.findFirst({
    where: {
      currentAdp: { not: null },
      normalizedName: {
        contains: normalizedSearch,
      },
    },
    select: {
      name: true,
      position: true,
      currentTeam: true,
      currentAdp: true,
      currentAdpTrend: true,
      lifetimeValue: true,
      rawData: true,
    },
    orderBy: { currentAdp: 'asc' },
  });

  if (!player) return null;

  let age: number | null = null;
  if (player.rawData && typeof player.rawData === 'object') {
    age = (player.rawData as any).age || (player.rawData as any).Age || null;
  }

  return {
    name: player.name,
    position: player.position,
    team: player.currentTeam || null,
    adp: player.currentAdp,
    adpTrend: player.currentAdpTrend || null,
    age,
    value: player.lifetimeValue || null,
    source: 'analytics',
  };
}

export function formatADPForPrompt(entries: ADPEntry[], maxEntries = 100): string {
  if (entries.length === 0) return 'No ADP data available.';

  const lines = entries.slice(0, maxEntries).map((p, i) => {
    const parts = [`${i + 1}. ${p.name} (${p.position})`];
    if (p.team) parts.push(`${p.team}`);
    parts.push(`ADP: ${p.adp.toFixed(1)}`);
    if (p.value != null) parts.push(`Value: ${p.value.toFixed(0)}`);
    if (p.age != null) parts.push(`Age: ${p.age}`);
    if (p.adpTrend != null) {
      const dir = p.adpTrend > 0 ? 'falling' : p.adpTrend < 0 ? 'rising' : 'stable';
      parts.push(`Trend: ${dir}`);
    }
    return parts.join(' | ');
  });

  return lines.join('\n');
}
