import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import LegacyHubClient from '@/components/legacy/LegacyHubClient'

export default async function LegacyHubPage({ searchParams }: {
  searchParams: { tab?: string }
}) {
  const session = await getServerSession(authOptions) as { user?: { id?: string; email?: string | null; name?: string | null } } | null

  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent('/af-legacy')}`)
  }

  const userLeagues = await prisma.league.findMany({
    where: { userId: session.user.id },
    include: {
      teams: {
        orderBy: [
          { aiPowerScore: { sort: 'desc', nulls: 'last' } },
          { pointsFor: 'desc' },
        ],
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const serializedLeagues = userLeagues.map((league) => ({
    id: league.id,
    name: league.name,
    platform: league.platform,
    platformLeagueId: league.platformLeagueId,
    season: league.season,
    leagueSize: league.leagueSize,
    scoring: league.scoring,
    isDynasty: league.isDynasty,
    teamCount: league.teams.length,
    teams: league.teams.map((t) => ({
      id: t.id,
      teamName: t.teamName,
      ownerName: t.ownerName,
      wins: t.wins,
      losses: t.losses,
      pointsFor: t.pointsFor,
    })),
  }))

  const defaultTab = searchParams.tab || (serializedLeagues.length > 0 ? 'overview' : 'transfer')

  return <LegacyHubClient userId={session.user.id} leagues={serializedLeagues} defaultTab={defaultTab} />
}
