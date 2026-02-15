import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit, getClientIp } from '@/lib/rate-limit'
import { requireAuthOrOrigin, forbiddenResponse } from '@/lib/api-auth'
import { trackLegacyToolUsage } from '@/lib/analytics-server'
import {
  getSleeperUser,
  getLeagueRosters,
  getLeagueInfo,
  getAllPlayers,
  getLeagueType,
  getScoringType,
  SleeperPlayer,
} from '@/lib/sleeper-client'
import { pricePlayer, ValuationContext } from '@/lib/hybrid-valuation'
import { getComprehensiveLearningContext } from '@/lib/comprehensive-trade-learning'
import { autoLogDecision } from '@/lib/decision-log'
import { computeConfidenceRisk, getHistoricalHitRate } from '@/lib/analytics/confidence-risk-engine'
import {
  scoreWaiverCandidates,
  type WaiverCandidate,
  type WaiverRosterPlayer,
  type WaiverScoringContext,
} from '@/lib/waiver-engine/waiver-scoring'
import {
  computeTeamNeeds,
  deriveGoalFromContext,
  type UserGoal,
} from '@/lib/waiver-engine/team-needs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
})

type RosterSlot = 'starter' | 'bench' | 'ir' | 'taxi'

interface RosterPlayer {
  id: string
  name: string
  position: string
  team: string | null
  slot: RosterSlot
  age?: number
}

interface FreeAgent {
  id: string
  name: string
  position: string
  team: string | null
  age?: number
  status?: string
}

function categorizeRoster(
  roster: { starters: string[]; players: string[]; reserve: string[]; taxi: string[] },
  allPlayers: Record<string, SleeperPlayer>
): RosterPlayer[] {
  const result: RosterPlayer[] = []
  const starterSet = new Set(roster.starters || [])
  const reserveSet = new Set(roster.reserve || [])
  const taxiSet = new Set(roster.taxi || [])

  for (const playerId of roster.players || []) {
    const player = allPlayers[playerId]
    if (!player) continue

    let slot: RosterSlot = 'bench'
    if (starterSet.has(playerId)) slot = 'starter'
    else if (reserveSet.has(playerId)) slot = 'ir'
    else if (taxiSet.has(playerId)) slot = 'taxi'

    result.push({
      id: playerId,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      position: player.position || 'Unknown',
      team: player.team,
      slot,
      age: (player as any).age ?? undefined,
    })
  }

  return result
}

function findFreeAgents(
  allPlayers: Record<string, SleeperPlayer>,
  rosteredPlayerIds: Set<string>,
): FreeAgent[] {
  const freeAgents: FreeAgent[] = []
  const relevantPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

  for (const [playerId, player] of Object.entries(allPlayers)) {
    if (rosteredPlayerIds.has(playerId)) continue
    if (!player.position || !relevantPositions.includes(player.position)) continue
    if (!player.team) continue

    freeAgents.push({
      id: playerId,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      position: player.position,
      team: player.team,
      status: player.status,
      age: (player as any).age ?? undefined,
    })
  }

  return freeAgents
    .filter(p => p.status !== 'Inactive' && p.status !== 'Retired')
    .slice(0, 200)
}

function detectNeeds(rosterPlayers: WaiverRosterPlayer[], isSF: boolean): string[] {
  const needs: string[] = []
  const startersByPos: Record<string, number> = {}
  for (const p of rosterPlayers.filter(r => r.slot === 'starter')) {
    startersByPos[p.position] = (startersByPos[p.position] || 0) + 1
  }
  const idealStarters: Record<string, number> = { QB: isSF ? 2 : 1, RB: 2, WR: 2, TE: 1 }
  for (const [pos, ideal] of Object.entries(idealStarters)) {
    if ((startersByPos[pos] || 0) < ideal) needs.push(pos)
  }

  const posValues: Record<string, number[]> = {}
  for (const p of rosterPlayers) {
    if (!['QB', 'RB', 'WR', 'TE'].includes(p.position)) continue
    if (!posValues[p.position]) posValues[p.position] = []
    posValues[p.position].push(p.value)
  }
  for (const [pos, vals] of Object.entries(posValues)) {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length
    if (avg < 2500 && !needs.includes(pos)) needs.push(pos)
  }
  return needs
}

