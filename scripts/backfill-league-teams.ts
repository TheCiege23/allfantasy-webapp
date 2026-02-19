import { prisma } from '../lib/prisma'

async function fetchSleeperData(url: string) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

async function backfill() {
  const leagues = await prisma.league.findMany({
    where: { platform: 'sleeper' },
    include: { teams: true, rosters: true },
  })

  console.log(`Found ${leagues.length} leagues to backfill`)

  for (const league of leagues) {
    const sleeperLeagueId = league.platformLeagueId
    console.log(`\nProcessing: ${league.name} (${sleeperLeagueId})`)

    if (league.teams.length > 0 && league.rosters.length > 0) {
      console.log(`  Already has ${league.teams.length} teams and ${league.rosters.length} rosters, skipping`)
      continue
    }

    const [usersData, rostersData, allPlayers] = await Promise.all([
      fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/users`),
      fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/rosters`),
      fetchSleeperData(`https://api.sleeper.app/v1/players/nfl`),
    ])

    if (!rostersData) {
      console.log(`  Failed to fetch rosters, skipping`)
      continue
    }

    const rosterToUser: Record<number, any> = {}
    if (rostersData && usersData) {
      rostersData.forEach((roster: any) => {
        const user = usersData.find((u: any) => u.user_id === roster.owner_id)
        if (user) rosterToUser[roster.roster_id] = user
      })
    }

    let matchups: { week: number; matchups: any[] }[] = []
    for (let week = 1; week <= 18; week++) {
      const weekMatchups = await fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/matchups/${week}`)
      if (weekMatchups && weekMatchups.length > 0) {
        matchups.push({ week, matchups: weekMatchups })
      }
    }

    const seasonNum = league.season || new Date().getFullYear()

    let teamsCreated = 0
    let rostersCreated = 0
    let perfCreated = 0

    for (const roster of rostersData) {
      const user = rosterToUser[roster.roster_id]
      const displayName = user?.display_name || user?.username || `Team ${roster.roster_id}`
      const avatar = user?.avatar ? `https://sleepercdn.com/avatars/thumbs/${user.avatar}` : null
      const fpts = ((roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100)
      const ownerId = roster.owner_id || `unowned_${roster.roster_id}`

      const team = await prisma.leagueTeam.upsert({
        where: {
          leagueId_externalId: {
            leagueId: league.id,
            externalId: String(roster.roster_id),
          },
        },
        update: {
          ownerName: displayName,
          teamName: displayName,
          avatarUrl: avatar,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          pointsFor: fpts,
        },
        create: {
          leagueId: league.id,
          externalId: String(roster.roster_id),
          ownerName: displayName,
          teamName: displayName,
          avatarUrl: avatar,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          pointsFor: fpts,
        },
      })
      teamsCreated++

      const playerList = (roster.players || []).map((pid: string) => {
        const sp = allPlayers?.[pid]
        return {
          playerId: pid,
          name: sp ? (sp.full_name || `${sp.first_name || ''} ${sp.last_name || ''}`.trim()) : pid,
          position: sp?.position || '',
          team: sp?.team || '',
          isStarter: roster.starters?.includes(pid) || false,
          age: sp?.age || null,
        }
      })

      await prisma.roster.upsert({
        where: {
          leagueId_platformUserId: {
            leagueId: league.id,
            platformUserId: ownerId,
          },
        },
        update: { playerData: playerList },
        create: {
          leagueId: league.id,
          platformUserId: ownerId,
          playerData: playerList,
        },
      })
      rostersCreated++

      for (const matchupWeek of matchups) {
        const mgrMatchup = matchupWeek.matchups.find((m: any) => m.roster_id === roster.roster_id)
        if (mgrMatchup && mgrMatchup.points > 0) {
          await prisma.teamPerformance.upsert({
            where: {
              teamId_season_week: {
                teamId: team.id,
                season: seasonNum,
                week: matchupWeek.week,
              },
            },
            update: { points: mgrMatchup.points },
            create: {
              teamId: team.id,
              season: seasonNum,
              week: matchupWeek.week,
              points: mgrMatchup.points,
            },
          })
          perfCreated++
        }
      }
    }

    console.log(`  Created ${teamsCreated} teams, ${rostersCreated} rosters, ${perfCreated} performances`)
  }

  console.log('\nBackfill complete!')
}

backfill()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
