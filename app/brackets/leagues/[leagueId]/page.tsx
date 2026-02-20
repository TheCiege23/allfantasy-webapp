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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] to-[#111827] text-white">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <Link
            href="/brackets"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-sm text-white/60 hover:text-white hover:bg-white/15 transition"
          >
            &larr;
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-2xl">&#127936;</span>
            <h1 className="text-lg sm:text-xl font-bold truncate">
              {league.tournament.name === "March Madness" ? "March Madness" : league.name}
            </h1>
            <span className="text-2xl">&#127936;</span>
          </div>
          <button className="p-2 hover:bg-white/10 rounded-full transition">
            <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
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
        />
      </div>
    </div>
  )
}
