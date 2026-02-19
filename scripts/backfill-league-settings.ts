import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fetchSleeperData(url: string) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

async function main() {
  const leagues = await prisma.league.findMany({
    where: { platform: 'sleeper', platformLeagueId: { not: '' } },
    include: { teams: true, rosters: true },
  })

  console.log(`Found ${leagues.length} Sleeper leagues to backfill`)

  for (const league of leagues) {
    const sleeperLeagueId = league.platformLeagueId
    console.log(`\nProcessing: ${league.name} (${sleeperLeagueId})`)

    const [sleeperLeague, users, rosters] = await Promise.all([
      fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}`),
      fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/users`),
      fetchSleeperData(`https://api.sleeper.app/v1/league/${sleeperLeagueId}/rosters`),
    ])

    if (!sleeperLeague) {
      console.log(`  Skipping - league not found on Sleeper`)
      continue
    }

    const leagueSettings = {
      ...sleeperLeague,
      scoring_settings: sleeperLeague.scoring_settings || {},
      roster_positions: sleeperLeague.roster_positions || [],
      trade_deadline: sleeperLeague.settings?.trade_deadline,
      waiver_type: sleeperLeague.settings?.waiver_type,
      waiver_budget: sleeperLeague.settings?.waiver_budget,
      playoff_teams: sleeperLeague.settings?.playoff_teams,
    }

    await prisma.league.update({
      where: { id: league.id },
      data: {
        starters: sleeperLeague.roster_positions || [],
        settings: leagueSettings,
      },
    })
    console.log(`  Updated league settings & roster positions`)

    if (users && rosters && league.teams.length > 0) {
      const rosterToUser: Record<number, any> = {}
      rosters.forEach((r: any) => {
        const u = users.find((u: any) => u.user_id === r.owner_id)
        if (u) rosterToUser[r.roster_id] = u
      })

      for (const team of league.teams) {
        const rosterId = parseInt(team.externalId)
        const user = rosterToUser[rosterId]
        if (user) {
          const teamName = user.metadata?.team_name?.trim() || user.display_name || user.username || team.teamName
          await prisma.leagueTeam.update({
            where: { id: team.id },
            data: { teamName },
          })
        }
      }
      console.log(`  Updated ${league.teams.length} team names`)
    }

    let cachedPlayers: Record<string, any> = {}
    try {
      const res = await fetch('https://api.sleeper.app/v1/players/nfl')
      if (res.ok) cachedPlayers = await res.json()
    } catch {}

    if (rosters && league.rosters.length > 0) {
      for (const roster of rosters) {
        const ownerId = roster.owner_id || `unowned_${roster.roster_id}`
        const playerList = (roster.players || []).map((pid: string) => {
          const sp = cachedPlayers[pid]
          return {
            playerId: pid,
            name: sp?.full_name || `${sp?.first_name || ''} ${sp?.last_name || ''}`.trim() || pid,
            position: sp?.position || '',
            team: sp?.team || '',
            age: sp?.age || null,
            yearsExp: sp?.years_exp || null,
            college: sp?.college || null,
            status: sp?.status || null,
            isStarter: roster.starters?.includes(pid) || false,
            isReserve: roster.reserve?.includes(pid) || false,
            isTaxi: roster.taxi?.includes(pid) || false,
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
      }
      console.log(`  Updated ${rosters.length} rosters with enriched player data`)
    }
  }

  console.log('\nBackfill complete!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
