"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Trophy, ChevronDown, MessageCircle, Pin, Send, X, Share2, Copy, Check, Settings } from "lucide-react"
import { BracketTreeView } from "./BracketTreeView"
import { PoolStandings } from "./PoolStandings"
import { GameScores } from "./GameScores"
import { PoolBrackets } from "./PoolBrackets"
import { LiveModeView } from "./LiveModeView"
import { useBracketLive } from "@/lib/hooks/useBracketLive"
import CopyJoinCode from "@/app/brackets/leagues/[leagueId]/CopyJoinCode"
import CreateEntryButton from "@/app/brackets/leagues/[leagueId]/CreateEntryButton"

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
  scoringMode?: string
}

type TabId = "pool" | "brackets" | "live" | "feed" | "global" | "public"

const TABS: { id: TabId; label: string }[] = [
  { id: "pool", label: "POOL" },
  { id: "brackets", label: "BRACKETS" },
  { id: "live", label: "LIVE" },
  { id: "feed", label: "FEED" },
  { id: "global", label: "GLOBAL" },
  { id: "public", label: "PUBLIC" },
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
        {activeTab === "live" && (
          <LiveModeView
            games={games}
            standings={standings}
            currentUserId={props.currentUserId}
            scoringMode={props.scoringMode}
          />
        )}
        {activeTab === "feed" && (
          <FeedTab tournamentId={props.tournamentId} leagueId={props.leagueId} />
        )}
        {activeTab === "global" && (
          <GlobalTab tournamentId={props.tournamentId} currentUserId={props.currentUserId} />
        )}
        {activeTab === "public" && (
          <PublicPoolsTab tournamentId={props.tournamentId} />
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
  isOwner,
  maxManagers,
  members,
  scoringMode,
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
          isOwner={isOwner}
          leagueId={leagueId}
          maxManagers={maxManagers}
          scoringMode={normalizeScoringMode(scoringMode)}
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

type ScoringMode = 'fancred_edge' | 'momentum' | 'accuracy_boldness' | 'streak_survival'

const VALID_SCORING_MODES: ScoringMode[] = ['fancred_edge', 'momentum', 'accuracy_boldness', 'streak_survival']

function normalizeScoringMode(raw: string | undefined | null): ScoringMode {
  if (raw && VALID_SCORING_MODES.includes(raw as ScoringMode)) return raw as ScoringMode
  if (raw === 'standard' || raw === 'upset_bonus') return 'momentum'
  if (raw === 'seed_weighted') return 'accuracy_boldness'
  return 'fancred_edge'
}

const SCORING_MODES: { id: ScoringMode; label: string; desc: string }[] = [
  { id: 'fancred_edge', label: 'FanCred EDGE', desc: 'Upset delta + leverage bonus + insurance' },
  { id: 'momentum', label: 'Momentum', desc: 'Round base + seed-gap upset bonus' },
  { id: 'accuracy_boldness', label: 'Accuracy + Boldness', desc: 'Round base + uniqueness bonus within league' },
  { id: 'streak_survival', label: 'Streak & Survival', desc: 'Streak bonuses scaling deeper' },
]

function getScoringTable(mode: ScoringMode) {
  if (mode === 'fancred_edge') {
    return [
      { round: "Round of 64 (32)", pts: "1 + upset + leverage", total: "32+" },
      { round: "Round of 32 (16)", pts: "2 + upset + leverage", total: "32+" },
      { round: "Sweet 16 (8)", pts: "5 + upset + leverage", total: "40+" },
      { round: "Elite 8 (4)", pts: "10 + upset + leverage", total: "40+" },
      { round: "Final Four (2)", pts: "18 + upset + leverage", total: "36+" },
      { round: "Championship (1)", pts: "30 + upset + leverage", total: "30+" },
    ]
  }
  if (mode === 'momentum') {
    return [
      { round: "Round 1 (32)", pts: "1 + upset bonus", total: "32+" },
      { round: "Round 2 (16)", pts: "2 + upset bonus", total: "32+" },
      { round: "Sweet 16 (8)", pts: "4 + upset bonus", total: "32+" },
      { round: "Elite 8 (4)", pts: "8 + upset bonus", total: "32+" },
      { round: "Final Four (2)", pts: "16 + upset bonus", total: "32+" },
      { round: "Championship (1)", pts: "32 + upset bonus", total: "32+" },
    ]
  }
  if (mode === 'accuracy_boldness') {
    return [
      { round: "Round 1 (32)", pts: "1 + uniqueness bonus", total: "32+" },
      { round: "Round 2 (16)", pts: "2 + uniqueness bonus", total: "32+" },
      { round: "Sweet 16 (8)", pts: "4 + uniqueness bonus", total: "32+" },
      { round: "Elite 8 (4)", pts: "8 + uniqueness bonus", total: "32+" },
      { round: "Final Four (2)", pts: "16 + uniqueness bonus", total: "32+" },
      { round: "Championship (1)", pts: "32 + uniqueness bonus", total: "32+" },
    ]
  }
  if (mode === 'streak_survival') {
    return [
      { round: "Round 1 (32)", pts: "1 x streak mult", total: "32+" },
      { round: "Round 2 (16)", pts: "2 x streak mult", total: "32+" },
      { round: "Sweet 16 (8)", pts: "4 x streak mult", total: "32+" },
      { round: "Elite 8 (4)", pts: "8 x streak mult", total: "32+" },
      { round: "Final Four (2)", pts: "16 x streak mult", total: "32+" },
      { round: "Championship (1)", pts: "32 x streak mult", total: "32+" },
    ]
  }
  return [
    { round: "Round 1 (32)", pts: "1", total: "32" },
    { round: "Round 2 (16)", pts: "2", total: "32" },
    { round: "Sweet 16 (8)", pts: "4", total: "32" },
    { round: "Elite 8 (4)", pts: "8", total: "32" },
    { round: "Final Four (2)", pts: "16", total: "32" },
    { round: "Championship (1)", pts: "32", total: "32" },
  ]
}

function SettingsPanel({
  joinCode,
  isOwner,
  leagueId,
  maxManagers,
  scoringMode: initialScoringMode,
}: {
  joinCode: string
  isOwner: boolean
  leagueId: string
  maxManagers: number
  scoringMode: ScoringMode
}) {
  const [scoringMode, setScoringMode] = useState<ScoringMode>(initialScoringMode)
  const [saving, setSaving] = useState(false)

  async function updateScoringMode(mode: ScoringMode) {
    setScoringMode(mode)
    if (!isOwner) return
    setSaving(true)
    try {
      await fetch(`/api/bracket/leagues/${leagueId}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scoringMode: mode }),
      })
    } catch {}
    setSaving(false)
  }

  const scoring = getScoringTable(scoringMode)

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="px-4 py-3 flex items-center gap-4 text-sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Settings className="w-4 h-4" />
            Unlimited Brackets
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)' }}>Show Champ Pick</div>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Scoring Mode {saving && <span style={{ color: '#fb923c' }}>(saving...)</span>}
          </div>
          <div className="flex gap-2">
            {SCORING_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => isOwner && updateScoringMode(m.id)}
                className="flex-1 rounded-lg py-2 px-2 text-center transition-all"
                style={{
                  background: scoringMode === m.id ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${scoringMode === m.id ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: isOwner ? 'pointer' : 'default',
                  opacity: !isOwner && scoringMode !== m.id ? 0.4 : 1,
                }}
              >
                <div className="text-[10px] font-bold" style={{ color: scoringMode === m.id ? '#fb923c' : 'rgba(255,255,255,0.6)' }}>
                  {m.label}
                </div>
                <div className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
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
            {scoring.map((s) => (
              <tr key={s.round} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td className="px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.round}</td>
                <td className="text-center px-4 py-2 text-xs font-bold" style={{ color: '#fb923c' }}>{s.pts}</td>
                <td className="text-center px-4 py-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {scoringMode === 'fancred_edge' && (
          <div className="px-4 py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            Upset Delta: +min(8, seed diff) when underdog wins. Leverage: +base x (1 - league pick %) capped at +6. Insurance Token: protect 1 pick per bracket (if enabled).
          </div>
        )}
        {scoringMode === 'momentum' && (
          <div className="px-4 py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            Upset bonus scales with seed gap and round depth. Rewards correctly picking upsets deeper in the tournament.
          </div>
        )}
        {scoringMode === 'accuracy_boldness' && (
          <div className="px-4 py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            Uniqueness bonus rewards bold picks that fewer league members made. More unique correct picks earn more points.
          </div>
        )}
        {scoringMode === 'streak_survival' && (
          <div className="px-4 py-2 text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
            Streak multipliers: 2nd correct = 1.5x, 3rd = 2x, 4th+ = 2.5x. Consecutive correct picks compound your points.
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider px-4 py-2" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          Entry Controls
        </div>
        <EntryControlRow
          label="Allow Copy Bracket"
          description="Let members copy existing brackets"
          field="allowCopyBracket"
          isOwner={isOwner}
          leagueId={leagueId}
          initialValue={true}
        />
        <EntryControlRow
          label="Hide Picks Until Lock"
          description="Other members' picks hidden until tournament locks"
          field="pickVisibility"
          isOwner={isOwner}
          leagueId={leagueId}
          initialValue={false}
          valueMap={{ true: "hidden_until_lock", false: "visible" }}
        />
        {scoringMode === 'fancred_edge' && (
          <EntryControlRow
            label="Insurance Token"
            description="Each bracket gets 1 pick protected from damage"
            field="insuranceEnabled"
            isOwner={isOwner}
            leagueId={leagueId}
            initialValue={false}
          />
        )}
      </div>

      <a
        href={process.env.NEXT_PUBLIC_FANCRED_URL || "https://fancred.com"}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl p-3 text-center transition-all hover:opacity-80"
        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
      >
        <div className="text-xs font-semibold" style={{ color: '#818cf8' }}>
          Pay League Dues on FanCred &rarr;
        </div>
        <div className="text-[9px] mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Dues and payouts are handled on FanCred. This app only hosts brackets.
        </div>
      </a>

      <DonateSection />
    </div>
  )
}

function DonateSection() {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState(500)

  async function handleDonate(amountCents: number) {
    setLoading(true)
    try {
      const res = await fetch("/api/bracket/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {}
    setLoading(false)
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
      <div className="text-center space-y-1">
        <div className="text-xs font-semibold" style={{ color: '#f87171' }}>
          Support FanCred Brackets
        </div>
        <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          All brackets are free forever. Donations help keep it running.
        </div>
      </div>
      <div className="flex gap-2">
        {[{ label: "$3", value: 300 }, { label: "$5", value: 500 }, { label: "$10", value: 1000 }].map(p => (
          <button
            key={p.value}
            onClick={() => setAmount(p.value)}
            className="flex-1 rounded-lg py-2 text-xs font-bold transition"
            style={{
              background: amount === p.value ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${amount === p.value ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: amount === p.value ? '#f87171' : 'rgba(255,255,255,0.5)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => handleDonate(amount)}
        disabled={loading}
        className="w-full rounded-lg py-2 text-xs font-bold transition disabled:opacity-50"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        {loading ? "Processing..." : `Donate $${(amount / 100).toFixed(0)}`}
      </button>
    </div>
  )
}

function EntryControlRow({
  label,
  description,
  field,
  isOwner,
  leagueId,
  initialValue,
  valueMap,
}: {
  label: string
  description: string
  field: string
  isOwner: boolean
  leagueId: string
  initialValue: boolean
  valueMap?: Record<string, string>
}) {
  const [enabled, setEnabled] = useState(initialValue)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (!isOwner) return
    const newVal = !enabled
    setEnabled(newVal)
    setSaving(true)
    try {
      const value = valueMap ? valueMap[String(newVal)] : newVal
      await fetch(`/api/bracket/leagues/${leagueId}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
    } catch {}
    setSaving(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {label} {saving && <span className="text-[10px]" style={{ color: '#fb923c' }}>(saving...)</span>}
        </div>
        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{description}</div>
      </div>
      <button
        onClick={toggle}
        disabled={!isOwner}
        className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
        style={{
          background: enabled ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.08)',
          cursor: isOwner ? 'pointer' : 'default',
        }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{
            left: enabled ? '22px' : '2px',
            background: enabled ? '#fb923c' : 'rgba(255,255,255,0.3)',
          }}
        />
      </button>
    </div>
  )
}

const FEED_EVENT_STYLES: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  UPSET_BUSTED: { icon: '💥', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)', text: '#ef4444' },
  CHAMP_ELIMINATED: { icon: '💀', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  PERFECT_TRACKER: { icon: '✨', bg: 'rgba(251,146,60,0.06)', border: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  LEAD_CHANGE: { icon: '👑', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)', text: '#22c55e' },
  BIG_UPSET: { icon: '🚨', bg: 'rgba(234,179,8,0.06)', border: 'rgba(234,179,8,0.15)', text: '#eab308' },
}

function FeedTab({ tournamentId, leagueId }: { tournamentId: string; leagueId: string }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'league'>('all')

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ tournamentId, limit: '30' })
    if (tab === 'league') params.set('leagueId', leagueId)
    fetch(`/api/bracket/feed?${params}`)
      .then(r => r.json())
      .then(data => setEvents(data.events || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tournamentId, leagueId, tab])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(['all', 'league'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition"
            style={{
              background: tab === t ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${tab === t ? 'rgba(251,146,60,0.2)' : 'rgba(255,255,255,0.06)'}`,
              color: tab === t ? '#fb923c' : 'rgba(255,255,255,0.4)',
            }}
          >
            {t === 'all' ? 'Global Feed' : 'Pool Feed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading feed...</div>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-3xl">🏀</div>
          <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>No Events Yet</h3>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Bracket-busting moments will appear here as games are played.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event: any) => {
            const style = FEED_EVENT_STYLES[event.eventType] || FEED_EVENT_STYLES.BIG_UPSET
            const time = new Date(event.createdAt)
            const timeAgo = formatFeedTime(time)
            return (
              <div
                key={event.id}
                className="rounded-xl p-3.5 space-y-1.5 transition-all"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-xl flex-shrink-0">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: style.text }}>
                      {event.headline}
                    </div>
                    {event.detail && (
                      <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {event.detail}
                      </div>
                    )}
                    <div className="text-[10px] mt-1.5 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      <span>{timeAgo}</span>
                      {event.leagueId && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>Pool</span>}
                      {!event.leagueId && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)' }}>Global</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatFeedTime(d: Date): string {
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
        <div className="flex items-center px-3 py-2 text-[9px] font-semibold uppercase tracking-wider" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)' }}>
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="w-12 text-center">Pts</div>
          <div className="w-12 text-center">Acc%</div>
          <div className="w-12 text-center">Risk</div>
          <div className="w-12 text-center">%ile</div>
        </div>

        {rankings.map((r: any) => {
          const isMe = r.userId === currentUserId
          return (
            <div
              key={r.entryId}
              className="flex items-center px-3 py-2.5 transition"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: isMe ? 'rgba(251,146,60,0.06)' : undefined,
              }}
            >
              <div className="w-8 text-center text-xs font-bold" style={{ color: r.rank <= 3 ? '#fb923c' : 'rgba(255,255,255,0.4)' }}>
                {r.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate" style={{ color: isMe ? '#fb923c' : 'rgba(255,255,255,0.8)' }}>
                  {r.displayName || 'Anonymous'}
                  {isMe && <span className="ml-1 text-[10px]" style={{ color: 'rgba(251,146,60,0.6)' }}>(you)</span>}
                </div>
                <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {r.entryName} • {r.championPick || '—'}
                </div>
              </div>
              <div className="w-12 text-center text-xs font-bold" style={{ color: '#fb923c' }}>
                {r.totalPoints}
              </div>
              <div className="w-12 text-center text-[10px]" style={{ color: r.accuracy >= 60 ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                {r.accuracy}%
              </div>
              <div className="w-12 text-center text-[10px]" style={{ color: r.riskIndex >= 30 ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>
                {r.riskIndex}%
              </div>
              <div className="w-12 text-center text-[10px]" style={{ color: r.percentile >= 90 ? '#fb923c' : 'rgba(255,255,255,0.3)' }}>
                {r.percentile}
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

function PublicPoolsTab({ tournamentId }: { tournamentId: string }) {
  const [pools, setPools] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [filterMode, setFilterMode] = useState<string>("")
  const [joining, setJoining] = useState<string | null>(null)

  async function fetchPools(p: number) {
    setLoading(true)
    try {
      let url = `/api/bracket/public-pools?tournamentId=${tournamentId}&page=${p}&limit=20`
      if (filterMode) url += `&scoringMode=${filterMode}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setPools(data.pools ?? [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 0)
      }
    } catch {}
    setLoading(false)
  }

  async function joinPool(joinCode: string) {
    setJoining(joinCode)
    try {
      const res = await fetch('/api/bracket/leagues/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.leagueId) {
          window.location.href = `/brackets/leagues/${data.leagueId}`
        }
      }
    } catch {}
    setJoining(null)
  }

  useEffect(() => { fetchPools(page) }, [tournamentId, page, filterMode])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Public Pools
        </div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {total} pool{total !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: '', label: 'All' }, ...SCORING_MODES].map(m => (
          <button
            key={m.id}
            onClick={() => { setFilterMode(m.id); setPage(1) }}
            className="text-[10px] font-semibold px-3 py-1.5 rounded-full whitespace-nowrap transition"
            style={{
              background: filterMode === m.id ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.03)',
              color: filterMode === m.id ? '#fb923c' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${filterMode === m.id ? 'rgba(251,146,60,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading pools...</div>
        </div>
      ) : pools.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Trophy className="h-10 w-10 mx-auto" style={{ color: 'rgba(251,146,60,0.3)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>No Public Pools</h3>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No public pools available yet. Create one and make it public!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pools.map((pool: any) => (
            <div
              key={pool.id}
              className="rounded-xl p-3 transition"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{pool.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      by {pool.ownerName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,146,60,0.08)', color: '#fb923c' }}>
                      {SCORING_MODES.find(m => m.id === pool.scoringMode)?.label || pool.scoringMode}
                    </span>
                    {pool.memberCount >= 50 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>
                        Popular
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      {pool.memberCount}
                    </div>
                    <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      / {pool.maxManagers}
                    </div>
                  </div>
                  <button
                    onClick={() => joinPool(pool.joinCode)}
                    disabled={joining === pool.joinCode}
                    className="text-[11px] font-semibold px-4 py-1.5 rounded-lg transition"
                    style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}
                  >
                    {joining === pool.joinCode ? '...' : 'Join'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

const QUICK_REACTIONS = ['🔥', '💀', '😂', '🏀', '👀', '💪']

function formatChatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
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
  const [unreadCount, setUnreadCount] = useState(0)
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSeenCount = useRef(0)

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/bracket/leagues/${leagueId}/chat`)
      if (res.ok) {
        const data = await res.json()
        const msgs = data.messages ?? []
        setMessages(msgs)
        if (msgs.length > 0) {
          const last = msgs[msgs.length - 1]
          const name = last.user?.displayName || last.user?.email || "Someone"
          setLatestMessage(`${name}: ${last.message?.length > 30 ? last.message.slice(0, 30) + "..." : last.message}`)
        }
        if (!expanded && msgs.length > lastSeenCount.current) {
          setUnreadCount(msgs.length - lastSeenCount.current)
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

  async function sendReaction(reaction: string) {
    setShowReactions(null)
    if (sending) return
    setSending(true)
    try {
      await fetch(`/api/bracket/leagues/${leagueId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: reaction }),
      })
      fetchMessages()
    } catch {}
    setSending(false)
  }

  useEffect(() => { fetchMessages() }, [leagueId])

  useEffect(() => {
    if (expanded) {
      lastSeenCount.current = messages.length
      setUnreadCount(0)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [expanded, messages.length])

  useEffect(() => {
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [leagueId])

  const onlineCount = Math.min(members.length, Math.max(1, Math.floor(members.length * 0.3)))

  if (!expanded) {
    return (
      <div
        onClick={() => { setExpanded(true); fetchMessages() }}
        className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 flex items-center gap-3 cursor-pointer transition-all"
        style={{ background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="relative flex-shrink-0">
          <MessageCircle className="h-5 w-5 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: '#ef4444' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Chat</span>
            <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
              {onlineCount} online
            </span>
          </div>
          {latestMessage ? (
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{latestMessage}</p>
          ) : (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Be the first to say hi</p>
          )}
        </div>
        <div className="flex -space-x-1.5 flex-shrink-0">
          {members.slice(0, 3).map(m => (
            <div
              key={m.id}
              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '2px solid #0d1117' }}
            >
              {(m.user.displayName || m.user.email || '?').slice(0, 1).toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30" style={{ background: 'rgba(13,17,23,0.98)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.08)', maxHeight: '60vh' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-white" />
          <span className="text-sm font-semibold text-white">Pool Chat</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
            {members.length} members
          </span>
        </div>
        <button onClick={() => setExpanded(false)} className="p-1.5 rounded-lg transition hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-3 space-y-2.5" style={{ maxHeight: 'calc(60vh - 100px)' }}>
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-2">
            <MessageCircle className="h-8 w-8 mx-auto" style={{ color: 'rgba(255,255,255,0.08)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>No messages yet. Start the trash talk!</p>
          </div>
        )}
        {messages.map((m: any, idx: number) => {
          const isMe = m.user?.id === currentUserId || m.userId === currentUserId
          const prevMsg = idx > 0 ? messages[idx - 1] : null
          const sameSender = prevMsg && (prevMsg.user?.id || prevMsg.userId) === (m.user?.id || m.userId)
          const isReaction = QUICK_REACTIONS.includes(m.message)

          let systemMsg: { type: string; content: string } | null = null
          try {
            const parsed = JSON.parse(m.message)
            if (parsed.isSystem) systemMsg = parsed
          } catch {}

          if (systemMsg) {
            const typeColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
              UPSET_ALERT: { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', text: '#fb923c', icon: '🚨' },
              BRACKET_BUSTED: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444', icon: '💥' },
              BIG_SWING: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', text: '#818cf8', icon: '📊' },
              LEAD_CHANGE: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', text: '#22c55e', icon: '👑' },
              TOURNAMENT_READY: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#3b82f6', icon: '🏀' },
              BRACKET_LOCKED: { bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)', text: '#eab308', icon: '🔒' },
            }
            const style = typeColors[systemMsg.type] || typeColors.TOURNAMENT_READY
            return (
              <div key={m.id} className="flex justify-center my-1">
                <div className="rounded-lg px-3 py-1.5 text-center max-w-[85%]" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                  <span className="text-[11px] font-semibold" style={{ color: style.text }}>
                    {style.icon} {systemMsg.content}
                  </span>
                </div>
              </div>
            )
          }

          if (isReaction) {
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : ''}`}>
                <div className="flex items-center gap-1.5">
                  {!isMe && !sameSender && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold" style={{ background: 'rgba(251,146,60,0.2)', color: '#fb923c' }}>
                      {(m.user?.displayName || m.user?.email || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span className="text-lg">{m.message}</span>
                </div>
              </div>
            )
          }

          return (
            <div key={m.id} className={`flex gap-2 ${isMe ? "justify-end" : ""} group`}>
              {!isMe && !sameSender && (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: 'rgba(251,146,60,0.2)' }}>
                  {(m.user?.displayName || m.user?.email || "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              {!isMe && sameSender && <div className="w-6 flex-shrink-0" />}
              <div className="max-w-[75%] relative">
                {!isMe && !sameSender && (
                  <div className="text-[10px] font-semibold mb-0.5 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {m.user?.displayName || m.user?.email?.split('@')[0] || "Unknown"}
                    {m.createdAt && (
                      <span style={{ color: 'rgba(255,255,255,0.15)' }}>{formatChatTime(m.createdAt)}</span>
                    )}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${isMe ? 'rounded-br-md' : 'rounded-bl-md'}`}
                  style={{
                    background: isMe ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)',
                    color: isMe ? '#fbbf24' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  {m.message}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === m.id ? null : m.id) }}
                  className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full flex items-center justify-center transition-opacity text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.1)' }}
                >
                  +
                </button>
                {showReactions === m.id && (
                  <div className="absolute -top-8 right-0 flex items-center gap-0.5 rounded-full px-1.5 py-1 z-10" style={{ background: 'rgba(30,30,40,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {QUICK_REACTIONS.map(r => (
                      <button key={r} onClick={() => sendReaction(r)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10 transition text-sm">
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-1 flex-shrink-0">
          {QUICK_REACTIONS.slice(0, 3).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => sendReaction(r)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition text-sm hover:bg-white/10"
            >
              {r}
            </button>
          ))}
        </div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          maxLength={500}
          className="flex-1 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder-white/20"
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
