import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { BracketologySpotlight } from "@/components/bracket/BracketologySpotlight"

export const dynamic = "force-dynamic"

type SessionUser = { id?: string; email?: string | null; name?: string | null }

export default async function BracketsHomePage() {
  let session: { user?: SessionUser } | null = null
  try {
    session = (await getServerSession(authOptions as any)) as {
      user?: SessionUser
    } | null
  } catch (e) {
    console.error("[brackets] session error:", e)
  }

  const tournaments = await (prisma as any).bracketTournament.findMany({
    orderBy: [{ season: "desc" }],
    select: { id: true, name: true, season: true, sport: true },
    take: 10,
  }) as { id: string; name: string; season: number; sport: string }[]

  const user = session?.user as SessionUser | undefined
  const userId = user?.id

  const myLeagues = userId
    ? await (prisma as any).bracketLeagueMember.findMany({
        where: { userId },
        include: {
          league: {
            select: {
              id: true,
              name: true,
              tournament: { select: { name: true, season: true } },
              _count: { select: { members: true, entries: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : []

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">NCAA Bracket Challenge</h1>
            <p className="text-sm text-gray-400 mt-1">
              Create a league, invite friends, and fill out your bracket.
            </p>
          </div>

          {!user?.id ? (
            <div className="flex gap-2">
              <Link
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                href="/signup"
              >
                Sign up
              </Link>
              <Link
                className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
                href="/login?callbackUrl=/brackets"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                className="rounded-xl bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                href="/brackets/leagues/new"
              >
                Create league
              </Link>
              <Link
                className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
                href="/brackets/join"
              >
                Join league
              </Link>
            </div>
          )}
        </div>

        <BracketologySpotlight />

        {myLeagues.length > 0 && (
          <div className="rounded-2xl border border-gray-800 p-4 bg-gray-900/50">
            <div className="text-sm font-semibold text-gray-300">My Leagues</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {myLeagues.map((m: any) => (
                <Link
                  key={m.league.id}
                  href={`/brackets/leagues/${m.league.id}`}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-4 hover:bg-gray-800/70 transition group"
                >
                  <div className="font-semibold group-hover:text-white transition">{m.league.name}</div>
                  <div className="text-sm text-gray-400">
                    {m.league.tournament.name} &bull; {m.league.tournament.season}
                  </div>
                  <div className="mt-2 flex gap-3 text-xs text-gray-500">
                    <span>{m.league._count.members} members</span>
                    <span>{m.league._count.entries} entries</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-800 p-4 bg-gray-900/50">
          <div className="text-sm font-semibold text-gray-300">Tournaments</div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {tournaments.map((t: { id: string; name: string; season: number; sport: string }) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-gray-400">
                  {t.season} &bull; {t.sport}
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    className="rounded-lg border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 transition-colors"
                    href={`/bracket/${t.id}`}
                  >
                    View
                  </Link>

                  {user?.id && (
                    <Link
                      className="rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
                      href={`/bracket/${t.id}/entries/new`}
                    >
                      Create entry
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {tournaments.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-700 p-6 text-center space-y-2">
                <div className="text-sm text-gray-400">
                  No tournaments available yet.
                </div>
                <p className="text-xs text-gray-500">
                  Tournaments are set up by admins before each season. Check back when March Madness brackets are live!
                </p>
              </div>
            )}
          </div>
        </div>

        {user && (
          <div className="text-xs text-gray-500">
            Signed in as {user.name || "User"}
          </div>
        )}
      </div>
    </div>
  )
}
