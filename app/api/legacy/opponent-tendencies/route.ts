import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  getOrComputeOpponentTendencies,
  getCachedOpponentProfile,
} from '@/lib/opponent-tendencies'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PostSchema = z.object({
  leagueId: z.string().min(1).max(64),
  userRosterId: z.number().int().positive(),
  forceRefresh: z.boolean().optional().default(false),
})

export const POST = withApiUsage({ endpoint: "/api/legacy/opponent-tendencies", tool: "LegacyOpponentTendencies" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'opponent_tendencies',
    ip,
    maxRequests: 5,
    windowMs: 60_000,
    includeIpInKey: true,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Opponent profiling is compute-intensive.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  try {
    const body = await req.json()
    const parsed = PostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { leagueId, userRosterId, forceRefresh } = parsed.data

    const profiles = await getOrComputeOpponentTendencies(leagueId, userRosterId, forceRefresh)

    return NextResponse.json({
      ok: true,
      leagueId,
      profiles,
      count: profiles.length,
      rateLimit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (error) {
    console.error('Opponent tendencies error:', error)
    return NextResponse.json(
      { error: 'Failed to compute opponent tendencies' },
      { status: 500 },
    )
  }
})

const GetSchema = z.object({
  leagueId: z.string().min(1).max(64),
  rosterId: z.coerce.number().int().positive(),
})

export const GET = withApiUsage({ endpoint: "/api/legacy/opponent-tendencies", tool: "LegacyOpponentTendencies" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'opponent_tendencies_get',
    ip,
    maxRequests: 30,
    windowMs: 60_000,
    includeIpInKey: true,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    )
  }

  const url = new URL(req.url)
  const parsed = GetSchema.safeParse({
    leagueId: url.searchParams.get('leagueId'),
    rosterId: url.searchParams.get('rosterId'),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing leagueId and rosterId parameters' },
      { status: 400 },
    )
  }

  try {
    const profile = await getCachedOpponentProfile(parsed.data.leagueId, parsed.data.rosterId)

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: 'No opponent profile found. Compute league tendencies first via POST.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      profile,
      rateLimit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (error) {
    console.error('Opponent tendencies GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve opponent profile' },
      { status: 500 },
    )
  }
})
