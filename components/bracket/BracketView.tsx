"use client"

import { useMemo, useState } from "react"

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
  game: Game | null
}

type Props = {
  nodes: Node[]
  entryId: string
  picks: Record<string, string | null>
}

const REGION_ORDER = ["East", "West", "South", "Midwest"]
const ROUND_LABEL: Record<number, string> = {
  0: "First Four",
  1: "R64",
  2: "R32",
  3: "S16",
  4: "E8",
  5: "FF",
  6: "Final",
}

function teamLabel(name: string | null, seed: number | null) {
  if (!name) return "TBD"
  if (seed == null) return name
  return `(${seed}) ${name}`
}

export function BracketView({ nodes, entryId, picks }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [localPicks, setLocalPicks] = useState<Record<string, string | null>>(picks)

  const { byRegion, finalRounds, firstFour } = useMemo(() => {
    const regionMap: Record<string, Node[]> = {}
    for (const r of REGION_ORDER) regionMap[r] = []

    const ff: Node[] = []
    const finals: Node[] = []

    for (const n of nodes) {
      if (n.round === 0) ff.push(n)
      else if (!n.region) finals.push(n)
      else regionMap[n.region]?.push(n)
    }

    for (const r of REGION_ORDER) {
      regionMap[r] = (regionMap[r] ?? []).sort(
        (a, b) => a.round - b.round || a.slot.localeCompare(b.slot)
      )
    }

    finals.sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))

    return {
      byRegion: regionMap,
      finalRounds: finals,
      firstFour: ff.sort((a, b) => a.slot.localeCompare(b.slot)),
    }
  }, [nodes])

  async function pick(nodeId: string, pickedTeamName: string) {
    setSaving(nodeId)
    setLocalPicks((prev) => ({ ...prev, [nodeId]: pickedTeamName }))

    try {
      const res = await fetch(`/api/bracket/entries/${entryId}/pick`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nodeId, pickedTeamName }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? "Failed to save pick")
        setLocalPicks((prev) => ({ ...prev, [nodeId]: picks[nodeId] ?? null }))
      }
    } catch {
      alert("Network error — pick not saved")
      setLocalPicks((prev) => ({ ...prev, [nodeId]: picks[nodeId] ?? null }))
    } finally {
      setSaving(null)
    }
  }

  function NodeCard({ n }: { n: Node }) {
    const picked = localPicks[n.id] ?? null
    const g = n.game

    const home = teamLabel(n.homeTeamName, n.seedHome)
    const away = teamLabel(n.awayTeamName, n.seedAway)

    const homePicked = picked != null && n.homeTeamName != null && picked === n.homeTeamName
    const awayPicked = picked != null && n.awayTeamName != null && picked === n.awayTeamName

    const isLocked = g?.startTime ? new Date(g.startTime) <= new Date() : false

    return (
      <div className="rounded-xl border p-3 shadow-sm" style={{ background: '#252d3d', borderColor: 'rgba(255,255,255,0.10)' }}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {ROUND_LABEL[n.round] ?? `R${n.round}`}
          </div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {n.slot}
          </div>
        </div>

        <div className="mt-2 space-y-2">
          <button
            disabled={!n.homeTeamName || saving === n.id || isLocked}
            onClick={() => n.homeTeamName && pick(n.id, n.homeTeamName)}
            className={[
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors",
              homePicked
                ? "font-medium"
                : "",
              !n.homeTeamName || isLocked
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer",
            ].join(" ")}
            style={{
              borderColor: homePicked ? '#3b82f6' : 'rgba(255,255,255,0.10)',
              background: homePicked ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{home}</span>
              {g && (
                <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {g.homeScore ?? "-"}
                </span>
              )}
            </div>
          </button>

          <button
            disabled={!n.awayTeamName || saving === n.id || isLocked}
            onClick={() => n.awayTeamName && pick(n.id, n.awayTeamName)}
            className={[
              "w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors",
              awayPicked
                ? "font-medium"
                : "",
              !n.awayTeamName || isLocked
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer",
            ].join(" ")}
            style={{
              borderColor: awayPicked ? '#3b82f6' : 'rgba(255,255,255,0.10)',
              background: awayPicked ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{away}</span>
              {g && (
                <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {g.awayScore ?? "-"}
                </span>
              )}
            </div>
          </button>
        </div>

        {g && (
          <div className="mt-2 text-xs flex items-center justify-between" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span className="truncate">{g.status ?? "—"}</span>
            <span className="truncate">
              {g.startTime
                ? new Date(g.startTime).toLocaleString()
                : ""}
            </span>
          </div>
        )}

        {isLocked && (
          <div className="mt-1 text-[11px] font-medium" style={{ color: '#fbbf24' }}>
            Locked
          </div>
        )}
      </div>
    )
  }

  function RegionBlock({ region, list }: { region: string; list: Node[] }) {
    const rounds = [1, 2, 3, 4]
    const byRound: Record<number, Node[]> = {}
    for (const r of rounds) byRound[r] = []
    for (const n of list) if (n.region === region) byRound[n.round]?.push(n)
    for (const r of rounds)
      byRound[r].sort((a, b) => a.slot.localeCompare(b.slot))

    return (
      <div className="rounded-2xl border p-4" style={{ background: '#1a2030', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {region}
        </div>
        <div className="mt-4 overflow-x-auto">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "repeat(4, minmax(240px, 1fr))",
            }}
          >
            {rounds.map((r) => (
              <div key={r} className="space-y-3">
                <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {ROUND_LABEL[r]}
                </div>
                {byRound[r].map((n) => (
                  <NodeCard key={n.id} n={n} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ background: '#141b2d' }}>
      {firstFour.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ background: '#1a2030', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
            First Four
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {firstFour.map((n) => (
              <NodeCard key={n.id} n={n} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {REGION_ORDER.map((r) => (
          <RegionBlock key={r} region={r} list={byRegion[r] ?? []} />
        ))}
      </div>

      <div className="rounded-2xl border p-4" style={{ background: '#1a2030', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Final Four & Championship
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {finalRounds.map((n) => (
            <NodeCard key={n.id} n={n} />
          ))}
        </div>
      </div>
    </div>
  )
}