function detectSurplus(rosterPlayers: WaiverRosterPlayer[]): string[] {
  const surplus: string[] = []
  const posValues: Record<string, number[]> = {}
  for (const p of rosterPlayers) {
    if (!['QB', 'RB', 'WR', 'TE'].includes(p.position)) continue
    if (!posValues[p.position]) posValues[p.position] = []
    posValues[p.position].push(p.value)
  }
  for (const [pos, vals] of Object.entries(posValues)) {
    if (vals.length >= 4 && vals.sort((a, b) => b - a)[3] >= 1500) surplus.push(pos)
  }
  return surplus
}

const NARRATIVE_PROMPT = `You are the AllFantasy Waiver AI narrative writer. You receive deterministic waiver analysis results and write concise, insightful narrative text ONLY.

You DO NOT evaluate players or change rankings. The rankings, scores, and recommendations are final. Your job is to:
1. Write a 1-2 sentence summary of the waiver analysis
2. For each suggestion, write a short reasoning paragraph (2-3 sentences) explaining WHY this pickup makes sense
3. Write brief roster notes (weaknesses, observations)

Output JSON:
{
  "summary": string,
  "narratives": { [playerName: string]: string },
  "roster_notes": string[]
}`

export const POST = withApiUsage({ endpoint: "/api/legacy/waiver/analyze", tool: "LegacyWaiverAnalyze" })(async (request: NextRequest) => {
  try {
    const auth = requireAuthOrOrigin(request)
    if (!auth.authenticated) {
      return forbiddenResponse(auth.error || 'Unauthorized')
    }

    const ip = getClientIp(request)
    const body = await request.json()
    const { sleeper_username, league_id, goal: userProvidedGoal, sleeperUser: sleeperUserIdentity } = body

    const resolvedUsername = sleeperUserIdentity?.username || sleeper_username
    const resolvedUserId = sleeperUserIdentity?.userId || undefined

    if (!resolvedUsername || !league_id) {
      return NextResponse.json(
        { error: 'Missing sleeper_username or league_id' },
        { status: 400 }
      )
    }

    const rl = consumeRateLimit({
      scope: 'legacy',
      action: 'waiver_analyze',
      sleeperUsername: resolvedUsername,
      ip,
      maxRequests: 5,
      windowMs: 60_000,
      includeIpInKey: false,
    })

    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterSec: rl.retryAfterSec },
        { status: 429 }
      )
    }

    const sleeperUser = resolvedUserId
      ? { user_id: resolvedUserId, username: resolvedUsername, display_name: resolvedUsername }
      : await getSleeperUser(resolvedUsername)
    if (!sleeperUser) {
      return NextResponse.json({ error: 'Sleeper user not found' }, { status: 404 })
    }

    const leagueInfo = await getLeagueInfo(league_id)
    if (!leagueInfo) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const leagueType = getLeagueType(leagueInfo)

    const [rosters, allPlayers] = await Promise.all([
      getLeagueRosters(league_id),
      getAllPlayers(),
    ])

    const userRoster = rosters.find(r => r.owner_id === sleeperUser.user_id)
    if (!userRoster) {
      return NextResponse.json(
        { error: 'You are not in this league' },
        { status: 400 }
      )
    }

    const rosteredPlayerIds = new Set<string>()
    for (const roster of rosters) {
      for (const playerId of roster.players || []) {
        rosteredPlayerIds.add(playerId)
      }
    }

    const userRosterCategorized = categorizeRoster(userRoster, allPlayers)
    const freeAgents = findFreeAgents(allPlayers, rosteredPlayerIds)
    const scoringType = getScoringType(leagueInfo.scoring_settings)

    const rosterPositions = leagueInfo.roster_positions || []
    const isSF = rosterPositions.some((p: string) => p === 'SUPER_FLEX' || p === 'SF')
    const isTEP = !!(leagueInfo.scoring_settings?.bonus_rec_te)
    const numTeams: number = Number(leagueInfo.settings?.num_teams) || rosters.length
    const isDynasty = leagueType === 'dynasty'

    const leagueAvg = rosters.reduce(
      (sum, r) => sum + ((r.settings?.fpts ?? 0) + (r.settings?.fpts_decimal ?? 0) / 100),
      0
    ) / Math.max(1, rosters.length)
    const userPts = (userRoster.settings?.fpts ?? 0) + (userRoster.settings?.fpts_decimal ?? 0) / 100

    const valCtx: ValuationContext = {
      asOfDate: new Date().toISOString().slice(0, 10),
      isSuperFlex: isSF,
    }

    const topFreeAgents = freeAgents.slice(0, 80)
    const [faValueResults, rosterValueResults] = await Promise.all([
      Promise.all(topFreeAgents.map(fa => pricePlayer(fa.name, valCtx))),
      Promise.all(userRosterCategorized.map(p => pricePlayer(p.name, valCtx))),
    ])

    const waiverCandidates: WaiverCandidate[] = []
    for (let i = 0; i < topFreeAgents.length; i++) {
      const fa = topFreeAgents[i]
      const priced = faValueResults[i]
      if (priced.value >= 200) {
        waiverCandidates.push({
          playerId: fa.id,
          playerName: fa.name,
          position: fa.position,
          team: fa.team,
          age: fa.age ?? null,
          value: priced.value,
          assetValue: priced.assetValue,
          source: priced.source,
        })
      }
    }

    const rosterPlayers: WaiverRosterPlayer[] = userRosterCategorized.map((p, i) => {
      const priced = rosterValueResults[i]
      return {
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        slot: p.slot,
        age: p.age ?? null,
        value: priced.value,
        assetValue: priced.assetValue,
      }
    })

    const needs = detectNeeds(rosterPlayers, isSF)
    const surplus = detectSurplus(rosterPlayers)

    const allLeagueRosterPlayers = rosters.map(r => {
      const categorized = categorizeRoster(r, allPlayers)
      return {
        players: categorized.map((p, idx) => {
          const priced = rosterValueResults[0]
          return {
            id: p.id,
            name: p.name,
            position: p.position,
            team: p.team,
            slot: p.slot,
            age: p.age ?? null,
            value: priced?.value ?? 1000,
          } as WaiverRosterPlayer
        })
      }
    })

    const currentWeek: number = Number(leagueInfo.settings?.leg) || 1
    const teamNeeds = computeTeamNeeds(rosterPlayers, rosterPositions, allLeagueRosterPlayers, currentWeek)

    const goal: UserGoal = userProvidedGoal && ['win-now', 'balanced', 'rebuild'].includes(userProvidedGoal)
      ? userProvidedGoal
      : deriveGoalFromContext(userPts, leagueAvg, isDynasty)

    const scoringCtx: WaiverScoringContext = {
      goal,
      needs,
      surplus,
      isSF,
      isTEP,
      numTeams,
      isDynasty,
      rosterPlayers,
      teamNeeds,
      currentWeek,
    }

    const deterministicResults = scoreWaiverCandidates(waiverCandidates, scoringCtx, { maxResults: 10 })
    console.log(`[WaiverAI] Deterministic engine: ${deterministicResults.length} scored targets for ${resolvedUsername} (goal=${goal})`)

    let narratives: Record<string, string> = {}
    let summary = ''
    let rosterNotes: string[] = []
    try {
      const narrativeInput = deterministicResults.slice(0, 8).map(t => ({
        rank: t.priorityRank,
        name: t.playerName,
        pos: t.position,
        team: t.team,
        recommendation: t.recommendation,
        composite: t.compositeScore,
        dims: t.dimensions,
        topDrivers: t.topDrivers.map(d => ({ id: d.id, label: d.label, score: d.score, direction: d.direction, detail: d.detail })),
        drop: t.dropCandidate?.name || null,
        dropRisk: t.dropCandidate?.riskLabel || null,
        faabBid: t.faabBid,
      }))

      const narrativeUserPrompt = `League: ${leagueInfo.name} | ${scoringType} | ${numTeams} teams | ${isSF ? 'Superflex' : '1QB'} | ${isTEP ? 'TEP' : 'Standard TE'}
Team Goal: ${goal.toUpperCase()}
Biggest Need: ${teamNeeds.biggestNeed ? `${teamNeeds.biggestNeed.slot} (${teamNeeds.biggestNeed.position}, +${teamNeeds.biggestNeed.gapPpg} PPG gap)` : 'None identified'}
Needs: ${needs.join(', ') || 'None'}
Surplus: ${surplus.join(', ') || 'None'}
Bye Week Clusters: ${teamNeeds.byeWeekClusters.map(c => `Wk${c.week} (${c.severity}: ${c.playersOut.join(', ')})`).join('; ') || 'None'}

DETERMINISTIC WAIVER RESULTS (do NOT change rankings or scores):
${JSON.stringify(narrativeInput, null, 2)}

Write narrative summary, per-player reasoning, and roster notes.`

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.5,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: NARRATIVE_PROMPT },
          { role: 'user', content: narrativeUserPrompt },
        ],
      })

      const content = completion.choices[0]?.message?.content
      if (content) {
        const parsed = JSON.parse(content)
        summary = parsed.summary || ''
        narratives = parsed.narratives || {}
        rosterNotes = parsed.roster_notes || []
      }
    } catch (e) {
      console.error('GPT narrative generation failed (using deterministic fallback):', e)
      summary = `Found ${deterministicResults.length} waiver targets. Your team goal is ${goal}.`
      rosterNotes = needs.length > 0 ? [`Your roster has needs at: ${needs.join(', ')}`] : ['Roster is well-balanced']
    }

    const analysis = {
      league_name: leagueInfo.name,
      league_id,
      league_context: {
        scoring_format: scoringType,
        is_superflex: isSF,
        is_tep: isTEP,
        tep_bonus: leagueInfo.scoring_settings?.bonus_rec_te ?? null,
        team_count: numTeams,
        roster_positions: rosterPositions.filter((p: string) => p !== 'BN'),
        league_type: leagueType,
      },
      team_goal: goal,
      biggest_need: teamNeeds.biggestNeed ? {
        slot: teamNeeds.biggestNeed.slot,
        position: teamNeeds.biggestNeed.position,
        current_player: teamNeeds.biggestNeed.currentPlayer,
        gap_ppg: teamNeeds.biggestNeed.gapPpg,
      } : null,
      weakest_slots: teamNeeds.weakestSlots.slice(0, 3).map(s => ({
        slot: s.slot,
        position: s.position,
        current_player: s.currentPlayer,
        gap_ppg: s.gapPpg,
      })),
      bye_week_alerts: teamNeeds.byeWeekClusters.slice(0, 3).map(c => ({
        week: c.week,
        players_out: c.playersOut,
        positions_affected: c.positionsAffected,
        severity: c.severity,
      })),
      positional_depth: teamNeeds.positionalDepth.map(d => ({
        position: d.position,
        count: d.count,
        league_median: d.leagueMedianCount,
        depth_rating: d.depthRating,
      })),
      summary,
      one_move: deterministicResults.length > 0 ? {
        player_name: deterministicResults[0].playerName,
        player_id: deterministicResults[0].playerId,
        position: deterministicResults[0].position,
        team: deterministicResults[0].team,
        composite_score: deterministicResults[0].compositeScore,
        recommendation: deterministicResults[0].recommendation,
        faab_bid: deterministicResults[0].faabBid,
        top_drivers: deterministicResults[0].topDrivers,
        drop_candidate: deterministicResults[0].dropCandidate,
        reasoning: narratives[deterministicResults[0].playerName] || deterministicResults[0].topDrivers.filter(d => d.direction === 'positive').map(d => d.detail).join('. '),
      } : null,
      suggestions: deterministicResults.map((t) => ({
        player_name: t.playerName,
        player_id: t.playerId,
        position: t.position,
        team: t.team,
        age: t.age,
        tier: t.recommendation,
        priority: t.priorityRank,
        composite_score: t.compositeScore,
        dimension_scores: t.dimensions,
        top_drivers: t.topDrivers,
        all_drivers: t.drivers,
        faab_bid: t.faabBid,
        reasoning: narratives[t.playerName] || t.topDrivers.filter(d => d.direction === 'positive').map(d => d.detail).join('. ') || 'Deterministic analysis recommends this pickup.',
        drop_candidate: t.dropCandidate?.name || null,
        drop_reasoning: t.dropCandidate?.reason || null,
        drop_risk_of_regret: t.dropCandidate?.riskOfRegret ?? null,
        drop_risk_label: t.dropCandidate?.riskLabel ?? null,
        value: t.value,
      })),
      roster_notes: rosterNotes,
    }

    trackLegacyToolUsage('waiver_ai', null, null, { sleeperUsername: resolvedUsername, sleeperUserId: resolvedUserId, leagueId: league_id })

    const learningContext = await getComprehensiveLearningContext().catch(() => null)
    const hitRate = await getHistoricalHitRate(resolvedUsername, 'waiver', league_id).catch(() => null)

    const crResult = computeConfidenceRisk({
      category: 'waiver',
      userId: resolvedUserId || resolvedUsername,
      leagueId: league_id,
      dataCompleteness: {
        hasHistoricalData: !!learningContext,
        dataPointCount: deterministicResults.length * 10,
        playerCoverage: 0.8,
        isCommonScenario: true,
      },
      waiverContext: {
        teamStatus: goal.toUpperCase(),
        suggestionCount: deterministicResults.length,
        freeAgentPoolSize: freeAgents.length,
      },
      historicalHitRate: hitRate,
    })

    if (deterministicResults.length > 0) {
      autoLogDecision({
        userId: resolvedUserId || resolvedUsername,
        leagueId: league_id,
        decisionType: 'waiver',
        aiRecommendation: {
          summary: `Waiver: ${deterministicResults.length} suggestions (${goal} team)`,
          teamGoal: goal,
          topPick: deterministicResults[0]?.playerName,
          topTier: deterministicResults[0]?.recommendation,
          suggestionCount: deterministicResults.length,
        },
        confidenceScore: crResult.confidenceScore01,
        riskProfile: crResult.riskProfile,
        contextSnapshot: { leagueId: league_id, leagueType, scoringType, goal },
        confidenceRisk: crResult,
      })
    }

    return NextResponse.json({
      ok: true,
      analysis,
      confidenceRisk: {
        confidence: crResult.numericConfidence,
        level: crResult.confidenceLevel,
        volatility: crResult.volatilityLevel,
        riskProfile: crResult.riskProfile,
        riskTags: crResult.riskTags,
        explanation: crResult.explanation,
      },
      league: {
        name: leagueInfo.name,
        id: league_id,
        sport: leagueInfo.sport,
        type: leagueType,
        scoring: scoringType,
      },
      roster_count: userRosterCategorized.length,
      free_agent_count: freeAgents.length,
      remaining: rl.remaining,
    })
  } catch (error: any) {
    console.error('Waiver analyze error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
})
