"use client"

import { useState, useMemo, useEffect } from "react"
import { Trophy, ChevronDown, MessageCircle, Pin, Send, X, Share2, Copy, Check, Settings } from "lucide-react"
import { BracketTreeView } from "./BracketTreeView"
import { PoolStandings } from "./PoolStandings"
import { GameScores } from "./GameScores"
import { PoolBrackets } from "./PoolBrackets"
import { useBracketLive } from "@/lib/hooks/useBracketLive"
import CopyJoinCode from "@/app/brackets/leagues/[leagueId]/CopyJoinCode"
import CreateEntryButton from "@/app/brackets/leagues/[leagueId]/CreateEntryButton"
import ConfirmPaymentButton from "@/app/brackets/leagues/[leagueId]/ConfirmPaymentButton"

type Member = {
  id: string
  userId: string
  role: string
  user: { id: string; displayName: string | null; email: string }
}

type Entry = {
  id: string
  userId: string
  name: string
  createdAt: string
  user: { id: string; displayName: string | null; email: string }
}

type BracketNode = {
  id: string
  slot: string
  round: number
  region: string | null
  seedHome: number | null
  seedAway: number | null
  homeTeamName: string | null
  awayTeamName: string | null
  sportsGameId: string | null
  nextNodeId: string | null
  nextNodeSide: string | null
  game: any
}

type Props = {
  leagueId: string
  tournamentId: string
  currentUserId: string
  isOwner: boolean
  members: Member[]
  entries: Entry[]
  userEntries: Entry[]
  nodes: BracketNode[]
  initialPicks: Record<string, Record<string, string | null>>
  joinCode: string
  maxManagers: number
  isPaidLeague: boolean
  paymentConfirmedAt: string | null
  entriesPerUserFree: number
  maxEntriesPerUser: number
}

type TabId = "pool" | "brackets" | "global"

const TABS: { id: TabId; label: string }[] = [
  { id: "pool", label: "POOL" },
  { id: "brackets", label: "BRACKETS" },
  { id: "global", label: "GLOBAL" },
]

export function LeagueHomeTabs(props: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("pool")
  const [activeEntryId, setActiveEntryId] = useState<string>(
    props.userEntries[0]?.id ?? ""
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(true)

  const { data: live } = useBracketLive({
    tournamentId: props.tournamentId,
    leagueId: props.leagueId,
    enabled: true,
    intervalMs: 12000,
  })

  const standings = (live?.standings ?? []) as any[]
  const games = (live?.games ?? []) as any[]

  const activePicks = activeEntryId ? (props.initialPicks[activeEntryId] ?? {}) : {}

  return (
    <div className="space-y-0 relative pb-16">
      <div className="flex items-center justify-center gap-0 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-6 py-3 text-sm font-semibold tracking-wide transition-colors"
              style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.35)' }}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#fb923c' }} />
              )}
            </button>
          )
        })}
      </div>

      <div>
        {activeTab === "pool" && (
          <PoolTab
            {...props}
            activeEntryId={activeEntryId}
            setActiveEntryId={setActiveEntryId}
            activePicks={activePicks}
            standings={standings}
            games={games}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            inviteOpen={inviteOpen}
            setInviteOpen={setInviteOpen}
          />
        )}
        {activeTab === "brackets" && (
          <PoolBrackets
            standings={standings}
            nodes={props.nodes}
            tournamentId={props.tournamentId}
            leagueId={props.leagueId}
            currentUserId={props.currentUserId}
            allPicks={props.initialPicks}
          />
        )}
        {activeTab === "global" && (
          <GlobalTab tournamentId={props.tournamentId} currentUserId={props.currentUserId} />
        )}
      </div>

      <ChatBar
        leagueId={props.leagueId}
        currentUserId={props.currentUserId}
        members={props.members}
      />
    </div>
  )
}

