import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { getOrComputeManagerDNA, getCachedDNA } from '@/lib/manager-dna'

const PostSchema = z.object({
  sleeper_username: z.string().min(1).max(40),
  league_ids: z.array(z.string().min(1)).min(1).max(10),
  force_refresh: z.boolean().optional().default(false),
})

export const POST = withApiUsage({ endpoint: "/api/legacy/manager-dna", tool: "LegacyManagerDna" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'manager_dna',
    ip,
    maxRequests: 5,
    windowMs: 60_000,
    includeIpInKey: true,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. DNA profiling is compute-intensive.' },
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

    const { sleeper_username, league_ids, force_refresh } = parsed.data

    const profile = await getOrComputeManagerDNA(sleeper_username, league_ids, force_refresh)

    return NextResponse.json({
      ok: true,
      profile,
      rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (error) {
    console.error('Manager DNA error:', error)
    return NextResponse.json(
      { error: 'Failed to compute manager DNA profile' },
      { status: 500 },
    )
  }
})

const GetSchema = z.object({
  username: z.string().min(1).max(40),
})

export const GET = withApiUsage({ endpoint: "/api/legacy/manager-dna", tool: "LegacyManagerDna" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'manager_dna_get',
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
  const parsed = GetSchema.safeParse({ username: url.searchParams.get('username') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing username parameter' }, { status: 400 })
  }

  try {
    const profile = await getCachedDNA(parsed.data.username)

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: 'No DNA profile found. Compute one first via POST.' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      profile,
      rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
    })
  } catch (error) {
    console.error('Manager DNA GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve manager DNA profile' },
      { status: 500 },
    )
  }
})
