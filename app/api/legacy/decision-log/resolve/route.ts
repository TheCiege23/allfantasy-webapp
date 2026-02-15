import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { resolveDecision } from '@/lib/decision-log'

const ResolveSchema = z.object({
  decisionLogId: z.string().uuid(),
  userFollowed: z.boolean(),
  userAction: z.record(z.unknown()).optional(),
})

export const POST = withApiUsage({ endpoint: "/api/legacy/decision-log/resolve", tool: "LegacyDecisionLogResolve" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'decision_resolve',
    ip,
    maxRequests: 30,
    windowMs: 60_000,
    includeIpInKey: true,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = ResolveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const updated = await resolveDecision({
      decisionLogId: parsed.data.decisionLogId,
      userFollowed: parsed.data.userFollowed,
      userAction: parsed.data.userAction,
    })

    return NextResponse.json({ ok: true, id: updated.id, resolvedAt: updated.resolvedAt })
  } catch (err: any) {
    console.error('[DECISION-LOG] Resolve error:', err)
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Decision log not found' }, { status: 404 })
    }
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
})
