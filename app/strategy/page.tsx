import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import StrategyPlanner from '@/components/StrategyPlanner'

export default async function StrategyPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login?next=/strategy')
  }

  const appUser = await prisma.appUser.findUnique({
    where: { id: session.user.id },
    include: { legacyUser: true },
  })

  const leagues = await prisma.league.findMany({
    where: { userId: session.user.id, platform: 'sleeper' },
    orderBy: { updatedAt: 'desc' },
    select: {
      platformLeagueId: true,
      name: true,
      season: true,
      isDynasty: true,
      leagueSize: true,
    },
  })

  const options = leagues.map((league) => ({
    league_id: league.platformLeagueId,
    name: league.name || league.platformLeagueId,
    season: league.season || new Date().getFullYear(),
    type: league.isDynasty ? 'dynasty' : 'redraft',
    team_count: league.leagueSize || 0,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-6 md:p-10">
      {options.length === 0 ? (
        <div className="text-center text-gray-300 mt-24">
          <h1 className="text-3xl font-bold mb-3">Season Strategy</h1>
          <p>No synced Sleeper leagues found.</p>
        </div>
      ) : (
        <StrategyPlanner leagues={options} sleeperUsername={appUser?.legacyUser?.sleeperUsername || ''} />
      )}
    </div>
  )
}
