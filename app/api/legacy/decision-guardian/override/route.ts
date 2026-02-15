import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { resolveGuardianIntervention, getGuardianStats } from '@/lib/analytics/decision-guardian'

const resolveSchema = z.object({
  action: z.literal('resolve'),
  interventionId: z.string().uuid(),
  userDecision: z.enum(['proceed', 'cancel']),
  overrideReason: z.string().max(500).optional(),
})

const statsSchema = z.object({
  action: z.literal('stats'),
  userId: z.string(),
  leagueId: z.string().optional(),
})

const requestSchema = z.discriminatedUnion('action', [resolveSchema, statsSchema])

export const POST = withApiUsage({ endpoint: "/api/legacy/decision-guardian/override", tool: "LegacyDecisionGuardianOverride" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse()

  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (parsed.data.action === 'resolve') {
      const result = await resolveGuardianIntervention(
        parsed.data.interventionId,
        parsed.data.userDecision,
        parsed.data.overrideReason
      )

      return NextResponse.json({
        success: true,
        intervention: {
          id: result.id,
          userDecision: result.userDecision,
          overrideReason: result.overrideReason,
        },
      })
    }

    if (parsed.data.action === 'stats') {
      const stats = await getGuardianStats(parsed.data.userId, parsed.data.leagueId)
      return NextResponse.json({ success: true, stats })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[GUARDIAN] Override error:', err)
    return NextResponse.json(
      { error: 'Guardian override failed' },
      { status: 500 }
    )
  }
})
