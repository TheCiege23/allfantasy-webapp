import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type SessionUser = { id?: string; email?: string | null; name?: string | null }

export default async function BracketsHomePage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: SessionUser
  } | null

  const tournaments = await (prisma as any).bracketTournament.findMany({
    orderBy: [{ season: "desc" }],
    select: { id: true, name: true, season: true, sport: true },
    take: 10,
  }) as { id: string; name: string; season: number; sport: string }[]

  const user = session?.user as SessionUser | undefined

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="absolute top-5 right-5 pointer-events-none select-none z-0">
        <img src="/af-shield-bg.png" alt="" className="w-12 h-12 opacity-[0.06]" draggable={false} />
      </div>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src="/af-shield-bg.png" alt="" className="w-7 h-7 opacity-50" draggable={false} />
              <img src="/allfantasy-hero.png" alt="" className="h-3.5 opacity-30" draggable={false} />
            </div>
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
        <div className="flex items-center justify-center gap-3 py-4 opacity-15 pointer-events-none select-none">
          <img src="/af-shield-bg.png" alt="" className="w-7 h-7" draggable={false} />
          <img src="/allfantasy-hero.png" alt="" className="h-3.5" draggable={false} />
        </div>
      </div>
    </div>
  )
}
