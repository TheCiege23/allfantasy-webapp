import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { setUserSessionCookie, getUserSessionFromCookie, clearUserSessionCookie, validateRequestOrigin } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'

export const POST = withApiUsage({ endpoint: "/api/legacy/session", tool: "LegacySession" })(async (req: NextRequest) => {
  try {
    if (!validateRequestOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    const ip = getClientIp(req)
    const rateLimit = consumeRateLimit({
      scope: 'legacy',
      action: 'session_create',
      ip,
      maxRequests: 10,
      windowMs: 60_000,
    })

    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json()
    const sleeperUsername = String(body.sleeper_username || '').trim()
    const sleeperId = body.sleeper_id ? String(body.sleeper_id).trim() : undefined

    if (!sleeperUsername || sleeperUsername.length < 2 || sleeperUsername.length > 50) {
      return NextResponse.json({ error: 'Invalid sleeper_username' }, { status: 400 })
    }

    setUserSessionCookie({
      sleeperUsername,
      sleeperId,
    })

    return NextResponse.json({ success: true, username: sleeperUsername })
  } catch (e) {
    console.error('Session create error:', e)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
})

export const GET = withApiUsage({ endpoint: "/api/legacy/session", tool: "LegacySession" })(async (req: NextRequest) => {
  try {
    if (!validateRequestOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    const session = getUserSessionFromCookie()

    if (!session) {
      return NextResponse.json({ authenticated: false, user: null })
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        sleeperUsername: session.sleeperUsername,
        sleeperId: session.sleeperId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
    })
  } catch (e) {
    console.error('Session check error:', e)
    return NextResponse.json({ error: 'Failed to check session' }, { status: 500 })
  }
})

export const DELETE = withApiUsage({ endpoint: "/api/legacy/session", tool: "LegacySession" })(async (req: NextRequest) => {
  try {
    if (!validateRequestOrigin(req)) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    clearUserSessionCookie()

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Session delete error:', e)
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 })
  }
})
