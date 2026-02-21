const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : 'http://localhost:5000';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

interface SyncTask {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  intervalMs: number;
  body?: Record<string, string>;
  requiresAuth: boolean;
  lastRun: number;
  running: boolean;
}

const syncTasks: SyncTask[] = [
  {
    name: 'Live Scores',
    url: `${BASE_URL}/api/sports/live-scores?refresh=true`,
    method: 'GET',
    intervalMs: 2 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'News',
    url: `${BASE_URL}/api/sports/news?refresh=true`,
    method: 'GET',
    intervalMs: 30 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Injuries',
    url: `${BASE_URL}/api/sports/injuries?refresh=true`,
    method: 'GET',
    intervalMs: 6 * 60 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Full Data Sync (Teams + Schedule)',
    url: `${BASE_URL}/api/sports/sync`,
    method: 'POST',
    intervalMs: 24 * 60 * 60 * 1000,
    body: { type: 'all', source: 'all' },
    requiresAuth: true,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Weekly Auto-Recalibration',
    url: `${BASE_URL}/api/admin/recalibration`,
    method: 'POST' as const,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    body: { season: '2025' },
    requiresAuth: true,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Weekly Weight Re-Learning',
    url: `${BASE_URL}/api/admin/weekly-weights`,
    method: 'POST' as const,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    body: {},
    requiresAuth: true,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Devy Player Sync',
    url: `${BASE_URL}/api/admin/devy-sync`,
    method: 'POST' as const,
    intervalMs: 24 * 60 * 60 * 1000,
    body: {},
    requiresAuth: true,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Trending Players Sync',
    url: `${BASE_URL}/api/sports/trending?refresh=true`,
    method: 'GET' as const,
    intervalMs: 2 * 60 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Depth Charts Sync',
    url: `${BASE_URL}/api/sports/depth-charts?refresh=true`,
    method: 'GET' as const,
    intervalMs: 12 * 60 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Team Stats Sync',
    url: `${BASE_URL}/api/sports/team-stats?refresh=true`,
    method: 'GET' as const,
    intervalMs: 24 * 60 * 60 * 1000,
    requiresAuth: false,
    lastRun: 0,
    running: false,
  },
  {
    name: 'Weekly Backtest + Param Learning',
    url: `${BASE_URL}/api/admin/weekly-backtest`,
    method: 'POST' as const,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    body: { season: '2025' },
    requiresAuth: true,
    lastRun: 0,
    running: false,
  },
];

async function runTask(task: SyncTask): Promise<void> {
  if (task.running) {
    console.log(`[Sync] ${task.name}: SKIPPED (still running from previous tick)`);
    return;
  }
  task.running = true;
  task.lastRun = Date.now();
  const startTime = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (task.requiresAuth && ADMIN_PASSWORD) {
      headers['Authorization'] = `Bearer ${ADMIN_PASSWORD}`;
    }

    const options: RequestInit = {
      method: task.method,
      headers,
    };

    if (task.method === 'POST' && task.body) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(task.body);
    }

    const response = await fetch(task.url, options);
    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      const count = data.count || data.results ? JSON.stringify(data.results || data.count) : 'ok';
      console.log(`[Sync] ${task.name}: SUCCESS (${duration}ms) - ${count}`);
    } else {
      console.error(`[Sync] ${task.name}: FAILED ${response.status} (${duration}ms)`);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Sync] ${task.name}: ERROR (${duration}ms) -`, error instanceof Error ? error.message : error);
  } finally {
    task.running = false;
  }
}

async function checkAndRunTasks(): Promise<void> {
  const now = Date.now();

  for (const task of syncTasks) {
    if (now - task.lastRun >= task.intervalMs) {
      await runTask(task);
    }
  }
}

function formatInterval(ms: number): string {
  if (ms >= 3600000) return `${ms / 3600000}h`;
  if (ms >= 60000) return `${ms / 60000}m`;
  return `${ms / 1000}s`;
}

async function main(): Promise<void> {
  console.log('[BackgroundSync] Starting background sync service...');
  console.log(`[BackgroundSync] Base URL: ${BASE_URL}`);
  console.log('[BackgroundSync] Schedule:');
  for (const task of syncTasks) {
    console.log(`  - ${task.name}: every ${formatInterval(task.intervalMs)}`);
  }
  console.log('');

  console.log('[BackgroundSync] Waiting 15s for server to be ready...');
  await new Promise((resolve) => setTimeout(resolve, 15000));

  console.log('[BackgroundSync] Running initial sync...');
  for (const task of syncTasks) {
    try {
      await runTask(task);
    } catch (e) {
      console.error(`[BackgroundSync] Initial sync failed for ${task.name}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log('[BackgroundSync] Initial sync complete. Starting scheduled loop...\n');

  const TICK_INTERVAL = 30 * 1000;
  setInterval(async () => {
    try {
      await checkAndRunTasks();
    } catch (error) {
      console.error('[BackgroundSync] Tick error:', error);
    }
  }, TICK_INTERVAL);
}

main().catch((error) => {
  console.error('[BackgroundSync] Fatal error — restarting in 30s:', error);
  setTimeout(() => {
    main().catch(() => process.exit(1));
  }, 30000);
});
