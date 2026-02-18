"use client"

import { useMemo, useState } from "react"
import { useBracketLive } from "@/lib/hooks/useBracketLive"

type Game = {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string | null
  startTime: string | null
}

type Node = {
  id: string
  slot: string
  round: number
  region: string | null
  seedHome: number | null
  seedAway: number | null
  homeTeamName: string | null
  awayTeamName: string | null
  sportsGameId: string | null
  game: Game | null
}

type Props = {
  tournamentId: string
  leagueId?: string
  entryId: string
  nodes: Node[]
  initialPicks: Record<string, string | null>
}

const REGION_ORDER = ["East", "West", "South", "Midwest"]
const ROUND_COLS = [
  { round: 1, label: "Round of 64" },
  { round: 2, label: "Round of 32" },
  { round: 3, label: "Sweet 16" },
  { round: 4, label: "Elite 8" },
]

function teamLabel(name: string | null, seed: number | null) {
  if (!name) return "TBD"
  return seed != null ? `(${seed}) ${name}` : name
}

function isPickLocked(node: Node) {
  if (!node.game?.startTime) return false
  return new Date(node.game.startTime) <= new Date()
}

export function BracketProView({ tournamentId, leagueId, entryId, nodes, initialPicks }: Props) {
  const { data: live } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 12000 })

  const [picks, setPicks] = useState<Record<string, string | null>>(initialPicks)
  const [savingNode, setSavingNode] = useState<string | null>(null)

  const nodesWithLive = useMemo(() => {
    const gameById = new Map((live?.games ?? []).map((g) => [g.id, g]))
    return nodes.map((n) => {
      const g = n.sportsGameId ? gameById.get(n.sportsGameId) : null
      return { ...n, game: g ?? n.game ?? null }
    })
  }, [nodes, live?.games])

  const { firstFour, finals, byRegion } = useMemo(() => {
    const ff: Node[] = []
    const fin: Node[] = []
    const reg: Record<string, Node[]> = {}
    REGION_ORDER.forEach((r) => (reg[r] = []))

    for (const n of nodesWithLive) {
      if (n.round === 0) ff.push(n)
      else if (!n.region) fin.push(n)
      else reg[n.region]?.push(n)
    }

    for (const r of REGION_ORDER) reg[r].sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    ff.sort((a, b) => a.slot.localeCompare(b.slot))
    fin.sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))

    return { firstFour: ff, finals: fin, byRegion: reg }
  }, [nodesWithLive])

  async function submitPick(node: Node, teamName: string) {
    if (!teamName) return
    if (isPickLocked(node)) return

    const prev = picks[node.id] ?? null
    setPicks((p) => ({ ...p, [node.id]: teamName }))
    setSavingNode(node.id)

    const res = await fetch(`/api/bracket/entries/${entryId}/pick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeId: node.id, pickedTeamName: teamName }),
    })

    setSavingNode(null)

    if (!res.ok) {
      setPicks((p) => ({ ...p, [node.id]: prev }))
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? "Pick failed")
    }
  }

  function GameCard({ node }: { node: Node }) {
    const picked = picks[node.id] ?? null
    const locked = isPickLocked(node)

    const homeName = node.homeTeamName
    const awayName = node.awayTeamName

    const homePicked = !!homeName && picked === homeName
    const awayPicked = !!awayName && picked === awayName

    return (
      <div className="rounded-xl border border-white/10 bg-black/20 backdrop-blur p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-gray-300">{node.slot}</div>
          {node.game?.status && (
            <div className="text-[11px] text-gray-300">
              {node.game.status}
            </div>
          )}
        </div>

        <div className="mt-2 space-y-2">
          <button
            disabled={!homeName || locked}
            onClick={() => homeName && submitPick(node, homeName)}
            className={[
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition",
              locked ? "opacity-60 cursor-not-allowed" : "hover:border-white/30",
              homePicked ? "border-yellow-400/70 bg-yellow-400/10" : "border-white/10",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{teamLabel(homeName, node.seedHome)}</span>
              <span className="text-xs text-gray-200">{node.game?.homeScore ?? "-"}</span>
            </div>
          </button>

          <button
            disabled={!awayName || locked}
            onClick={() => awayName && submitPick(node, awayName)}
            className={[
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition",
              locked ? "opacity-60 cursor-not-allowed" : "hover:border-white/30",
              awayPicked ? "border-yellow-400/70 bg-yellow-400/10" : "border-white/10",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{teamLabel(awayName, node.seedAway)}</span>
              <span className="text-xs text-gray-200">{node.game?.awayScore ?? "-"}</span>
            </div>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span>{locked ? "Locked" : savingNode === node.id ? "Saving..." : "Pick winner"}</span>
          <span>{node.game?.startTime ? new Date(node.game.startTime).toLocaleString() : ""}</span>
        </div>
      </div>
    )
  }

  function RegionGrid({ region }: { region: string }) {
    const list = byRegion[region] ?? []
    const byRound: Record<number, Node[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const n of list) if (byRound[n.round]) byRound[n.round].push(n)
    Object.values(byRound).forEach((arr) => arr.sort((a, b) => a.slot.localeCompare(b.slot)))

    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-black/10 p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white">{region}</div>
          <div className="text-xs text-gray-300">Live updating</div>
        </div>

        <div className="mt-4 hidden lg:block overflow-x-auto">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(260px, 1fr))" }}>
            {ROUND_COLS.map((c) => (
              <div key={c.round} className="space-y-3">
                <div className="text-xs font-semibold text-gray-200">{c.label}</div>
                {byRound[c.round].map((n) => <GameCard key={n.id} node={n} />)}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {ROUND_COLS.map((c) => (
              <div key={c.round} className="min-w-[88%] space-y-3">
                <div className="sticky top-0 z-10 bg-black/40 backdrop-blur rounded-xl px-3 py-2 text-xs font-semibold text-gray-200 border border-white/10">
                  {c.label}
                </div>
                {byRound[c.round].map((n) => <GameCard key={n.id} node={n} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function FinalsBlock() {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-black/10 p-4">
        <div className="text-lg font-semibold text-white">Final Four & Championship</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {finals.map((n) => <GameCard key={n.id} node={n} />)}
        </div>
      </div>
    )
  }

  function FirstFourBlock() {
    if (!firstFour.length) return null
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-black/10 p-4">
        <div className="text-lg font-semibold text-white">First Four</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {firstFour.map((n) => <GameCard key={n.id} node={n} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <FirstFourBlock />
      <div className="grid gap-6">
        {REGION_ORDER.map((r) => <RegionGrid key={r} region={r} />)}
      </div>
      <FinalsBlock />
    </div>
  )
}
