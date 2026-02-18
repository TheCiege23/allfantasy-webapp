"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import {
  Trophy,
  Users,
  Plus,
  UserPlus,
  BarChart3,
  ChevronRight,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Shield,
  Gamepad2,
  Star,
} from "lucide-react"

interface DashboardProps {
  user: {
    id: string
    username: string | null
    displayName: string | null
    email: string
    emailVerified: boolean
    avatarUrl: string | null
  }
  profile: {
    sleeperUsername: string | null
    isVerified: boolean
    isAgeConfirmed: boolean
    profileComplete: boolean
  }
  leagues: {
    id: string
    name: string
    tournamentId: string
    memberCount: number
  }[]
  entries: {
    id: string
    name: string
    tournamentId: string
    score: number
  }[]
}

export default function DashboardContent({ user, profile, leagues, entries }: DashboardProps) {
  const displayName = user.displayName || user.username || "Player"
  const needsAction = !profile.isVerified || !profile.isAgeConfirmed || !profile.profileComplete

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AllFantasy.ai
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/brackets/leagues/new"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-2 text-sm font-medium hover:from-cyan-400 hover:to-purple-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create League
            </Link>
            <Link
              href="/brackets/join"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
            >
              <UserPlus className="h-4 w-4" />
              Join League
            </Link>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium hidden sm:block">{displayName}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="ml-1 text-white/40 hover:text-white/70 transition"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {displayName}</h1>
          <p className="text-sm text-white/50 mt-1">
            {user.username && <span className="text-white/40">@{user.username}</span>}
            {profile.sleeperUsername && (
              <span className="ml-2 text-cyan-400/60">Sleeper: {profile.sleeperUsername}</span>
            )}
          </p>
        </div>

        {needsAction && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-medium text-sm">
              <AlertCircle className="h-4 w-4" />
              Complete your setup
            </div>
            <div className="space-y-2">
              {!profile.isVerified && (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="h-5 w-5 rounded-full border border-amber-500/30 flex items-center justify-center">
                    <span className="text-amber-400 text-xs">1</span>
                  </div>
                  Verify your email to unlock all features.
                  <Link href="/verify" className="text-cyan-400 hover:underline ml-auto">
                    Verify
                  </Link>
                </div>
              )}
              {!profile.isAgeConfirmed && (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="h-5 w-5 rounded-full border border-amber-500/30 flex items-center justify-center">
                    <span className="text-amber-400 text-xs">2</span>
                  </div>
                  Confirm your age (18+) to access leagues and brackets.
                  <Link href="/onboarding" className="text-cyan-400 hover:underline ml-auto">
                    Complete
                  </Link>
                </div>
              )}
              {profile.isVerified && profile.isAgeConfirmed && !profile.profileComplete && (
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <div className="h-5 w-5 rounded-full border border-amber-500/30 flex items-center justify-center">
                    <span className="text-amber-400 text-xs">3</span>
                  </div>
                  Complete your profile to get started.
                  <Link href="/onboarding" className="text-cyan-400 hover:underline ml-auto">
                    Complete
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {!needsAction && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="text-sm text-emerald-300">
              Your account is verified and ready. Create or join a league to get started!
            </div>
          </div>
        )}

        <div className="sm:hidden flex gap-3">
          <Link
            href="/brackets/leagues/new"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-4 py-3 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Create League
          </Link>
          <Link
            href="/brackets/join"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium"
          >
            <UserPlus className="h-4 w-4" />
            Join League
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-purple-400" />
                My Leagues
              </div>
              <span className="text-xs text-white/40">{leagues.length} total</span>
            </div>

            {leagues.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Gamepad2 className="h-8 w-8 text-white/20 mx-auto" />
                <p className="text-sm text-white/40">No leagues yet</p>
                <p className="text-xs text-white/30">Create or join a league to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leagues.map((league) => (
                  <Link
                    key={league.id}
                    href={`/brackets/leagues/${league.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
                        <Trophy className="h-4 w-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{league.name}</div>
                        <div className="text-xs text-white/40">{league.memberCount} members</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                My Bracket Entries
              </div>
              <span className="text-xs text-white/40">{entries.length} total</span>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Star className="h-8 w-8 text-white/20 mx-auto" />
                <p className="text-sm text-white/40">No entries yet</p>
                <p className="text-xs text-white/30">Join a league and create a bracket entry.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/bracket/${entry.tournamentId}/entry/${entry.id}`}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.05] transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center shrink-0">
                        <BarChart3 className="h-4 w-4 text-cyan-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{entry.name}</div>
                        <div className="text-xs text-white/40">Score: {entry.score} pts</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 transition">Continue picks</span>
                      <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
            <Shield className="h-4 w-4 text-cyan-400" />
            Recommended Actions
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {leagues.length === 0 && (
              <Link
                href="/brackets/leagues/new"
                className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 hover:bg-cyan-500/10 transition group"
              >
                <Plus className="h-5 w-5 text-cyan-400 mb-2" />
                <div className="text-sm font-medium">Create a League</div>
                <div className="text-xs text-white/40 mt-1">Start your own bracket challenge league.</div>
              </Link>
            )}
            {entries.length === 0 && leagues.length > 0 && (
              <Link
                href="/brackets"
                className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 hover:bg-purple-500/10 transition group"
              >
                <BarChart3 className="h-5 w-5 text-purple-400 mb-2" />
                <div className="text-sm font-medium">Fill Out a Bracket</div>
                <div className="text-xs text-white/40 mt-1">Make your picks and compete.</div>
              </Link>
            )}
            <Link
              href="/brackets"
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition group"
            >
              <Trophy className="h-5 w-5 text-amber-400 mb-2" />
              <div className="text-sm font-medium">View Brackets</div>
              <div className="text-xs text-white/40 mt-1">See all tournaments and leaderboards.</div>
            </Link>
            <Link
              href="/af-legacy"
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition group"
            >
              <Gamepad2 className="h-5 w-5 text-cyan-400 mb-2" />
              <div className="text-sm font-medium">AF Legacy Tools</div>
              <div className="text-xs text-white/40 mt-1">AI-powered trade analysis and more.</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
