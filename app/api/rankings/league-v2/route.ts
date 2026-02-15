import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { computeLeagueRankingsV2 } from '@/lib/rankings-engine/league-rankings-v2'
import { openaiChatText } from '@/lib/openai-client'

export const GET = withApiUsage({ endpoint: "/api/rankings/league-v2", tool: "RankingsLeagueV2" })(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const leagueId = searchParams.get('leagueId')
  const weekParam = searchParams.get('week')

  if (!leagueId) {
    return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
  }

  const week = weekParam ? parseInt(weekParam, 10) : undefined

  try {
    const rankings = await computeLeagueRankingsV2(leagueId, week)
    if (!rankings) {
      return NextResponse.json({ error: 'League not found or no data' }, { status: 404 })
    }

    return NextResponse.json(rankings)
  } catch (err: any) {
    console.error('[League Rankings V2] Error:', err?.message || err, err?.stack?.slice(0, 500))
    return NextResponse.json(
      { error: 'Failed to compute league rankings', detail: err?.message || String(err) },
      { status: 500 },
    )
  }
})

export const POST = withApiUsage({ endpoint: "/api/rankings/league-v2", tool: "RankingsLeagueV2" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { team, leagueContext } = body

    if (!team || !leagueContext) {
      return NextResponse.json({ error: 'team and leagueContext required' }, { status: 400 })
    }

    const explanationDrivers = team.explanation?.drivers || []
    const driversText = explanationDrivers
      .map((d: any) => {
        const label = d.id?.replace(/_/g, ' ') || 'unknown'
        const polarity = d.polarity === 'UP' ? '+' : d.polarity === 'DOWN' ? '-' : '~'
        const evidenceStr = d.evidence ? Object.entries(d.evidence).map(([k, v]) => `${k}=${v}`).join(', ') : ''
        return `- [${polarity}] ${label} (impact ${Math.round((d.impact || 0) * 100)}%)${evidenceStr ? `: ${evidenceStr}` : ''}`
      })
      .join('\n')

    const prompt = `You are an AI fantasy sports coach. Given the structured data below, write a brief motivational analysis (3 bullets + 1 challenge). Be honest, cite the specific scores, never invent stats. Highlight strengths first, then one improvement opportunity. Never say "you suck" — instead say "here's the lever."

Team: ${team.displayName || team.username} (Rank #${team.rank})
Record: ${team.record.wins}-${team.record.losses}${team.record.ties > 0 ? `-${team.record.ties}` : ''}
Rank Movement: ${team.rankDelta !== null ? (team.rankDelta > 0 ? `Up ${team.rankDelta}` : team.rankDelta < 0 ? `Down ${Math.abs(team.rankDelta)}` : 'No change') : 'First week'}
Composite Score: ${team.composite}/100

Scores:
- Power Score: ${team.powerScore}/100
- Win Score: ${team.winScore}/100
- Luck Score: ${team.luckScore}/100
- Market Value: ${team.marketValueScore}/100
- Manager Skill: ${team.managerSkillScore}/100

Expected Wins: ${team.expectedWins?.toFixed(1)} (Actual: ${team.record.wins})
Streak: ${team.streak > 0 ? `${team.streak}W` : team.streak < 0 ? `${Math.abs(team.streak)}L` : 'None'}

Key Drivers:
${driversText || 'None identified'}

League Context:
- Dynasty: ${leagueContext.isDynasty ? 'Yes' : 'No'}
- Superflex: ${leagueContext.isSuperFlex ? 'Yes' : 'No'}
- Week: ${leagueContext.week}
- Phase: ${leagueContext.phase}

Format your response as JSON with this exact structure:
{
  "bullets": ["string", "string", "string"],
  "challenge": "string",
  "tone": "motivational" | "cautious" | "celebration"
}`

    const result = await openaiChatText({
      messages: [
        { role: 'system', content: 'You are AllFantasy AI Coach. Respond with valid JSON only. No markdown, no code blocks.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 400,
    })

    if (!result.ok) {
      return NextResponse.json({
        bullets: [
          `Ranked #${team.rank} with a composite score of ${team.composite}/100.`,
          `Power Score ${team.powerScore} | Win Score ${team.winScore} | Luck ${team.luckScore}.`,
          team.expectedWins > team.record.wins
            ? `You're ${(team.expectedWins - team.record.wins).toFixed(1)} expected wins better than your record shows — keep pushing.`
            : `Your record matches your performance — stay consistent.`,
        ],
        challenge: 'Focus on improving your weakest scoring dimension this week.',
        tone: 'motivational',
      })
    }

    try {
      const cleaned = result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({
        bullets: parsed.bullets || [],
        challenge: parsed.challenge || '',
        tone: parsed.tone || 'motivational',
      })
    } catch {
      return NextResponse.json({
        bullets: [result.text.slice(0, 200)],
        challenge: '',
        tone: 'motivational',
      })
    }
  } catch (err: any) {
    console.error('[AI Coach] Error:', err?.message || err)
    return NextResponse.json(
      { error: 'AI Coach failed' },
      { status: 500 },
    )
  }
})
