"use client"

import { useState, useMemo, useEffect } from "react"
import { Trophy, ChevronDown, MessageCircle, Pin, Send, X } from "lucide-react"
import { BracketProView } from "./BracketProView"
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
  const [chatOpen, setChatOpen] = useState(true)
  const [chatMessage, setChatMessage] = useState("")

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
      <div className="flex items-center justify-center gap-0 border-b border-white/10 mb-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${
                isActive
                  ? "text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-400 rounded-full" />
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
          <GlobalTab />
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
  joinCode,
  isPaidLeague,
  paymentConfirmedAt,
  isOwner,
  entriesPerUserFree,
  maxEntriesPerUser,
  maxManagers,
}: Props & {
  activeEntryId: string
  setActiveEntryId: (id: string) => void
  activePicks: Record<string, string | null>
  standings: any[]
  games: any[]
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
}) {
  return (
    <div className="space-y-5">
      {userEntries.length > 0 ? (
        <div className="space-y-3">
          {userEntries.length > 1 && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-white/50">Viewing:</label>
              <div className="relative">
                <select
                  value={activeEntryId}
                  onChange={(e) => setActiveEntryId(e.target.value)}
                  className="appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 pr-8 text-sm text-white outline-none focus:border-white/20"
                >
                  {userEntries.map((e) => (
                    <option key={e.id} value={e.id} className="bg-gray-900">
                      {e.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>
              <CreateEntryButton leagueId={leagueId} />
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur overflow-hidden">
            <BracketProView
              tournamentId={tournamentId}
              leagueId={leagueId}
              entryId={activeEntryId}
              nodes={nodes}
              initialPicks={activePicks}
            />
            <div className="text-center py-2 text-xs text-white/40 font-medium">My Bracket</div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-8 text-center space-y-4">
          <Trophy className="h-12 w-12 mx-auto text-yellow-400/60" />
          <div>
            <h3 className="text-lg font-semibold text-white">Fill Out Your Bracket</h3>
            <p className="text-sm text-white/50 mt-1">
              Create an entry to start picking winners
            </p>
          </div>
          <CreateEntryButton leagueId={leagueId} />
        </div>
      )}

      <button
        onClick={() => setSettingsOpen(!settingsOpen)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 backdrop-blur px-5 py-3.5 flex items-center justify-center gap-2 text-sm font-semibold text-white hover:bg-white/5 transition"
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
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
        <div className="text-sm font-semibold text-white/70">Invite Friends</div>
        <CopyJoinCode joinCode={joinCode} />
        <p className="text-xs text-white/30 italic">Picks lock at tip-off for each game.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-5">
        <div className="text-sm font-semibold text-white/70 mb-4">League Rules</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{entriesPerUserFree}</div>
            <div className="text-[11px] text-white/40">Free Entries</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{maxEntriesPerUser}</div>
            <div className="text-[11px] text-white/40">Max Entries</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{maxManagers}</div>
            <div className="text-[11px] text-white/40">Capacity</div>
          </div>
        </div>
      </div>

      {isPaidLeague && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
          <div className="text-sm font-semibold text-emerald-300">Paid League (FanCred)</div>
          <div className="text-xs text-white/50">
            Commissioner must confirm payment to unlock paid extra entries.
          </div>
          <div className="text-xs text-white/40">
            Status:{" "}
            {paymentConfirmedAt
              ? `Confirmed at ${new Date(paymentConfirmedAt).toLocaleString()}`
              : "Pending confirmation"}
          </div>
          {isOwner && !paymentConfirmedAt && <ConfirmPaymentButton leagueId={leagueId} />}
        </div>
      )}
    </div>
  )
}

function GlobalTab() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-8 text-center space-y-3">
      <Trophy className="h-10 w-10 mx-auto text-amber-400/40" />
      <h3 className="text-sm font-semibold text-white/60">Global Leaderboard</h3>
      <p className="text-xs text-white/30">
        See how your bracket stacks up against all AllFantasy players. Coming soon.
      </p>
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
          setLatestMessage(`${name} ${last.message?.length > 30 ? last.message.slice(0, 30) + "..." : last.message}`)
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
        className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-lg border-t border-white/10 px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-800/95 transition"
      >
        <MessageCircle className="h-5 w-5 text-white flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white">Chat</span>
          {latestMessage && (
            <p className="text-xs text-white/40 truncate">{latestMessage}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Pin className="h-4 w-4 text-white/30" />
          <span className="text-[10px] font-semibold text-white/50 bg-white/10 rounded px-1.5 py-0.5">DM</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900/98 backdrop-blur-lg border-t border-white/10">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          Chat
        </span>
        <button onClick={() => setExpanded(false)} className="p-1 hover:bg-white/10 rounded-lg transition">
          <X className="h-4 w-4 text-white/50" />
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto px-4 py-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-white/30 text-center py-4">No messages yet. Start the conversation!</p>
        )}
        {messages.map((m: any) => {
          const isMe = m.user?.id === currentUserId || m.userId === currentUserId
          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? "justify-end" : ""}`}>
              {!isMe && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                  {(m.user?.displayName || m.user?.email || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className={`rounded-xl px-3 py-1.5 max-w-[70%] ${isMe ? "bg-cyan-500/20 text-white" : "bg-white/5 text-white/80"}`}>
                {!isMe && (
                  <div className="text-[10px] font-semibold text-white/50 mb-0.5">
                    {m.user?.displayName || m.user?.email || "Unknown"}
                  </div>
                )}
                <div className="text-xs">{m.message}</div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={sendMessage} className="px-4 py-2 flex items-center gap-2 border-t border-white/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 rounded-xl border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-40 transition"
        >
          <Send className="h-4 w-4 text-cyan-400" />
        </button>
      </form>
    </div>
  )
}
