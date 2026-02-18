import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Trophy, Users, BarChart3, Shield } from "lucide-react"
import CopyJoinCode from "./CopyJoinCode"
import CreateEntryButton from "./CreateEntryButton"
import DevTestPanel from "./DevTestPanel"

type SessionUser = { id?: string; email?: string | null }

const isDev = process.env.NODE_ENV !== "production"

export default async function LeagueDetailPage({
  params,
}: {
  params: { leagueId: string }
}) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: SessionUser
  } | null
  const user = session?.user as SessionUser | undefined

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

  const isMember = league.members.some(
    (m: any) => m.userId === user?.id
  )

  const entryIds = league.entries.map((e: any) => e.id)
  let topStandings: { entryId: string; entryName: string; ownerName: string; points: number }[] = []

  if (entryIds.length > 0) {
    const sums = await (prisma as any).bracketPick.groupBy({
      by: ["entryId"],
      where: { entryId: { in: entryIds } },
      _sum: { points: true },
    })
    const scoreBy = new Map(sums.map((s: any) => [s.entryId, s._sum.points ?? 0]))

    topStandings = league.entries
      .map((e: any) => ({
        entryId: e.id,
        entryName: e.name,
        ownerName: e.user?.displayName || e.user?.email || "Unknown",
        points: scoreBy.get(e.id) ?? 0,
      }))
      .sort((a: any, b: any) => b.points - a.points)
      .slice(0, 5)
  }

  const pickCount = entryIds.length > 0
    ? await (prisma as any).bracketPick.count({
        where: { entryId: { in: entryIds }, pickedTeamName: { not: null } },
      })
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link
          href="/brackets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition"
        >
          &larr; Back to Brackets
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{league.name}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {league.tournament.name} &bull; {league.tournament.season}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-xs text-gray-500">
              Created by{" "}
              <span className="text-gray-300">
                {league.owner.displayName || league.owner.email || "Unknown"}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              League ID: <span className="font-mono text-gray-300">{league.id}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-lg font-bold">{league.members.length}</div>
            <div className="text-xs text-gray-500">Members</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-lg font-bold">{league.entries.length}</div>
            <div className="text-xs text-gray-500">Entries</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <div className="text-lg font-bold">{pickCount}</div>
            <div className="text-xs text-gray-500">Picks Made</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Users className="h-4 w-4" />
            Invite friends
          </div>
          <p className="text-sm text-gray-400">
            Share this code with friends so they can join your league:
          </p>
          <CopyJoinCode joinCode={league.joinCode} />
          <p className="text-xs text-gray-500 italic">
            Picks lock at tip-off for each game.
          </p>
        </div>

        {topStandings.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <BarChart3 className="h-4 w-4" />
              Standings
            </div>
            <div className="space-y-1">
              {topStandings.map((s, i) => (
                <div
                  key={s.entryId}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white/40 w-5 text-right">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium">{s.entryName}</div>
                      <div className="text-xs text-gray-500">{s.ownerName}</div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-cyan-400">
                    {s.points} <span className="text-xs font-normal text-white/40">pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
              <Trophy className="h-4 w-4" />
              Entries ({league.entries.length})
            </div>
            {user?.id && isMember && (
              <CreateEntryButton leagueId={league.id} />
            )}
          </div>

          {league.entries.length === 0 ? (
            <p className="text-sm text-gray-500">
              No entries yet. Be the first to fill out a bracket!
            </p>
          ) : (
            <div className="space-y-2">
              {league.entries.map((entry: any) => (
                <Link
                  key={entry.id}
                  href={`/bracket/${league.tournament.id}/entry/${entry.id}`}
                  className="block rounded-xl border border-white/10 bg-black/20 p-3 hover:bg-white/5 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{entry.name}</div>
                      <div className="text-xs text-gray-500">
                        by{" "}
                        {entry.user.displayName || entry.user.email || "Unknown"}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Users className="h-4 w-4" />
            Members ({league.members.length})
          </div>
          <div className="space-y-2">
            {league.members.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <div className="text-sm">
                  {m.user.displayName || m.user.email || "Unknown"}
                </div>
                <div className="text-xs text-gray-500">{m.role}</div>
              </div>
            ))}
          </div>
        </div>

        {!user?.id && (
          <div className="text-center">
            <Link
              href={`/login?callbackUrl=/brackets/leagues/${league.id}`}
              className="rounded-xl bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              Sign in to join
            </Link>
          </div>
        )}

        {isDev && (
          <DevTestPanel season={league.tournament.season} />
        )}
      </div>
    </div>
  )
}
