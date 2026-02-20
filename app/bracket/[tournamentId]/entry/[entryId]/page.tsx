import { prisma } from "@/lib/prisma"
import { BracketProView } from "@/components/bracket/BracketProView"
import { Leaderboard } from "@/components/bracket/Leaderboard"
import { PickAssistCard } from "@/components/bracket/PickAssistCard"
import Link from "next/link"
import { requireVerifiedSession } from "@/lib/require-verified"
import { getEntryBracketData } from "@/lib/brackets/getEntryBracketData"

export default async function EntryBracketPage({
  params,
}: {
  params: { tournamentId: string; entryId: string }
}) {
  const { userId } = await requireVerifiedSession()

  const entry = await prisma.bracketEntry.findUnique({
    where: { id: params.entryId },
    select: { id: true, userId: true, leagueId: true, name: true, league: { select: { tournamentId: true } } },
  })

  if (!entry || entry.userId !== userId)
    return <div className="p-6 text-white/60">Bracket entry not found.</div>
  if (entry.league.tournamentId !== params.tournamentId)
    return <div className="p-6 text-white/60">Wrong tournament.</div>

  const { nodesWithGame, pickMap } = await getEntryBracketData(params.tournamentId, entry.id)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Link
          href={`/brackets/leagues/${entry.leagueId}`}
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          &larr; Back to League
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{entry.name || "My Bracket"}</h1>
            <div className="text-sm text-gray-300 mt-1">Live scoring + auto-advance</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <BracketProView
              tournamentId={params.tournamentId}
              leagueId={entry.leagueId}
              entryId={entry.id}
              nodes={nodesWithGame as any}
              initialPicks={pickMap}
            />
          </div>

          <div className="space-y-6">
            <Leaderboard tournamentId={params.tournamentId} leagueId={entry.leagueId} />
            <PickAssistCard entryId={entry.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
