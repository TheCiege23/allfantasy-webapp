import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import LeagueOverviewClient from './LeagueOverviewClient'

export default async function LeagueDetailPage({ params, searchParams }: {
  params: { leagueId: string }
  searchParams: { welcome?: string }
}) {
  const session = await getServerSession(authOptions) as { user?: { id?: string } } | null
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(`/leagues/${params.leagueId}`)}`)
  }

  const league = await prisma.league.findUnique({
    where: { id: params.leagueId },
    include: {
      teams: {
        orderBy: [
          { aiPowerScore: { sort: 'desc', nulls: 'last' } },
          { pointsFor: 'desc' },
        ],
      },
      managers: true,
    },
  })

  if (!league) {
    redirect('/af-legacy')
  }

  const serializedLeague = {
    id: league.id,
    name: league.name,
    platform: league.platform,
    platformLeagueId: league.platformLeagueId,
    season: league.season,
    leagueSize: league.leagueSize,
    scoring: league.scoring,
    isDynasty: league.isDynasty,
    teamCount: league.teams.length || league.managers.length,
    managers: league.managers.map(m => ({
      displayName: m.displayName,
      avatar: m.avatar,
      wins: m.wins,
      losses: m.losses,
      ties: m.ties,
    })),
    teams: league.teams.map(t => ({
      id: t.id,
      teamName: t.teamName,
      ownerName: t.ownerName,
      wins: t.wins,
      losses: t.losses,
      pointsFor: t.pointsFor,
    })),
  }

  const isWelcome = searchParams.welcome === 'legacy'

  return <LeagueOverviewClient league={serializedLeague} isWelcome={isWelcome} />
}
