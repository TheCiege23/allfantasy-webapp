"use client"

import { useMemo, useState, useCallback } from "react"
import { Timer, Trophy } from "lucide-react"
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
  { round: 1, label: "R64" },
  { round: 2, label: "R32" },
  { round: 3, label: "S16" },
  { round: 4, label: "E8" },
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

  const openDate = useMemo(() => {
    const starts = nodesWithLive
      .map((n) => (n.game?.startTime ? new Date(n.game.startTime).getTime() : null))
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b)
    if (!starts.length) return "TBD"
    return new Date(starts[0]).toLocaleDateString(undefined, { month: "long", day: "numeric" })
  }, [nodesWithLive])

  const waitingForSelection = useMemo(() => {
    const seeded = nodesWithLive.filter((n) => n.round === 1 && (n.homeTeamName || n.awayTeamName)).length
    return seeded < 8
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

  function GameCard({ node, compact = false }: { node: Node; compact?: boolean }) {
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
      <div className="rounded-lg border border-slate-500/30 bg-slate-700/45 p-2 shadow-sm backdrop-blur">
        {!compact && (
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-slate-300">{node.slot}</div>
            {node.game?.status && <div className="text-[10px] text-slate-300">{node.game.status}</div>}
          </div>
        )}

        <div className="mt-2 space-y-2">
          <button
            disabled={!homeName || locked}
            onClick={() => homeName && submitPick(node, homeName)}
            className={[
              "w-full rounded-md border px-2 py-1.5 text-left text-xs transition",
              locked ? "cursor-not-allowed opacity-60" : homeName ? "hover:border-cyan-300/70 cursor-pointer" : "cursor-default",
              homePicked
                ? "border-cyan-300/80 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white"
                : "border-slate-400/30 bg-slate-800/40 text-slate-200",
              !homeName && isPropagated ? "opacity-40" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate ${!homeName ? "italic text-white/30" : ""}`}>
                {teamLabel(homeName, homeSeed)}
              </span>
              <span className="text-[10px] text-slate-200">{node.game?.homeScore ?? "-"}</span>
            </div>
          </button>

          <button
            disabled={!awayName || locked}
            onClick={() => awayName && submitPick(node, awayName)}
            className={[
              "w-full rounded-md border px-2 py-1.5 text-left text-xs transition",
              locked ? "cursor-not-allowed opacity-60" : awayName ? "hover:border-cyan-300/70 cursor-pointer" : "cursor-default",
              awayPicked
                ? "border-cyan-300/80 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white"
                : "border-slate-400/30 bg-slate-800/40 text-slate-200",
              !awayName && isPropagated ? "opacity-40" : "",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate ${!awayName ? "italic text-white/30" : ""}`}>
                {teamLabel(awayName, awaySeed)}
              </span>
              <span className="text-[10px] text-slate-200">{node.game?.awayScore ?? "-"}</span>
            </div>
          </button>
        </div>

        {!compact && (
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>{locked ? "Locked" : savingNode === node.id ? "Saving..." : homeName && awayName ? "Pick winner" : "Waiting for picks"}</span>
            <span>{node.game?.startTime ? new Date(node.game.startTime).toLocaleString() : ""}</span>
          </div>
        )}
      </div>
    )
  }

  function RegionMini({ region }: { region: string }) {
    const list = byRegion[region] ?? []
    const byRound: Record<number, Node[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const n of list) if (byRound[n.round]) byRound[n.round].push(n)
    Object.values(byRound).forEach((arr) => arr.sort((a, b) => a.slot.localeCompare(b.slot)))

    return (
      <div className="rounded-xl border border-slate-600/30 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100">{region}</div>
          <div className="text-[10px] text-slate-400">Live</div>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, minmax(110px, 1fr))" }}>
          {ROUND_COLS.map((c) => (
            <div key={`${region}-${c.round}`} className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</div>
              {byRound[c.round].map((n) => (
                <GameCard key={n.id} node={n} compact />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function FinalsCenter() {
    return (
      <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-slate-800/70 to-slate-900/60 p-3">
        <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Championship</div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/40 bg-cyan-500/10 text-cyan-200">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          {finals.map((n) => (
            <GameCard key={n.id} node={n} />
          ))}
          {finals.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-500/40 p-3 text-center text-xs text-slate-400">Final Four slots will appear here</div>
          )}
        </div>
      </div>
    )
  }

  function FirstFourBlock() {
    if (!firstFour.length) return null
    return (
      <div className="rounded-2xl border border-slate-600/30 bg-slate-900/40 p-4">
        <div className="text-sm font-semibold text-slate-200">First Four</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {firstFour.map((n) => <GameCard key={n.id} node={n} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-600/30 bg-gradient-to-r from-indigo-950/80 via-slate-800/70 to-slate-800/80 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-slate-500/30 bg-slate-700/40 p-2 text-slate-200">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">Brackets open on {openDate}</div>
            <div className="text-sm text-slate-300">{waitingForSelection ? "Waiting for Selection Sunday" : "Make your picks before games lock"}</div>
          </div>
        </div>
      </div>

      <FirstFourBlock />

      <div className="hidden xl:grid grid-cols-[1fr_320px_1fr] gap-4 rounded-2xl border border-slate-700/30 bg-[#13163b]/70 p-4">
        <div className="space-y-4">
          <RegionMini region="West" />
          <RegionMini region="East" />
        </div>
        <FinalsCenter />
        <div className="space-y-4">
          <RegionMini region="South" />
          <RegionMini region="Midwest" />
        </div>
      </div>

      <div className="xl:hidden space-y-4">
        {REGION_ORDER.map((region) => (
          <RegionMini key={region} region={region} />
        ))}
        <FinalsCenter />
      </div>
    </div>
  )
}
