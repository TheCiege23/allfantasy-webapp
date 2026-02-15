import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { lookupBySleeperIds, lookupByNames } from '@/lib/unified-player-service'
import { normalizeTeamAbbrev } from '@/lib/team-abbrev'

const SLEEPER_HEADSHOT_BASE = 'https://sleepercdn.com/content/nfl/players/thumb'
const ESPN_LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500'

const ESPN_TEAM_MAP: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BUF: 'buf',
  CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gb',
  HOU: 'hou', IND: 'ind', JAX: 'jax', KC: 'kc',
  LAC: 'lac', LAR: 'lar', LV: 'lv', MIA: 'mia',
  MIN: 'min', NE: 'ne', NO: 'no', NYG: 'nyg',
  NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea',
  SF: 'sf', TB: 'tb', TEN: 'ten', WAS: 'was',
}

function getTeamLogoUrl(teamAbbrev: string | null): string {
  if (!teamAbbrev) return ''
  const normalized = normalizeTeamAbbrev(teamAbbrev)
  if (!normalized) return ''
  const key = ESPN_TEAM_MAP[normalized]
  return key ? `${ESPN_LOGO_BASE}/${key}.png` : ''
}

function getPlayerHeadshotUrl(sleeperId: string): string {
  return `${SLEEPER_HEADSHOT_BASE}/${sleeperId}.jpg`
}

export const POST = withApiUsage({ endpoint: "/api/legacy/player-enrichment", tool: "LegacyPlayerEnrichment" })(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { playerIds, playerNames } = body as {
      playerIds?: string[]
      playerNames?: Array<{ name: string; position?: string; team?: string }>
    }

    if (playerIds && Array.isArray(playerIds) && playerIds.length > 0) {
      if (playerIds.length > 200) {
        return NextResponse.json({ error: 'Maximum 200 players per request' }, { status: 400 })
      }

      const unified = await lookupBySleeperIds(playerIds)

      const enriched: Record<string, {
        sleeperId: string
        canonicalName: string
        position: string | null
        team: string | null
        headshotUrl: string
        teamLogoUrl: string
        canonicalId: string | null
      }> = {}

      for (const sleeperId of playerIds) {
        const player = unified.get(sleeperId)
        enriched[sleeperId] = {
          sleeperId,
          canonicalName: player?.canonicalName || '',
          position: player?.position || null,
          team: player?.currentTeam || null,
          headshotUrl: getPlayerHeadshotUrl(sleeperId),
          teamLogoUrl: player?.currentTeam ? getTeamLogoUrl(player.currentTeam) : '',
          canonicalId: player?.canonicalId || null,
        }
      }

      return NextResponse.json({ success: true, players: enriched })
    }

    if (playerNames && Array.isArray(playerNames) && playerNames.length > 0) {
      if (playerNames.length > 200) {
        return NextResponse.json({ error: 'Maximum 200 players per request' }, { status: 400 })
      }

      const unified = await lookupByNames(playerNames)

      const enriched: Record<string, {
        canonicalName: string
        position: string | null
        team: string | null
        headshotUrl: string
        teamLogoUrl: string
        canonicalId: string | null
        sleeperId: string | null
      }> = {}

      for (const input of playerNames) {
        const player = unified.get(input.name)
        enriched[input.name] = {
          canonicalName: player?.canonicalName || input.name,
          position: player?.position || input.position || null,
          team: player?.currentTeam || input.team || null,
          headshotUrl: player?.sleeperId ? getPlayerHeadshotUrl(player.sleeperId) : '',
          teamLogoUrl: getTeamLogoUrl(player?.currentTeam || input.team || null),
          canonicalId: player?.canonicalId || null,
          sleeperId: player?.sleeperId || null,
        }
      }

      return NextResponse.json({ success: true, players: enriched })
    }

    return NextResponse.json({ error: 'playerIds or playerNames required' }, { status: 400 })
  } catch (error) {
    console.error('[PlayerEnrichment] Error:', error)
    return NextResponse.json(
      { error: 'Failed to enrich players', details: String(error) },
      { status: 500 }
    )
  }
})

export const GET = withApiUsage({ endpoint: "/api/legacy/player-enrichment", tool: "LegacyPlayerEnrichment" })(async (request: NextRequest) => {
  const teamAbbrev = request.nextUrl.searchParams.get('team')

  if (teamAbbrev) {
    const normalized = normalizeTeamAbbrev(teamAbbrev)
    return NextResponse.json({
      team: normalized,
      logoUrl: getTeamLogoUrl(normalized),
    })
  }

  const allLogos: Record<string, string> = {}
  for (const [abbrev] of Object.entries(ESPN_TEAM_MAP)) {
    allLogos[abbrev] = getTeamLogoUrl(abbrev)
  }

  return NextResponse.json({
    success: true,
    headshotUrlPattern: `${SLEEPER_HEADSHOT_BASE}/{sleeper_id}.jpg`,
    teamLogos: allLogos,
  })
})
