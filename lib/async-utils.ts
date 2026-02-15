export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Small, polite jitter for API friendliness.
 * 250–500ms default.
 */
export function jitterSleep(minMs = 250, maxMs = 500) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs + 1));
  return sleep(ms);
}

/**
 * Concurrency-limited runner (no deps).
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => runner()));
  return results;
}
