import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { requireVerifiedSession } from "@/lib/require-verified"
import { getEntryBracketData } from "@/lib/brackets/getEntryBracketData"
import { LeagueHomeTabs } from "@/components/bracket/LeagueHomeTabs"

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
      <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/60">You're not a member of this league.</p>
          <Link href="/brackets" className="text-indigo-400 hover:underline text-sm">
            Back to Brackets
          </Link>
        </div>
      </div>
    )
  }

  const userEntries = league.entries.filter((e: any) => e.userId === userId)

  const allPicksByEntry: Record<string, Record<string, string | null>> = {}
  let nodesWithGame: any[] = []

  if (userEntries.length > 0) {
    const primaryEntry = userEntries[0]
    const bracketData = await getEntryBracketData(league.tournament.id, primaryEntry.id)
    nodesWithGame = bracketData.nodesWithGame
    allPicksByEntry[primaryEntry.id] = bracketData.pickMap

    for (const entry of userEntries.slice(1)) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/brackets"
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition"
          >
            &larr; Brackets
          </Link>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{league.name}</h1>
            <p className="text-sm text-white/40 mt-0.5">
              {league.tournament.name} &bull; {league.tournament.season}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {league.members.slice(0, 5).map((m: any) => (
                <div
                  key={m.id}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-gray-950 flex items-center justify-center text-[10px] font-bold text-white"
                  title={m.user.displayName || m.user.email}
                >
                  {(m.user.displayName || m.user.email || "?").slice(0, 2).toUpperCase()}
                </div>
              ))}
              {league.members.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-gray-950 flex items-center justify-center text-[10px] font-medium text-white/60">
                  +{league.members.length - 5}
                </div>
              )}
            </div>
            <div className="text-xs text-white/30">
              {league.members.length}/{league.maxManagers}
            </div>
          </div>
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
        />
      </div>
    </div>
  )
}