function PoolTab({
  nodes,
  tournamentId,
  leagueId,
  activeEntryId,
  setActiveEntryId,
  activePicks,
  userEntries,
  currentUserId,
  entries,
  standings,
  games,
  settingsOpen,
  setSettingsOpen,
  inviteOpen,
  setInviteOpen,
  joinCode,
  isPaidLeague,
  paymentConfirmedAt,
  isOwner,
  entriesPerUserFree,
  maxEntriesPerUser,
  maxManagers,
  members,
}: Props & {
  activeEntryId: string
  setActiveEntryId: (id: string) => void
  activePicks: Record<string, string | null>
  standings: any[]
  games: any[]
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
  inviteOpen: boolean
  setInviteOpen: (v: boolean) => void
}) {
  const totalPicks = Object.values(activePicks).filter(Boolean).length
  const totalGames = nodes.filter(n => n.round >= 1).length

  return (
    <div className="space-y-4">
      {userEntries.length > 0 ? (
        <div className="space-y-3">
          {userEntries.length > 1 && (
            <div className="flex items-center gap-3">
              <label className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Viewing:</label>
              <div className="relative">
                <select
                  value={activeEntryId}
                  onChange={(e) => setActiveEntryId(e.target.value)}
                  className="appearance-none rounded-xl px-4 py-2 pr-8 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {userEntries.map((e) => (
                    <option key={e.id} value={e.id} style={{ background: '#0d1117' }}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
            </div>
          )}

          <BracketTreeView
            tournamentId={tournamentId}
            leagueId={leagueId}
            entryId={activeEntryId}
            nodes={nodes}
            initialPicks={activePicks}
            compact
          />
          <div className="text-center">
            <p className="text-sm">
              Tap to fill out your bracket <span className="font-bold" style={{ color: '#fb923c' }}>{totalPicks}</span> out of <span className="font-bold">{totalGames}</span>
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Brackets lock when first round games begin
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Trophy className="h-12 w-12 mx-auto" style={{ color: 'rgba(251,146,60,0.5)' }} />
          <div>
            <h3 className="text-lg font-semibold">Fill Out Your Bracket</h3>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Create an entry to start picking winners
            </p>
          </div>
          <CreateEntryButton leagueId={leagueId} />
        </div>
      )}

      <InviteSection joinCode={joinCode} inviteOpen={inviteOpen} setInviteOpen={setInviteOpen} members={members} />

      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="w-full rounded-xl px-5 py-3.5 flex items-center justify-center gap-2 text-sm font-semibold transition"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
      >
        SETTINGS & RULES
        <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
      </button>

      {settingsOpen && (
        <SettingsPanel
          joinCode={joinCode}
          isPaidLeague={isPaidLeague}
          paymentConfirmedAt={paymentConfirmedAt}
          isOwner={isOwner}
          leagueId={leagueId}
          entriesPerUserFree={entriesPerUserFree}
          maxEntriesPerUser={maxEntriesPerUser}
          maxManagers={maxManagers}
        />
      )}

      <GameScores games={games} />

      <PoolStandings
        standings={standings}
        currentUserId={currentUserId}
        totalEntries={entries.length}
      />
    </div>
  )
}

