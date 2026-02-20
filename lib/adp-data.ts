import { prisma } from '@/lib/prisma';

export interface ADPEntry {
  name: string;
  position: string;
  team: string | null;
  adp: number;
  adpTrend: number | null;
  age: number | null;
  value: number | null;
  source: 'analytics' | 'devy' | 'ffc' | 'ktc' | 'rookie-db';
}

let adpCache: { data: ADPEntry[]; ts: number; type: string } | null = null;
const CACHE_TTL = 5 * 60 * 1000;
const DB_CACHE_TTL = 1000 * 60 * 60 * 24;

export async function getLiveADP(
  type: 'dynasty' | 'redraft' | 'devy' = 'dynasty',
  limit = 150
): Promise<ADPEntry[]> {
  if (type === 'devy') {
    return getDevyADP(limit);
  }

  if (adpCache && adpCache.type === type && Date.now() - adpCache.ts < CACHE_TTL) {
    return adpCache.data.slice(0, limit);
  }

  const dbCacheKey = `adp-multi-${type}-${new Date().toISOString().slice(0, 10)}`;
  try {
    const cached = await prisma.sportsDataCache.findUnique({ where: { key: dbCacheKey } });
    if (cached && new Date(cached.expiresAt) > new Date()) {
      const data = cached.data as unknown as ADPEntry[];
      adpCache = { data, ts: Date.now(), type };
      return data.slice(0, limit);
    }
  } catch {}

  const entries: ADPEntry[] = [];

  const analyticsPlayers = await (prisma as any).playerAnalyticsSnapshot.findMany({
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

  for (const p of analyticsPlayers) {
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

  try {
    const ffcRes = await fetch(
      `https://fantasyfootballcalculator.com/api/v1/adp/${type === 'dynasty' ? 'dynasty' : 'standard'}?teams=12&year=${new Date().getFullYear()}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (ffcRes.ok) {
      const ffcRaw = await ffcRes.json();
      const ffcData = Array.isArray(ffcRaw) ? ffcRaw : (ffcRaw?.players || ffcRaw?.data || []);
      if (Array.isArray(ffcData)) {
        const existingNames = new Set(entries.map(e => e.name.toLowerCase()));
        for (const p of ffcData) {
          if (p.name && p.position && !existingNames.has(p.name.toLowerCase())) {
            entries.push({
              name: p.name,
              position: p.position,
              team: p.team || null,
              adp: p.adp || 999,
              adpTrend: null,
              age: null,
              value: null,
              source: 'ffc',
            });
            existingNames.add(p.name.toLowerCase());
          }
        }
      }
    }
  } catch {
    console.log('[adp] FFC API fetch failed, continuing with other sources');
  }

  try {
    const ktcCache = await prisma.sportsDataCache.findUnique({ where: { key: 'ktc-dynasty-rankings' } });
    if (ktcCache?.data && Array.isArray(ktcCache.data)) {
      const existingNames = new Set(entries.map(e => e.name.toLowerCase()));
      for (const p of ktcCache.data as any[]) {
        if (p.name && !existingNames.has(p.name.toLowerCase())) {
          entries.push({
            name: p.name,
            position: p.position || 'UNK',
            team: p.team || null,
            adp: p.rank || 999,
            adpTrend: null,
            age: null,
            value: p.value || null,
            source: 'ktc',
          });
          existingNames.add(p.name.toLowerCase());
        } else if (p.name && p.value) {
          const existing = entries.find(e => e.name.toLowerCase() === p.name.toLowerCase());
          if (existing && existing.value == null) {
            existing.value = p.value;
          }
        }
      }
    }
  } catch {
    console.log('[adp] KTC cache read failed');
  }

  if (type === 'dynasty') {
    try {
      const currentYear = new Date().getFullYear();
      const rookies = await (prisma as any).rookieRanking.findMany({
        where: { year: { in: [currentYear, currentYear + 1] } },
        orderBy: { rank: 'asc' },
      });
      if (rookies && rookies.length > 0) {
        const existingNames = new Set(entries.map((e: ADPEntry) => e.name.toLowerCase()));
        for (const r of rookies) {
          if (!existingNames.has(r.name.toLowerCase())) {
            entries.push({
              name: r.name,
              position: r.position,
              team: r.team || 'Rookie',
              adp: r.rank,
              adpTrend: null,
              age: null,
              value: r.dynastyValue || null,
              source: 'rookie-db',
            });
            existingNames.add(r.name.toLowerCase());
          }
        }
      }
    } catch {
      console.log('[adp] Rookie rankings fetch failed');
    }
  }

  entries.sort((a, b) => a.adp - b.adp);

  try {
    await prisma.sportsDataCache.upsert({
      where: { key: dbCacheKey },
      update: { data: entries as any, expiresAt: new Date(Date.now() + DB_CACHE_TTL) },
      create: { key: dbCacheKey, data: entries as any, expiresAt: new Date(Date.now() + DB_CACHE_TTL) },
    });
  } catch {}

  adpCache = { data: entries, ts: Date.now(), type };
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

  const lines = entries.slice(0, maxEntries).map(p => {
    const team = p.team || 'FA';
    const adp = p.adp != null ? p.adp.toFixed(1) : 'N/A';
    const value = p.value != null ? p.value.toFixed(0) : 'N/A';
    let line = `${p.name} (${p.position}, ${team}) - ADP: ${adp} • Value: ${value}`;
    if (p.age != null) line += ` • Age: ${p.age}`;
    if (p.adpTrend != null && p.adpTrend !== 0) {
      line += ` • ${p.adpTrend < 0 ? 'RISING' : 'FALLING'}`;
    }
    return line;
  });

  return lines.join('\n');
}
