import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

async function getMFLConnection() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('mfl_session')?.value
  if (!sessionId) return null
  
  return prisma.mFLConnection.findUnique({
    where: { sessionId }
  })
}

export const GET = withApiUsage({ endpoint: "/api/mfl/leagues", tool: "MflLeagues" })(async (req: NextRequest) => {
  try {
    const connection = await getMFLConnection()
    
    if (!connection) {
      return NextResponse.json({ connected: false }, { status: 401 })
    }

    const year = connection.year || new Date().getFullYear()
    
    const leaguesUrl = `https://api.myfantasyleague.com/${year}/export?TYPE=myleagues&JSON=1`
    const res = await fetch(leaguesUrl, {
      headers: {
        'Cookie': `MFL_USER_ID=${connection.mflCookie}`
      }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 })
    }

    const data = await res.json()
    
    let leagues: any[] = []
    if (data.leagues?.league) {
      const rawLeagues = Array.isArray(data.leagues.league) 
        ? data.leagues.league 
        : [data.leagues.league]
      
      leagues = rawLeagues.map((lg: any) => ({
        leagueId: lg.league_id,
        name: lg.name,
        url: lg.url,
        franchiseId: lg.franchise_id,
        franchiseName: lg.franchise_name
      }))
    }

    return NextResponse.json({
      connected: true,
      username: connection.mflUsername,
      year,
      leagues
    })

  } catch (error: any) {
    console.error('MFL leagues error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leagues' },
      { status: 500 }
    )
  }
})
