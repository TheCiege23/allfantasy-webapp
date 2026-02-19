import { prisma } from "@/lib/prisma"

const CRITICAL_ENDPOINTS = [
  "/api/legacy/transfer",
  "/api/trade-finder",
  "/api/strategy/generate",
]

const ALERT_THRESHOLDS = {
  error5xxCount: 3,
  errorRatePercent: 10,
  redirectLoopCount: 5,
  windowMinutes: 15,
}

export interface AlertPayload {
  type: "5xx_spike" | "redirect_loop" | "high_error_rate"
  endpoint: string
  count: number
  threshold: number
  windowMinutes: number
  timestamp: string
  details?: string
}

const recentAlerts = new Map<string, number>()
const ALERT_COOLDOWN_MS = 10 * 60 * 1000

function shouldAlert(key: string): boolean {
  const last = recentAlerts.get(key)
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false
  recentAlerts.set(key, Date.now())
  return true
}

async function emitAlert(alert: AlertPayload) {
  const key = `${alert.type}:${alert.endpoint}`
  if (!shouldAlert(key)) return

  console.error(`[ALERT] ${alert.type} | ${alert.endpoint} | count=${alert.count} threshold=${alert.threshold} | ${alert.details || ""}`)

  try {
    await prisma.apiUsageEvent.create({
      data: {
        ts: new Date(),
        scope: "api",
        tool: "observability",
        endpoint: alert.endpoint,
        method: "ALERT",
        status: null,
        ok: false,
        durationMs: null,
        bytesIn: null,
        bytesOut: null,
        userId: null,
        username: null,
        leagueId: "",
        meta: alert as any,
      },
    })
  } catch {
  }
}

export async function check5xxAlerts(): Promise<AlertPayload[]> {
  const windowStart = new Date(Date.now() - ALERT_THRESHOLDS.windowMinutes * 60_000)
  const alerts: AlertPayload[] = []

  for (const endpoint of CRITICAL_ENDPOINTS) {
    try {
      const events = await prisma.apiUsageEvent.findMany({
        where: {
          endpoint,
          ts: { gte: windowStart },
          status: { gte: 500 },
        },
        select: { id: true },
      })

      if (events.length >= ALERT_THRESHOLDS.error5xxCount) {
        const alert: AlertPayload = {
          type: "5xx_spike",
          endpoint,
          count: events.length,
          threshold: ALERT_THRESHOLDS.error5xxCount,
          windowMinutes: ALERT_THRESHOLDS.windowMinutes,
          timestamp: new Date().toISOString(),
          details: `${events.length} server errors in last ${ALERT_THRESHOLDS.windowMinutes}min`,
        }
        alerts.push(alert)
        await emitAlert(alert)
      }
    } catch {
    }
  }

  return alerts
}

export async function checkErrorRates(): Promise<AlertPayload[]> {
  const windowStart = new Date(Date.now() - ALERT_THRESHOLDS.windowMinutes * 60_000)
  const alerts: AlertPayload[] = []

  for (const endpoint of CRITICAL_ENDPOINTS) {
    try {
      const totalCount = await prisma.apiUsageEvent.count({
        where: { endpoint, ts: { gte: windowStart } },
      })
      if (totalCount < 5) continue

      const errCount = await prisma.apiUsageEvent.count({
        where: { endpoint, ts: { gte: windowStart }, ok: false },
      })

      const errorRate = (errCount / totalCount) * 100
      if (errorRate >= ALERT_THRESHOLDS.errorRatePercent) {
        const alert: AlertPayload = {
          type: "high_error_rate",
          endpoint,
          count: errCount,
          threshold: ALERT_THRESHOLDS.errorRatePercent,
          windowMinutes: ALERT_THRESHOLDS.windowMinutes,
          timestamp: new Date().toISOString(),
          details: `${errorRate.toFixed(1)}% error rate (${errCount}/${totalCount}) in last ${ALERT_THRESHOLDS.windowMinutes}min`,
        }
        alerts.push(alert)
        await emitAlert(alert)
      }
    } catch {
    }
  }

  return alerts
}

const redirectLoopTracker = new Map<string, { count: number; firstSeen: number }>()

export function trackRedirectLoop(userId: string, path: string) {
  const key = `${userId}:${path}`
  const now = Date.now()
  const entry = redirectLoopTracker.get(key)

  if (entry && now - entry.firstSeen < ALERT_THRESHOLDS.windowMinutes * 60_000) {
    entry.count++
    if (entry.count >= ALERT_THRESHOLDS.redirectLoopCount) {
      const alert: AlertPayload = {
        type: "redirect_loop",
        endpoint: path,
        count: entry.count,
        threshold: ALERT_THRESHOLDS.redirectLoopCount,
        windowMinutes: ALERT_THRESHOLDS.windowMinutes,
        timestamp: new Date().toISOString(),
        details: `User ${userId} redirect-looped ${entry.count} times on ${path}`,
      }
      emitAlert(alert).catch(() => {})
      redirectLoopTracker.delete(key)
    }
  } else {
    redirectLoopTracker.set(key, { count: 1, firstSeen: now })
  }

  for (const [k, v] of redirectLoopTracker) {
    if (now - v.firstSeen > ALERT_THRESHOLDS.windowMinutes * 60_000) {
      redirectLoopTracker.delete(k)
    }
  }
}

export async function runObservabilityChecks(): Promise<AlertPayload[]> {
  const [fivexx, rates] = await Promise.all([
    check5xxAlerts(),
    checkErrorRates(),
  ])
  return [...fivexx, ...rates]
}
