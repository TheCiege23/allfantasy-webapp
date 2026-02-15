import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseFantraxFiles } from '@/lib/fantrax-parser'

export const POST = withApiUsage({ endpoint: "/api/legacy/fantrax", tool: "LegacyFantrax" })(async (request: NextRequest) => {
  try {
    const formData = await request.formData()
    const username = formData.get('username') as string
    const season = parseInt(formData.get('season') as string) || new Date().getFullYear()
    const sport = (formData.get('sport') as string) || 'cfb'
    const leagueName = formData.get('leagueName') as string | null
    const isDevy = formData.get('isDevy') === 'true'
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }
    
    const files: { name: string; content: string }[] = []
    
    const entries = Array.from(formData.entries())
    for (const entry of entries) {
      const [key, value] = entry
      if (key.startsWith('file_') && value instanceof Blob) {
        const content = await value.text()
        const fileName = (value as File).name || key
        files.push({ name: fileName, content })
      }
    }
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No CSV files provided' }, { status: 400 })
    }
    
    const result = parseFantraxFiles(files, username, {
      leagueName: leagueName || undefined,
      isDevy,
      sport
    })
    
    if (!result.success && result.errors.length > 0) {
      return NextResponse.json({ 
        error: 'Failed to parse CSV files',
        details: result.errors 
      }, { status: 400 })
    }
    
    let user = await prisma.fantraxUser.findUnique({
      where: { fantraxUsername: username }
    })
    
    if (!user) {
      user = await prisma.fantraxUser.create({
        data: {
          fantraxUsername: username,
          displayName: username
        }
      })
    }
    
    const league = await prisma.fantraxLeague.upsert({
      where: {
        userId_leagueName_season: {
          userId: user.id,
          leagueName: result.leagueName,
          season: season
        }
      },
      update: {
        sport,
        teamCount: result.teamCount,
        userTeam: result.userTeam,
        isChampion: result.userStats.isChampion,
        champion: result.champion,
        isDevy,
        wins: result.userStats.record.wins,
        losses: result.userStats.record.losses,
        ties: result.userStats.record.ties,
        pointsFor: result.userStats.pointsFor,
        pointsAgainst: result.userStats.pointsAgainst,
        finalRank: result.userStats.rank,
        playoffFinish: result.userStats.playoffFinish,
        standings: result.standings as unknown as object,
        matchups: result.matchups as unknown as object,
        roster: result.roster as unknown as object,
        transactions: result.transactions as unknown as object,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        leagueName: result.leagueName,
        season,
        sport,
        teamCount: result.teamCount,
        userTeam: result.userTeam,
        isChampion: result.userStats.isChampion,
        champion: result.champion,
        isDevy,
        wins: result.userStats.record.wins,
        losses: result.userStats.record.losses,
        ties: result.userStats.record.ties,
        pointsFor: result.userStats.pointsFor,
        pointsAgainst: result.userStats.pointsAgainst,
        finalRank: result.userStats.rank,
        playoffFinish: result.userStats.playoffFinish,
        standings: result.standings as unknown as object,
        matchups: result.matchups as unknown as object,
        roster: result.roster as unknown as object,
        transactions: result.transactions as unknown as object
      }
    })
    
    const transactionSummary = result.transactions ? {
      claims: result.transactions.claims.length,
      drops: result.transactions.drops.length,
      trades: result.transactions.trades.length,
      lineupChanges: result.transactions.lineupChanges.length,
      userTransactions: result.transactions.userTransactions.length
    } : null

    return NextResponse.json({
      success: true,
      league: {
        id: league.id,
        name: league.leagueName,
        season: league.season,
        sport: league.sport,
        teamCount: league.teamCount,
        userTeam: league.userTeam,
        isDevy: league.isDevy,
        record: `${league.wins}-${league.losses}${league.ties > 0 ? `-${league.ties}` : ''}`,
        pointsFor: league.pointsFor,
        pointsAgainst: league.pointsAgainst,
        rank: league.finalRank,
        playoffFinish: league.playoffFinish,
        isChampion: league.isChampion,
        champion: league.champion,
        rosterCount: result.roster.length,
        matchupCount: result.matchups.length,
        transactions: transactionSummary
      },
      errors: result.errors
    })
    
  } catch (error) {
    console.error('Fantrax import error:', error)
    return NextResponse.json({ 
      error: 'Failed to import Fantrax data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})

export const GET = withApiUsage({ endpoint: "/api/legacy/fantrax", tool: "LegacyFantrax" })(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }
    
    const user = await prisma.fantraxUser.findUnique({
      where: { fantraxUsername: username },
      include: {
        leagues: {
          orderBy: { season: 'desc' }
        }
      }
    })
    
    if (!user) {
      return NextResponse.json({ leagues: [] })
    }
    
    const leagues = user.leagues.map((league: typeof user.leagues[number]) => ({
      id: league.id,
      name: league.leagueName,
      season: league.season,
      sport: league.sport,
      teamCount: league.teamCount,
      userTeam: league.userTeam,
      isDevy: league.isDevy,
      record: `${league.wins}-${league.losses}${league.ties > 0 ? `-${league.ties}` : ''}`,
      pointsFor: league.pointsFor,
      pointsAgainst: league.pointsAgainst,
      rank: league.finalRank,
      playoffFinish: league.playoffFinish,
      isChampion: league.isChampion,
      champion: league.champion,
      roster: league.roster,
      matchups: league.matchups,
      standings: league.standings,
      transactions: league.transactions
    }))
    
    return NextResponse.json({ leagues })
    
  } catch (error) {
    console.error('Fantrax fetch error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch Fantrax data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
})
