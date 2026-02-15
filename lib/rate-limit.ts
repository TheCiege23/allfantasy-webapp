const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS = 5

// --- Backward-compatible helpers (do not remove) ---
export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    return true
  }

  if (record.count >= MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export function rateLimit(
  ip: string,
  maxRequests: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): { success: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: maxRequests - 1 }
  }

  if (record.count >= maxRequests) {
    return { success: false, remaining: 0 }
  }

  record.count++
  return { success: true, remaining: maxRequests - record.count }
}

// --- New unified strategy ---
export type RateLimitResult = {
  success: boolean
  remaining: number
  retryAfterSec: number
  resetTimeMs: number
  key: string
}

function normalizeKeyPart(v: string) {
  return (v || '').trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Unified rate limiter that supports:
 * - per-user throttling (sleeper_username)
 * - optional IP bucketing (for abuse)
 * - per-endpoint configs
 */
export function consumeRateLimit(args: {
  scope: string // e.g. "legacy"
  action: string // e.g. "rank_refresh" | "share" | "ai_coach"
  sleeperUsername?: string | null
  ip?: string | null
  maxRequests: number
  windowMs: number
  // if true, include IP in the bucket key (stricter). default false because you asked "instead of IP"
  includeIpInKey?: boolean
}): RateLimitResult {
  const now = Date.now()
  const scope = normalizeKeyPart(args.scope)
  const action = normalizeKeyPart(args.action)

  const u = args.sleeperUsername ? normalizeKeyPart(args.sleeperUsername) : 'anonymous'
  const ip = args.ip ? normalizeKeyPart(args.ip) : 'unknown'

  // Per-user throttling is the primary strategy
  // Optionally include IP to deter automated abuse while still being "per user"
  const key = args.includeIpInKey
    ? `${scope}:${action}:user:${u}:ip:${ip}`
    : `${scope}:${action}:user:${u}`

  const max = Math.max(1, Math.floor(args.maxRequests))
  const windowMs = Math.max(1000, Math.floor(args.windowMs))

  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    const resetTimeMs = now + windowMs
    rateLimitMap.set(key, { count: 1, resetTime: resetTimeMs })
    return {
      success: true,
      remaining: max - 1,
      retryAfterSec: 0,
      resetTimeMs,
      key,
    }
  }

  if (record.count >= max) {
    const retryAfterSec = Math.max(0, Math.ceil((record.resetTime - now) / 1000))
    return {
      success: false,
      remaining: 0,
      retryAfterSec,
      resetTimeMs: record.resetTime,
      key,
    }
  }

  record.count++
  const remaining = Math.max(0, max - record.count)
  return {
    success: true,
    remaining,
    retryAfterSec: 0,
    resetTimeMs: record.resetTime,
    key,
  }
}

export function getClientIp(req: Request) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}

/** Convenience: convert rl into milliseconds remaining (for UI countdowns). */
export function getRetryAfterMs(rl: Pick<RateLimitResult, 'retryAfterSec'>) {
  const s = Number(rl?.retryAfterSec ?? 0)
  return Math.max(0, Math.floor(s * 1000))
}

/** Standardized 429 payload shape (shared by AI Coach + Share + Rank Refresh if you want). */
export function buildRateLimit429(args: {
  message?: string
  rl: RateLimitResult
}) {
  const msg = args.message || 'Cooldown active. Please wait and try again.'
  return {
    ok: false,
    success: false,
    error: 'COOLDOWN',
    message: msg,
    retryAfterSec: args.rl.retryAfterSec,
    retryAfterMs: getRetryAfterMs(args.rl),
    remaining: args.rl.remaining,
    resetTimeMs: args.rl.resetTimeMs,
  }
}

// cleanup expired buckets
setInterval(() => {
  const now = Date.now()
  Array.from(rateLimitMap.entries()).forEach(([k, v]) => {
    if (now > v.resetTime) rateLimitMap.delete(k)
  })
}, WINDOW_MS)
