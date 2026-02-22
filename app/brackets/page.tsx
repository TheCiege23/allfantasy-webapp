import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Trophy, Plus, Users, ChevronRight } from "lucide-react"

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
              joinCode: true,
              tournament: { select: { name: true, season: true } },
              _count: { select: { members: true, entries: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : []

  return (
    <div className="min-h-screen text-white" style={{ background: '#0d1117' }}>
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.15)' }}>
              <Trophy className="w-5 h-5" style={{ color: '#fb923c' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">March Madness</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>NCAA Bracket Challenge</p>
            </div>
          </div>
          <Link
            href="/af-legacy"
            className="text-xs px-3 py-1.5 rounded-lg transition"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            Home
          </Link>
        </div>

        {!userId ? (
          <div className="rounded-2xl p-6 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.1)' }}>
              <Trophy className="w-8 h-8" style={{ color: '#fb923c' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Join March Madness</h2>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Create a pool, invite friends, and fill out your bracket.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Link
                href="/signup?callbackUrl=/brackets"
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-black"
                style={{ background: '#fb923c' }}
              >
                Sign Up
              </Link>
              <Link
                href="/login?callbackUrl=/brackets"
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
              >
                Sign In
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <Link
                href="/brackets/leagues/new"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-black"
                style={{ background: '#fb923c' }}
              >
                <Plus className="w-4 h-4" />
                Create Pool
              </Link>
              <Link
                href="/brackets/join"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
              >
                <Users className="w-4 h-4" />
                Join Pool
              </Link>
            </div>

            {myLeagues.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold px-1" style={{ color: 'rgba(255,255,255,0.5)' }}>MY POOLS</h2>
                {myLeagues.map((m: any) => (
                  <Link
                    key={m.league.id}
                    href={`/brackets/leagues/${m.league.id}`}
                    className="flex items-center gap-3 p-3.5 rounded-xl transition group"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(251,146,60,0.12)' }}>
                      <Trophy className="w-5 h-5" style={{ color: '#fb923c' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate group-hover:text-white transition">{m.league.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {m.league._count.members} member{m.league._count.members !== 1 ? 's' : ''} &bull; {m.league._count.entries} bracket{m.league._count.entries !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No pools yet. Create one or join a friend&apos;s pool to get started!
                </p>
              </div>
            )}

            <div className="text-xs text-center pt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Signed in as {user?.name || user?.email || 'User'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
