import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { requireVerifiedSession } from "@/lib/require-verified"
import { getEntryBracketData } from "@/lib/brackets/getEntryBracketData"
import { LeagueHomeTabs } from "@/components/bracket/LeagueHomeTabs"
import { Trophy, Settings, ArrowLeft } from "lucide-react"

export default async function LeagueDetailPage({
  params,
}: {
  params: { leagueId: string }
}) {
  const { userId } = await requireVerifiedSession()

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: params.leagueId },
    include: {
      tournament: { select: { id: true, name: true, season: true, sport: true } },
      owner: { select: { id: true, displayName: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      entries: {
        include: {
          user: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!league) notFound()

  const isMember = league.members.some((m: any) => m.userId === userId)
  if (!isMember) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center" style={{ background: '#0d1117' }}>
        <div className="text-center space-y-4">
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>You&apos;re not a member of this pool.</p>
          <Link href="/brackets" style={{ color: '#fb923c' }} className="text-sm hover:underline">
            Back to March Madness
          </Link>
        </div>
      </div>
    )
  }

  const userEntries = league.entries.filter((e: any) => e.userId === userId)

  const allPicksByEntry: Record<string, Record<string, string | null>> = {}
  let nodesWithGame: any[] = []

  if (league.entries.length > 0) {
    const primaryEntry = userEntries[0] ?? league.entries[0]
    const bracketData = await getEntryBracketData(league.tournament.id, primaryEntry.id)
    nodesWithGame = bracketData.nodesWithGame
    allPicksByEntry[primaryEntry.id] = bracketData.pickMap

    const remainingEntries = league.entries.filter((e: any) => e.id !== primaryEntry.id)
    for (const entry of remainingEntries) {
      const picks = await prisma.bracketPick.findMany({
        where: { entryId: entry.id },
        select: { nodeId: true, pickedTeamName: true },
      })
      const pickMap: Record<string, string | null> = {}
      for (const p of picks) pickMap[p.nodeId] = p.pickedTeamName ?? null
      allPicksByEntry[entry.id] = pickMap
    }
  } else {
    const nodes = await prisma.bracketNode.findMany({
      where: { tournamentId: league.tournament.id },
      orderBy: [{ round: "asc" }, { region: "asc" }, { slot: "asc" }],
    })
    nodesWithGame = nodes.map((n) => ({
      ...n,
      game: null,
    }))
  }

  const rules = (league.scoringRules || {}) as any
  const entriesPerUserFree = Number(rules.entriesPerUserFree ?? 2)
  const maxEntriesPerUser = Number(rules.maxEntriesPerUser ?? 10)
  const isPaidLeague = Boolean(rules.isPaidLeague)
  const paymentConfirmedAt = rules.commissionerPaymentConfirmedAt as string | null
  const scoringMode = String(rules.scoringMode || 'standard')

  return (
    <div className="min-h-screen text-white" style={{ background: '#0d1117' }}>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <Link
            href="/brackets"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.12)' }}>
              <Trophy className="w-4 h-4" style={{ color: '#fb923c' }} />
            </div>
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {league.name}
            </h1>
          </div>
          <button className="p-2 rounded-full transition" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <LeagueHomeTabs
          leagueId={league.id}
          tournamentId={league.tournament.id}
          currentUserId={userId}
          isOwner={league.ownerId === userId}
          members={league.members}
          entries={league.entries}
          userEntries={userEntries}
          nodes={nodesWithGame}
          initialPicks={allPicksByEntry}
          joinCode={league.joinCode}
          maxManagers={league.maxManagers}
          isPaidLeague={isPaidLeague}
          paymentConfirmedAt={paymentConfirmedAt}
          entriesPerUserFree={entriesPerUserFree}
          maxEntriesPerUser={maxEntriesPerUser}
          scoringMode={scoringMode}
        />
      </div>
    </div>
  )
}
