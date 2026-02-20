"use client"

import { useState, useCallback } from "react"
import { Trophy, Users, MessageCircle, Settings, ChevronDown } from "lucide-react"
import { BracketProView } from "./BracketProView"
import { Leaderboard } from "./Leaderboard"
import { LeagueChat } from "./LeagueChat"
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

const TABS = [
  { id: "bracket", label: "Bracket", icon: Trophy },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "members", label: "Members", icon: Users },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "settings", label: "Settings", icon: Settings },
] as const

type TabId = typeof TABS[number]["id"]

export function LeagueHomeTabs(props: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("bracket")
  const [activeEntryId, setActiveEntryId] = useState<string>(
    props.userEntries[0]?.id ?? ""
  )

  const activePicks = activeEntryId ? (props.initialPicks[activeEntryId] ?? {}) : {}

  return (
    <div className="space-y-0">
      <div className="flex gap-1 overflow-x-auto pb-1 px-1 -mx-1 scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white text-black shadow-lg"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4">
        {activeTab === "bracket" && (
          <BracketTab
            {...props}
            activeEntryId={activeEntryId}
            setActiveEntryId={setActiveEntryId}
            activePicks={activePicks}
          />
        )}
        {activeTab === "standings" && (
          <Leaderboard tournamentId={props.tournamentId} leagueId={props.leagueId} />
        )}
        {activeTab === "members" && <MembersTab {...props} />}
        {activeTab === "chat" && (
          <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur overflow-hidden">
            <LeagueChat leagueId={props.leagueId} currentUserId={props.currentUserId} />
          </div>
        )}
        {activeTab === "settings" && <SettingsTab {...props} />}
      </div>
    </div>
  )
}

function BracketTab({
  nodes,
  tournamentId,
  leagueId,
  activeEntryId,
  setActiveEntryId,
  activePicks,
  userEntries,
}: Props & {
  activeEntryId: string
  setActiveEntryId: (id: string) => void
  activePicks: Record<string, string | null>
}) {
  if (userEntries.length === 0) {
    return (
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
    )
  }

  return (
    <div className="space-y-4">
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

      <BracketProView
        tournamentId={tournamentId}
        leagueId={leagueId}
        entryId={activeEntryId}
        nodes={nodes}
        initialPicks={activePicks}
      />
    </div>
  )
}

function MembersTab({ members, maxManagers }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white/70">
          Members ({members.length}/{maxManagers})
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(m.user.displayName || m.user.email || "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">
                {m.user.displayName || m.user.email || "Unknown"}
              </div>
              <div className="text-[11px] text-white/30">{m.role}</div>
            </div>
            {m.role === "COMMISSIONER" && (
              <span className="text-[10px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded-full font-medium">
                Commissioner
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsTab({
  joinCode,
  isPaidLeague,
  paymentConfirmedAt,
  isOwner,
  leagueId,
  entriesPerUserFree,
  maxEntriesPerUser,
  maxManagers,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur p-5 space-y-4">
        <div className="text-sm font-semibold text-white/70">Invite Friends</div>
        <CopyJoinCode joinCode={joinCode} />
        <p className="text-xs text-white/30 italic">
          Picks lock at tip-off for each game.
        </p>
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
