import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { evaluateOutcome, batchEvaluateOutcomes } from '@/lib/decision-log'

const SingleEvalSchema = z.object({
  decisionLogId: z.string().uuid(),
  evaluationWeeks: z.number().int().min(1).max(16).optional(),
})

const BatchEvalSchema = z.object({
  batch: z.literal(true),
  minAgeWeeks: z.number().int().min(1).max(16).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

const EvalSchema = z.union([SingleEvalSchema, BatchEvalSchema])

export const POST = withApiUsage({ endpoint: "/api/legacy/decision-log/evaluate", tool: "LegacyDecisionLogEvaluate" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'decision_evaluate',
    ip,
    maxRequests: 5,
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
    const parsed = EvalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    if ('batch' in parsed.data && parsed.data.batch) {
      const result = await batchEvaluateOutcomes(
        parsed.data.minAgeWeeks ?? 3,
        parsed.data.limit ?? 20
      )
      return NextResponse.json({ ok: true, ...result })
    }

    if ('decisionLogId' in parsed.data) {
      const outcome = await evaluateOutcome({
        decisionLogId: parsed.data.decisionLogId,
        evaluationWeeks: parsed.data.evaluationWeeks,
      })
      return NextResponse.json({ ok: true, outcome })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (err: any) {
    console.error('[DECISION-LOG] Evaluate error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
})
