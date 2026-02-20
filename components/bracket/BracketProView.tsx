"use client"

import { useMemo, useState, useCallback } from "react"
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
  nextNodeId: string | null
  nextNodeSide: string | null
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

function buildSeedMap(nodes: Node[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const n of nodes) {
    if (n.round === 1) {
      if (n.homeTeamName && n.seedHome != null) map.set(n.homeTeamName, n.seedHome)
      if (n.awayTeamName && n.seedAway != null) map.set(n.awayTeamName, n.seedAway)
    }
  }
  return map
}

function computeEffectiveTeams(
  nodes: Node[],
  picks: Record<string, string | null>
): Map<string, { home: string | null; away: string | null }> {
  const effective = new Map<string, { home: string | null; away: string | null }>()

  for (const n of nodes) {
    effective.set(n.id, {
      home: n.homeTeamName,
      away: n.awayTeamName,
    })
  }

  const sorted = [...nodes].sort((a, b) => a.round - b.round)

  for (const n of sorted) {
    const picked = picks[n.id]
    if (!picked || !n.nextNodeId || !n.nextNodeSide) continue

    const current = effective.get(n.nextNodeId)
    if (!current) continue

    if (n.nextNodeSide === "home") {
      effective.set(n.nextNodeId, { ...current, home: picked })
    } else {
      effective.set(n.nextNodeId, { ...current, away: picked })
    }
  }

  return effective
}

function findInvalidDownstreamPicks(
  nodes: Node[],
  newPicks: Record<string, string | null>
): string[] {
  const newEffective = computeEffectiveTeams(nodes, newPicks)
  const toClear: string[] = []

  for (const n of nodes) {
    const pick = newPicks[n.id]
    if (!pick) continue

    const eff = newEffective.get(n.id)
    if (!eff) continue

    if (pick !== eff.home && pick !== eff.away) {
      toClear.push(n.id)
    }
  }

  return toClear
}

function cascadeClearInvalidPicks(
  nodes: Node[],
  basePicks: Record<string, string | null>
): Record<string, string | null> {
  let current = { ...basePicks }
  let maxIter = 10
  while (maxIter-- > 0) {
    const invalid = findInvalidDownstreamPicks(nodes, current)
    if (invalid.length === 0) break
    for (const id of invalid) current[id] = null
  }
  return current
}

export function BracketProView({ tournamentId, leagueId, entryId, nodes, initialPicks }: Props) {
  const { data: live } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 12000 })

  const [picks, setPicks] = useState<Record<string, string | null>>(initialPicks)
  const [savingNode, setSavingNode] = useState<string | null>(null)

  const seedMap = useMemo(() => buildSeedMap(nodes), [nodes])

  const nodesWithLive = useMemo(() => {
    const gameById = new Map((live?.games ?? []).map((g) => [g.id, g]))
    return nodes.map((n) => {
      const g = n.sportsGameId ? gameById.get(n.sportsGameId) : null
      return { ...n, game: g ?? n.game ?? null }
    })
  }, [nodes, live?.games])

  const effective = useMemo(
    () => computeEffectiveTeams(nodesWithLive, picks),
    [nodesWithLive, picks]
  )

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

  const submitPick = useCallback(async (node: Node, teamName: string) => {
    if (!teamName) return
    if (isPickLocked(node)) return

    const prev = picks[node.id] ?? null

    const tentative = { ...picks, [node.id]: teamName }
    const cleaned = cascadeClearInvalidPicks(nodesWithLive, tentative)
    setPicks(cleaned)
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
  }, [picks, nodesWithLive, effective, entryId])

  function GameCard({ node }: { node: Node }) {
    const picked = picks[node.id] ?? null
    const locked = isPickLocked(node)

    const eff = effective.get(node.id)
    const homeName = eff?.home ?? node.homeTeamName
    const awayName = eff?.away ?? node.awayTeamName

    const homeSeed = homeName ? (seedMap.get(homeName) ?? null) : node.seedHome
    const awaySeed = awayName ? (seedMap.get(awayName) ?? null) : node.seedAway

    const homePicked = !!homeName && picked === homeName
    const awayPicked = !!awayName && picked === awayName

    const isPropagated = node.round > 1 && (!node.homeTeamName || !node.awayTeamName)

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
              locked ? "opacity-60 cursor-not-allowed" : homeName ? "hover:border-white/30 cursor-pointer" : "cursor-default",
              homePicked ? "border-yellow-400/70 bg-yellow-400/10" : "border-white/10",
              !homeName && isPropagated ? "opacity-40" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate ${!homeName ? "italic text-white/30" : ""}`}>
                {teamLabel(homeName, homeSeed)}
              </span>
              <span className="text-xs text-gray-200">{node.game?.homeScore ?? "-"}</span>
            </div>
          </button>

          <button
            disabled={!awayName || locked}
            onClick={() => awayName && submitPick(node, awayName)}
            className={[
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition",
              locked ? "opacity-60 cursor-not-allowed" : awayName ? "hover:border-white/30 cursor-pointer" : "cursor-default",
              awayPicked ? "border-yellow-400/70 bg-yellow-400/10" : "border-white/10",
              !awayName && isPropagated ? "opacity-40" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate ${!awayName ? "italic text-white/30" : ""}`}>
                {teamLabel(awayName, awaySeed)}
              </span>
              <span className="text-xs text-gray-200">{node.game?.awayScore ?? "-"}</span>
            </div>
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span>{locked ? "Locked" : savingNode === node.id ? "Saving..." : homeName && awayName ? "Pick winner" : "Waiting for picks"}</span>
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
