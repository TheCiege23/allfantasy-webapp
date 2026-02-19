import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import { getCalibratedWeights } from '@/lib/trade-engine/accept-calibration'
import { generateGoalProposals, type ProposalGoal } from '@/lib/trade-engine/goal-proposal-engine'
import { buildLeagueDecisionContext, leagueContextToIntelligence } from '@/lib/trade-engine/league-context-assembler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_GOALS: ProposalGoal[] = [
  'rb_depth', 'wr_depth', 'qb_upgrade', 'te_upgrade',
  'get_younger_rb', 'get_younger_wr', 'acquire_picks',
  'win_now', 'rebuild',
]

const RequestSchema = z.object({
  leagueId: z.string().min(1),
  username: z.string().min(1),
  goal: z.string().refine(g => VALID_GOALS.includes(g as ProposalGoal), 'Invalid goal'),
  sport: z.enum(['nfl']).default('nfl'),
})

export const POST = withApiUsage({ endpoint: "/api/legacy/trade/goal-proposals", tool: "LegacyTradeGoalProposals" })(async (req: NextRequest) => {
  const authResult = requireAuthOrOrigin(req)
  if (!authResult.authenticated) return forbiddenResponse(authResult.error || 'Unauthorized')

  const ip = getClientIp(req)
  const rl = consumeRateLimit({
    scope: 'legacy',
    action: 'goal_proposals',
    ip,
    maxRequests: 8,
    windowMs: 60_000,
    includeIpInKey: true,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before generating more proposals.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 })
    }

    const { leagueId, username, goal } = parsed.data

    const leagueCtx = await buildLeagueDecisionContext({ leagueId, username })
    const { intelligence, parsedRosters } = leagueContextToIntelligence(leagueCtx)

    const userTeam = leagueCtx.teams.find(t =>
      t.userId?.toLowerCase() === username.toLowerCase()
    )
    const userRoster = (userTeam
      ? parsedRosters.find(r => String(r.rosterId) === userTeam.teamId)
      : null
    ) || parsedRosters.find(r => {
      const profileName = (intelligence.managerProfiles[r.rosterId]?.displayName || '').toLowerCase()
      return profileName === username.toLowerCase()
    }) || parsedRosters.find(r => {
      const profile = intelligence.managerProfiles[r.rosterId]
      return profile?.username?.toLowerCase() === username.toLowerCase()
    })

    if (!userRoster) {
      return NextResponse.json({ error: 'Could not find your roster in this league' }, { status: 404 })
    }

    const calWeights = await getCalibratedWeights()

    const result = generateGoalProposals(
      userRoster.rosterId,
      goal as ProposalGoal,
      intelligence,
      { maxPartners: 3, calibratedWeights: calWeights },
    )

    return NextResponse.json({
      success: true,
      ...result,
      leagueInfo: {
        name: leagueCtx.leagueConfig.name,
        type: 'Dynasty',
        teams: leagueCtx.leagueConfig.numTeams,
        scoring: leagueCtx.leagueConfig.scoringType,
      },
      userInfo: {
        name: userRoster.displayName,
        record: userRoster.record ? `${userRoster.record.wins}-${userRoster.record.losses}` : '0-0',
        rosterId: userRoster.rosterId,
      },
      contextId: leagueCtx.contextId,
      sourceFreshness: leagueCtx.sourceFreshness,
    })

  } catch (error: any) {
    console.error('Goal proposals error:', error)
    return NextResponse.json({ error: error.message || 'Failed to generate proposals' }, { status: 500 })
  }
})
