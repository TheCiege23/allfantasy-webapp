"use client"

import { useMemo } from "react"
import { Trophy } from "lucide-react"

type StandingRow = {
  entryId: string
  entryName: string
  userId?: string
  displayName?: string | null
  avatarUrl?: string | null
  ownerName?: string
  points?: number
  totalPoints?: number
  correctPicks?: number
  totalPicks?: number
  roundCorrect?: Record<number, number>
  championPick?: string | null
  maxPossible?: number
}

const ROUND_HEADERS = [
  { round: 1, label: "64" },
  { round: 2, label: "32" },
  { round: 3, label: "16" },
  { round: 4, label: "8" },
  { round: 5, label: "4" },
  { round: 6, icon: true },
]

const ROUND_MAX_PICKS: Record<number, number> = { 1: 32, 2: 16, 3: 8, 4: 4, 5: 2, 6: 1 }

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const initials = (name || "?").slice(0, 2).toUpperCase()
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden") }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

function StandingCard({
  row,
  rank,
  isUser,
  totalEntries,
}: {
  row: StandingRow
  rank: number
  isUser: boolean
  totalEntries: number
}) {
  const pts = row.totalPoints ?? row.points ?? 0
  const maxPossible = row.maxPossible ?? 0
  const roundCorrect = row.roundCorrect ?? {}
  const champion = row.championPick
  const displayName = row.displayName ?? row.ownerName ?? row.entryName

  return (
    <div className={`py-3 px-3 ${isUser ? "bg-white/5" : ""}`}>
      <div className="flex items-center gap-2">
        <div className="w-6 text-xs font-bold text-white/60 text-right flex-shrink-0">
          {isUser ? rank : rank}
        </div>

        <Avatar name={displayName} url={row.avatarUrl} size={28} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">{displayName}</span>
          </div>
          {isUser && row.entryName && (
            <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wide">
              {row.entryName}
            </div>
          )}
        </div>

        <div className="text-2xl font-bold text-white tabular-nums flex-shrink-0">
          {pts}
        </div>
      </div>

      <div className="mt-2 ml-8 flex items-center gap-0">
        <div className="flex gap-0">
          {ROUND_HEADERS.map((rh) => {
            const maxForRound = ROUND_MAX_PICKS[rh.round] ?? 0
            const correct = roundCorrect[rh.round] ?? 0
            return (
              <div key={rh.round} className="w-8 text-center">
                <div className="text-[10px] font-bold text-white/40 tabular-nums">
                  {maxForRound}
                </div>
                <div className={`text-[11px] font-bold tabular-nums ${correct > 0 ? "text-white" : "text-white/20"}`}>
                  {correct}
                </div>
              </div>
            )
          })}
          <div className="w-5 text-center flex items-center justify-center">
            <Trophy className="h-3 w-3 text-amber-400/60" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 text-[10px] text-white/40">
          {champion && (
            <span className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-amber-400/50" />
              {champion.length > 4 ? champion.slice(0, 3).toUpperCase() : champion.toUpperCase()}
            </span>
          )}
          <span>MAX {maxPossible}</span>
        </div>
      </div>
    </div>
  )
}

export function PoolStandings({
  standings,
  currentUserId,
  totalEntries,
}: {
  standings: StandingRow[]
  currentUserId: string
  totalEntries: number
}) {
  const { userRows, allRanked } = useMemo(() => {
    const ranked = standings.map((r, idx) => ({
      ...r,
      rank: idx + 1,
      isUser: r.userId === currentUserId,
    }))
    return {
      userRows: ranked.filter((r) => r.isUser),
      allRanked: ranked,
    }
  }, [standings, currentUserId])

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Standings</h2>
          <p className="text-xs text-white/40">{totalEntries} brackets in pool</p>
        </div>
        <button className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition">
          VIEW ALL
        </button>
      </div>

      {userRows.length > 0 && (
        <div className="border-t border-white/5">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">My Brackets</span>
            <div className="flex items-center gap-0">
              {ROUND_HEADERS.map((rh) => (
                <div key={rh.round} className="w-8 text-center text-[10px] font-semibold text-white/30">
                  {rh.icon ? "" : rh.label}
                </div>
              ))}
              <div className="w-5" />
              <div className="w-12 text-right text-[10px] font-semibold text-white/30">TOT</div>
            </div>
          </div>
          {userRows.map((r) => (
            <StandingCard
              key={r.entryId}
              row={r}
              rank={r.rank}
              isUser
              totalEntries={totalEntries}
            />
          ))}
        </div>
      )}

      <div className="border-t border-white/5">
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">RK</span>
          <div className="flex items-center gap-0">
            <span className="text-[10px] font-semibold text-white/30 mr-4"># CORRECT PICKS</span>
            <div className="w-12 text-right text-[10px] font-semibold text-white/30">TOT</div>
          </div>
        </div>
        {allRanked.slice(0, 20).map((r) => (
          <StandingCard
            key={r.entryId}
            row={r}
            rank={r.rank}
            isUser={r.isUser}
            totalEntries={totalEntries}
          />
        ))}
        {allRanked.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-white/30">No entries yet</div>
        )}
      </div>
    </div>
  )
}
