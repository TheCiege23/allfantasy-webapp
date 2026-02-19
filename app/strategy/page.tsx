import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import StrategyPlanner from '@/components/StrategyPlanner'

export const dynamic = 'force-dynamic'

export default async function StrategyPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null; name?: string | null }
  } | null

  if (!session?.user?.id) {
    redirect('/login')
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { sleeperUsername: true },
  })

  const sleeperUsername = profile?.sleeperUsername || ''

  let leagues: { league_id: string; name: string; season: number; type: string; team_count: number }[] = []

  if (sleeperUsername) {
    try {
      const res = await fetch(`https://api.sleeper.app/v1/user/${sleeperUsername}/leagues/nfl/2024`, {
        next: { revalidate: 300 },
      })
      if (res.ok) {
        const data = await res.json()
        leagues = (data || []).map((l: any) => ({
          league_id: l.league_id,
          name: l.name || 'Unnamed League',
          season: Number(l.season) || 2024,
          type: l.settings?.type === 2 ? 'dynasty' : 'redraft',
          team_count: l.total_rosters || l.settings?.num_teams || 12,
        }))
      }
    } catch {}
  }

  if (leagues.length === 0) {
    const dbLeagues = await prisma.league.findMany({
      where: { userId: session.user.id },
      select: { platformLeagueId: true, name: true },
      take: 20,
    })
    leagues = dbLeagues.map((l) => ({
      league_id: l.platformLeagueId,
      name: l.name || 'Unnamed League',
      season: 2024,
      type: 'redraft',
      team_count: 12,
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Season Strategy Planner
        </h1>
        <p className="text-gray-400 mb-8">
          AI-powered season roadmap with trade windows, risk analysis, and phase-by-phase action plans.
        </p>
        <StrategyPlanner leagues={leagues} sleeperUsername={sleeperUsername} />
      </div>
    </div>
  )
}
