import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export async function scheduleAutoSync() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

  const cronSecret = process.env.LEAGUE_CRON_SECRET || process.env.ADMIN_PASSWORD;

  await qstash.publishJSON({
    url: `${appUrl}/api/cron/auto-sync`,
    headers: {
      'x-cron-secret': cronSecret || '',
    },
    cron: '0 */6 * * *',
  });

  console.log('[QStash] Auto-sync scheduled: every 6 hours');
}

export async function triggerSyncNow() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

  const cronSecret = process.env.LEAGUE_CRON_SECRET || process.env.ADMIN_PASSWORD;

  await qstash.publishJSON({
    url: `${appUrl}/api/cron/auto-sync`,
    headers: {
      'x-cron-secret': cronSecret || '',
    },
  });

  console.log('[QStash] One-time auto-sync triggered');
}
