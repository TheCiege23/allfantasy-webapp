import { prisma } from "@/lib/prisma"
import { BracketProView } from "@/components/bracket/BracketProView"
import { Leaderboard } from "@/components/bracket/Leaderboard"
import Link from "next/link"
import { requireVerifiedSession } from "@/lib/require-verified"

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

  const games = await (prisma as any).marchMadnessGame.findMany({
    where: { tournamentId: params.tournamentId },
    orderBy: [{ round: "asc" }, { gameNumber: "asc" }],
  })

  const picks = await (prisma as any).marchMadnessPick.findMany({
    where: { bracketId: entry.id },
    select: { gameId: true, winnerTeam: true },
  })

  const pickMap: Record<string, string | null> = {}
  for (const p of picks) pickMap[p.gameId] = p.winnerTeam ?? null

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
              nodes={games as any}
              initialPicks={pickMap}
            />
          </div>

          <div className="space-y-6">
            <Leaderboard tournamentId={params.tournamentId} leagueId={entry.leagueId} />
          </div>
        </div>
      </div>
    </div>
  )
}
