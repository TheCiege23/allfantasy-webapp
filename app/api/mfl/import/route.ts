import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

interface MFLLeague {
  leagueId: string
  name: string
  year: number
  franchiseId: string
  franchiseName: string
  url?: string
}

interface MFLStanding {
  leagueId: string
  leagueName: string
  year: number
  franchiseId: string
  franchiseName: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
}

async function getMFLConnection() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('mfl_session')?.value
  if (!sessionId) return null
  
  return prisma.mFLConnection.findUnique({
    where: { sessionId }
  })
}

async function fetchMFLData(year: number, type: string, leagueId: string | null, mflCookie: string, extraParams: string = '') {
  const baseUrl = `https://api.myfantasyleague.com/${year}/export`
  const params = new URLSearchParams({
    TYPE: type,
    JSON: '1'
  })
  if (leagueId) params.set('L', leagueId)
  
  const url = `${baseUrl}?${params.toString()}${extraParams ? '&' + extraParams : ''}`
  
  const res = await fetch(url, {
    headers: {
      'Cookie': `MFL_USER_ID=${mflCookie}`
    }
  })
  
  if (!res.ok) {
    throw new Error(`MFL API error: ${res.status}`)
  }
  
  return res.json()
}

export const POST = withApiUsage({ endpoint: "/api/mfl/import", tool: "MflImport" })(async (req: NextRequest) => {
  try {
    const connection = await getMFLConnection()
    
    if (!connection) {
      return NextResponse.json({ error: 'Not connected to MFL' }, { status: 401 })
    }

    const { startYear, endYear } = await req.json()
    const currentYear = new Date().getFullYear()
    const start = startYear || currentYear - 5
    const end = endYear || currentYear

    const results: {
      years: number[]
      leagues: MFLLeague[]
      totalRosters: number
      totalTrades: number
      standings: MFLStanding[]
      trades: any[]
    } = {
      years: [],
      leagues: [],
      totalRosters: 0,
      totalTrades: 0,
      standings: [],
      trades: []
    }

    for (let year = start; year <= end; year++) {
      try {
        const leaguesData = await fetchMFLData(year, 'myleagues', null, connection.mflCookie)
        
        if (!leaguesData.leagues?.league) continue
        
        const rawLeagues = Array.isArray(leaguesData.leagues.league) 
          ? leaguesData.leagues.league 
          : [leaguesData.leagues.league]
        
        results.years.push(year)

        for (const lg of rawLeagues) {
          const league: MFLLeague = {
            leagueId: lg.league_id,
            name: lg.name || `League ${lg.league_id}`,
            year,
            franchiseId: lg.franchise_id,
            franchiseName: lg.franchise_name || 'My Team',
            url: lg.url
          }
          results.leagues.push(league)

          try {
            const standingsData = await fetchMFLData(year, 'standings', lg.league_id, connection.mflCookie)
            
            if (standingsData.standings?.franchise) {
              const franchises = Array.isArray(standingsData.standings.franchise)
                ? standingsData.standings.franchise
                : [standingsData.standings.franchise]
              
              for (const f of franchises) {
                if (f.id === lg.franchise_id) {
                  const standing: MFLStanding = {
                    leagueId: lg.league_id,
                    leagueName: lg.name,
                    year,
                    franchiseId: f.id,
                    franchiseName: f.name || `Team ${f.id}`,
                    wins: parseInt(f.h2hw || f.w || '0'),
                    losses: parseInt(f.h2hl || f.l || '0'),
                    ties: parseInt(f.h2ht || f.t || '0'),
                    pointsFor: parseFloat(f.pf || '0'),
                    pointsAgainst: parseFloat(f.pa || '0')
                  }
                  results.standings.push(standing)
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch standings for league ${lg.league_id}:`, e)
          }

          try {
            const rostersData = await fetchMFLData(year, 'rosters', lg.league_id, connection.mflCookie)
            
            if (rostersData.rosters?.franchise) {
              const franchises = Array.isArray(rostersData.rosters.franchise)
                ? rostersData.rosters.franchise
                : [rostersData.rosters.franchise]
              
              const userFranchise = franchises.find((f: any) => f.id === lg.franchise_id)
              if (userFranchise?.player) {
                const players = Array.isArray(userFranchise.player)
                  ? userFranchise.player
                  : [userFranchise.player]
                results.totalRosters += players.length
              }
            }
          } catch (e) {
            console.error(`Failed to fetch rosters for league ${lg.league_id}:`, e)
          }

          try {
            const tradesData = await fetchMFLData(
              year, 
              'transactions', 
              lg.league_id, 
              connection.mflCookie,
              'TRANS_TYPE=TRADE'
            )
            
            if (tradesData.transactions?.transaction) {
              const transactions = Array.isArray(tradesData.transactions.transaction)
                ? tradesData.transactions.transaction
                : [tradesData.transactions.transaction]
              
              const trades = transactions.filter((t: any) => t.type === 'TRADE')
              
              for (const trade of trades) {
                const isUserInvolved = 
                  trade.franchise === lg.franchise_id || 
                  trade.franchise2 === lg.franchise_id

                if (isUserInvolved) {
                  results.totalTrades++
                  results.trades.push({
                    leagueId: lg.league_id,
                    leagueName: lg.name,
                    year,
                    timestamp: trade.timestamp,
                    franchise1: trade.franchise,
                    franchise2: trade.franchise2,
                    franchise1Gave: trade.franchise1_gave,
                    franchise2Gave: trade.franchise2_gave
                  })
                }
              }
            }
          } catch (e) {
            console.error(`Failed to fetch trades for league ${lg.league_id}:`, e)
          }
        }
      } catch (e) {
        console.error(`Failed to fetch leagues for year ${year}:`, e)
      }
    }

    const mflUsername = `mfl_${connection.mflUsername}`
    
    const existingUser = await prisma.legacyUser.findUnique({
      where: { sleeperUsername: mflUsername }
    })

    let totalWins = 0, totalLosses = 0, totalTies = 0, totalPF = 0
    for (const s of results.standings) {
      totalWins += s.wins
      totalLosses += s.losses
      totalTies += s.ties
      totalPF += s.pointsFor
    }
    
    const totalGames = totalWins + totalLosses + totalTies
    const winPct = totalGames > 0 ? (totalWins / totalGames) * 100 : 0

    if (existingUser) {
      await prisma.legacyUser.update({
        where: { id: existingUser.id },
        data: {
          displayName: connection.mflUsername,
          avatar: null,
          updatedAt: new Date()
        }
      })
    } else {
      await prisma.legacyUser.create({
        data: {
          sleeperUsername: mflUsername,
          sleeperUserId: mflUsername,
          displayName: connection.mflUsername
        }
      })
    }

    return NextResponse.json({
      success: true,
      username: connection.mflUsername,
      yearsImported: results.years,
      leaguesFound: results.leagues.length,
      leagues: results.leagues,
      rostersImported: results.totalRosters,
      tradesImported: results.totalTrades,
      trades: results.trades,
      standings: results.standings,
      record: {
        wins: totalWins,
        losses: totalLosses,
        ties: totalTies,
        winPercentage: winPct.toFixed(1),
        pointsFor: totalPF.toFixed(1)
      }
    })

  } catch (error: any) {
    console.error('MFL full import error:', error)
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
})