function InviteSection({
  joinCode,
  inviteOpen,
  setInviteOpen,
  members,
}: {
  joinCode: string
  inviteOpen: boolean
  setInviteOpen: (v: boolean) => void
  members: Member[]
}) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/brackets/join?code=${joinCode}`
    : `/brackets/join?code=${joinCode}`

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setInviteOpen(!inviteOpen)}
        className="w-full px-4 py-3 flex items-center justify-center gap-2 text-sm font-semibold"
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        INVITE TO POOL
        <ChevronDown className={`h-4 w-4 transition-transform ${inviteOpen ? "rotate-180" : ""}`} />
      </button>

      {inviteOpen && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            {members.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}
              >
                {(m.user.displayName || m.user.email || '?').slice(0, 2).toUpperCase()}
              </div>
            ))}
            {members.length > 5 && (
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>+{members.length - 5}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="flex-1 rounded-lg px-3 py-2 text-xs truncate"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(251,146,60,0.3)', color: 'rgba(255,255,255,0.5)' }}
            >
              {inviteUrl}
            </div>
            <button
              onClick={copyLink}
              className="p-2 rounded-lg transition"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'Join my March Madness pool!', url: inviteUrl })
                } else {
                  copyLink()
                }
              }}
              className="p-2 rounded-lg transition"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPanel({
  joinCode,
  isPaidLeague,
  paymentConfirmedAt,
  isOwner,
  leagueId,
  entriesPerUserFree,
  maxEntriesPerUser,
  maxManagers,
}: {
  joinCode: string
  isPaidLeague: boolean
  paymentConfirmedAt: string | null
  isOwner: boolean
  leagueId: string
  entriesPerUserFree: number
  maxEntriesPerUser: number
  maxManagers: number
}) {
  const SCORING = [
    { round: "Round 1 (32)", pts: 1, total: 32 },
    { round: "Round 2 (16)", pts: 2, total: 32 },
    { round: "Sweet 16 (8)", pts: 4, total: 32 },
    { round: "Elite 8 (4)", pts: 8, total: 32 },
    { round: "Final Four (2)", pts: 16, total: 32 },
    { round: "Championship (1)", pts: 32, total: 32 },
  ]

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-4 py-3 flex items-center gap-4 text-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Settings className="w-4 h-4" />
            {maxEntriesPerUser} Max Bracket{maxEntriesPerUser !== 1 ? 's' : ''}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Show Champ Pick</div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <th className="text-left px-4 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>ROUND (# GAMES)</th>
              <th className="text-center px-4 py-2 text-xs font-semibold" style={{ color: '#fb923c' }}>PTS PER CORRECT</th>
              <th className="text-center px-4 py-2 text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>TOTAL POINTS</th>
            </tr>
          </thead>
          <tbody>
            {SCORING.map((s) => (
              <tr key={s.round} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.round}</td>
                <td className="text-center px-4 py-2 text-xs font-bold" style={{ color: '#fb923c' }}>{s.pts}</td>
                <td className="text-center px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPaidLeague && (
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)' }}>
          <div className="text-sm font-semibold" style={{ color: '#6ee7b7' }}>Paid League (FanCred)</div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Status: {paymentConfirmedAt ? `Confirmed` : "Pending confirmation"}
          </div>
          {isOwner && !paymentConfirmedAt && <ConfirmPaymentButton leagueId={leagueId} />}
        </div>
      )}
    </div>
  )
}

function GlobalTab({ tournamentId, currentUserId }: { tournamentId: string; currentUserId: string }) {
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalEntries, setTotalEntries] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  async function fetchRankings(p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/bracket/global-rankings?tournamentId=${tournamentId}&page=${p}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setRankings(data.rankings ?? [])
        setTotalEntries(data.totalEntries ?? 0)
        setTotalPages(data.totalPages ?? 0)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchRankings(page) }, [tournamentId, page])

  if (loading) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading global rankings...</div>
      </div>
    )
  }

  if (rankings.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <Trophy className="h-10 w-10 mx-auto" style={{ color: 'rgba(251,146,60,0.3)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>Global Leaderboard</h3>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No brackets submitted yet. Fill out your bracket to see global rankings!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Global Rankings
        </div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {totalEntries.toLocaleString()} brackets
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
          <div className="w-10 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="w-16 text-center">Pts</div>
          <div className="w-16 text-center">Max</div>
          <div className="w-20 text-right">Champ</div>
        </div>

        {rankings.map((r: any) => {
          const isMe = r.userId === currentUserId
          return (
            <div
              key={r.entryId}
              className="flex items-center px-4 py-2.5 transition"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: isMe ? 'rgba(251,146,60,0.06)' : undefined,
              }}
            >
              <div className="w-10 text-center text-xs font-bold" style={{ color: r.rank <= 3 ? '#fb923c' : 'rgba(255,255,255,0.4)' }}>
                {r.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: isMe ? '#fb923c' : 'rgba(255,255,255,0.8)' }}>
                  {r.displayName || 'Anonymous'}
                  {isMe && <span className="ml-1 text-[10px]" style={{ color: 'rgba(251,146,60,0.6)' }}>(you)</span>}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {r.entryName} • {r.leagueName}
                </div>
              </div>
              <div className="w-16 text-center text-xs font-bold" style={{ color: '#fb923c' }}>
                {r.totalPoints}
              </div>
              <div className="w-16 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {r.maxPossible}
              </div>
              <div className="w-20 text-right text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {r.championPick || '—'}
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
          >
            Prev
          </button>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

function ChatBar({
  leagueId,
  currentUserId,
  members,
}: {
  leagueId: string
  currentUserId: string
  members: { id: string; userId: string; user: { displayName: string | null; email: string } }[]
}) {
  const [latestMessage, setLatestMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<any[]>([])

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/bracket/leagues/${leagueId}/chat`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages ?? [])
        if (data.messages?.length > 0) {
          const last = data.messages[data.messages.length - 1]
          const name = last.user?.displayName || last.user?.email || "Someone"
          setLatestMessage(`${name}: ${last.message?.length > 30 ? last.message.slice(0, 30) + "..." : last.message}`)
        }
      }
    } catch {}
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || sending) return
    setSending(true)
    try {
      await fetch(`/api/bracket/leagues/${leagueId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input.trim() }),
      })
      setInput("")
      fetchMessages()
    } catch {}
    setSending(false)
  }

  useEffect(() => { fetchMessages() }, [leagueId])

  if (!expanded) {
    return (
      <div
        onClick={() => { setExpanded(true); fetchMessages() }}
        className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-3 cursor-pointer transition"
        style={{ background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <MessageCircle className="h-5 w-5 text-white flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">Chat</span>
          {latestMessage ? (
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{latestMessage}</p>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Be the first to say hi</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Pin className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>DM</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30" style={{ background: 'rgba(13,17,23,0.98)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Chat
        </span>
        <button onClick={() => setExpanded(false)} className="p-1 rounded-lg transition" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>No messages yet. Start the conversation!</p>
        )}
        {messages.map((m: any) => {
          const isMe = m.user?.id === currentUserId || m.userId === currentUserId
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? "justify-end" : ""}`}>
              {!isMe && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: 'rgba(251,146,60,0.2)' }}>
                  {(m.user?.displayName || m.user?.email || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="rounded-xl px-3 py-1.5 max-w-[70%]" style={{ background: isMe ? 'rgba(251,146,60,0.1)' : 'rgba(255,255,255,0.04)' }}>
                {!isMe && (
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {m.user?.displayName || m.user?.email || "Unknown"}
                  </div>
                )}
                <div className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>{m.message}</div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={sendMessage} className="px-4 py-2 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="p-2 rounded-xl disabled:opacity-40 transition"
          style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c' }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}
