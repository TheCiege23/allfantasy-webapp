import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { getAllPlayers } from '@/lib/sleeper-client'

export const POST = withApiUsage({ endpoint: "/api/legacy/player-profile", tool: "LegacyPlayerProfile" })(async (req: NextRequest) => {
  try {
    const { player_name, player_id } = await req.json()
    
    if (!player_name && !player_id) {
      return NextResponse.json({ error: 'Player name or ID required' }, { status: 400 })
    }

    const allPlayers = await getAllPlayers()
    
    let player: any = null
    let sleeperId = player_id || null
    
    if (player_id && allPlayers[player_id]) {
      player = allPlayers[player_id]
      sleeperId = player_id
    } else if (player_name) {
      const searchName = player_name.toLowerCase().trim()
      for (const [pid, p] of Object.entries(allPlayers)) {
        const fullName = ((p as any).full_name || `${(p as any).first_name} ${(p as any).last_name}`).toLowerCase().trim()
        if (fullName === searchName) {
          player = p
          sleeperId = pid
          break
        }
      }
    }
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    const bio = {
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      firstName: player.first_name,
      lastName: player.last_name,
      position: player.position || 'Unknown',
      team: player.team || null,
      age: player.age || null,
      yearsExp: player.years_exp || null,
      college: player.college || null,
      number: player.number || null,
      height: player.height || null,
      weight: player.weight || null,
      status: player.status || null,
      injuryStatus: player.injury_status || null,
      injuryNotes: player.injury_notes || null,
      injuryBodyPart: player.injury_body_part || null,
      depthChartPosition: player.depth_chart_position || null,
      depthChartOrder: player.depth_chart_order || null,
      fantasyPositions: player.fantasy_positions || [],
      searchRank: player.search_rank || null,
      sleeperId,
    }

    let news: any[] = []
    try {
      const { prisma } = await import('@/lib/prisma')
      const playerNews = await prisma.sportsNews.findMany({
        where: {
          OR: [
            { title: { contains: player.last_name, mode: 'insensitive' } },
            { playerName: { contains: `${player.first_name} ${player.last_name}`, mode: 'insensitive' } },
            { content: { contains: `${player.first_name} ${player.last_name}`, mode: 'insensitive' } },
          ]
        },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          content: true,
          source: true,
          publishedAt: true,
          sourceUrl: true,
        }
      })
      news = playerNews.map(n => ({
        id: n.id,
        title: n.title,
        description: n.content,
        source: n.source,
        publishedAt: n.publishedAt,
        url: n.sourceUrl,
      }))
    } catch (e) {
      console.error('Failed to fetch player news:', e)
    }

    return NextResponse.json({
      ok: true,
      bio,
      news,
    })
  } catch (error: any) {
    console.error('Player profile error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch player profile' }, { status: 500 })
  }
})
