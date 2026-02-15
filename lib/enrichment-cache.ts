import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export type CacheTier = 'news_context' | 'rolling_insights' | 'enrichment_aggregate';

const TTL_MINUTES: Record<CacheTier, number> = {
  news_context: 15,
  rolling_insights: 10,
  enrichment_aggregate: 5,
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

function buildCacheKey(tier: CacheTier, params: Record<string, unknown>): string {
  const stable = stableStringify(params);
  const hash = crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
  return `${tier}:${hash}`;
}

export async function readCache<T = unknown>(
  prisma: PrismaClient,
  tier: CacheTier,
  params: Record<string, unknown>
): Promise<{ data: T; fetchedAt: string } | null> {
  const identifier = buildCacheKey(tier, params);
  try {
    const row = await prisma.sportsDataCache.findUnique({
      where: {
        sport_dataType_identifier: {
          sport: 'NFL',
          dataType: tier,
          identifier,
        },
      },
    });

    if (!row) return null;
    if (row.expiresAt < new Date()) {
      prisma.sportsDataCache.delete({ where: { id: row.id } }).catch(() => {});
      return null;
    }

    return {
      data: row.data as T,
      fetchedAt: row.fetchedAt.toISOString(),
    };
  } catch (err) {
    console.warn(`[EnrichmentCache] Read failed for ${tier}:`, err);
    return null;
  }
}

export async function writeCache(
  prisma: PrismaClient,
  tier: CacheTier,
  params: Record<string, unknown>,
  data: unknown,
  source: string = 'enrichment'
): Promise<void> {
  const identifier = buildCacheKey(tier, params);
  const ttlMs = TTL_MINUTES[tier] * 60 * 1000;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    await prisma.sportsDataCache.upsert({
      where: {
        sport_dataType_identifier: {
          sport: 'NFL',
          dataType: tier,
          identifier,
        },
      },
      update: {
        data: data as any,
        source,
        fetchedAt: now,
        expiresAt,
      },
      create: {
        sport: 'NFL',
        dataType: tier,
        identifier,
        data: data as any,
        source,
        fetchedAt: now,
        expiresAt,
      },
    });
  } catch (err) {
    console.warn(`[EnrichmentCache] Write failed for ${tier}:`, err);
  }
}

export async function purgeExpiredCache(prisma: PrismaClient): Promise<number> {
  try {
    const result = await prisma.sportsDataCache.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  } catch (err) {
    console.warn('[EnrichmentCache] Purge failed:', err);
    return 0;
  }
}
