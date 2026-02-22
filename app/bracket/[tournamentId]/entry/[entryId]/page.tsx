import { prisma } from "@/lib/prisma"
import { BracketTreeView } from "@/components/bracket/BracketTreeView"
import { Leaderboard } from "@/components/bracket/Leaderboard"
import { PickAssistCard } from "@/components/bracket/PickAssistCard"
import Link from "next/link"
import { requireVerifiedSession } from "@/lib/require-verified"
import { getEntryBracketData } from "@/lib/brackets/getEntryBracketData"
import { ArrowLeft } from "lucide-react"

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
    return <div className="p-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Bracket entry not found.</div>
  if (entry.league.tournamentId !== params.tournamentId)
    return <div className="p-6" style={{ color: 'rgba(255,255,255,0.4)' }}>Wrong tournament.</div>

  const { nodesWithGame, pickMap } = await getEntryBracketData(params.tournamentId, entry.id)

  return (
    <div className="min-h-screen text-white" style={{ background: '#0d1117' }}>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/brackets/leagues/${entry.leagueId}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold">{entry.name || "My Bracket"}</h1>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Fill out your bracket</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <BracketTreeView
            tournamentId={params.tournamentId}
            leagueId={entry.leagueId}
            entryId={entry.id}
            nodes={nodesWithGame as any}
            initialPicks={pickMap}
          />

          <div className="space-y-4">
            <Leaderboard tournamentId={params.tournamentId} leagueId={entry.leagueId} />
            <PickAssistCard entryId={entry.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
