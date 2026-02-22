"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { Timer, Trophy, ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
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

const ALL_REGIONS = ["West", "East", "South", "Midwest"]
const REGION_ABBREV: Record<string, string> = { West: "W", East: "E", South: "S", Midwest: "MW" }

const CW = 110
const CH = 34
const TH = 17
const VG = 6
const CG = 20
const REGION_H = 8 * CH + 7 * VG
const REGION_W = 4 * CW + 3 * CG
const REGION_V_GAP = 36
const CENTER_W = 160
const FULL_H = 2 * REGION_H + REGION_V_GAP
const FULL_W = 2 * REGION_W + CENTER_W

function calcCenters(count: number): number[] {
  const c: number[] = []
  for (let i = 0; i < count; i++) c.push(i * (CH + VG) + TH)
  return c
}

function mergedCenters(prev: number[]): number[] {
  const c: number[] = []
  for (let i = 0; i < prev.length; i += 2) {
    c.push((prev[i] + prev[i + 1]) / 2)
  }
  return c
}

function regionPositions() {
  const r1 = calcCenters(8)
  const r2 = mergedCenters(r1)
  const r3 = mergedCenters(r2)
  const r4 = mergedCenters(r3)
  return { 1: r1, 2: r2, 3: r3, 4: r4 }
}

const POS = regionPositions()

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
    effective.set(n.id, { home: n.homeTeamName, away: n.awayTeamName })
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

function cascadeClearInvalidPicks(
  nodes: Node[],
  basePicks: Record<string, string | null>
): Record<string, string | null> {
  let current = { ...basePicks }
  let maxIter = 10
  while (maxIter-- > 0) {
    const recomputed = computeEffectiveTeams(nodes, current)
    let changed = false
    for (const n of nodes) {
      const pick = current[n.id]
      if (!pick) continue
      const eff = recomputed.get(n.id)
      if (!eff) continue
      if (pick !== eff.home && pick !== eff.away) {
        current[n.id] = null
        changed = true
      }
    }
    if (!changed) break
  }
  return current
}

function MiniCell({
  node, picks, seedMap, effective, locked, onPick, x, y,
}: {
  node: Node
  picks: Record<string, string | null>
  seedMap: Map<string, number>
  effective: Map<string, { home: string | null; away: string | null }>
  locked: boolean
  onPick: (node: Node, team: string) => void
  x: number
  y: number
}) {
  const picked = picks[node.id] ?? null
  const eff = effective.get(node.id)
  const homeName = eff?.home ?? node.homeTeamName
  const awayName = eff?.away ?? node.awayTeamName
  const homeSeed = homeName ? (seedMap.get(homeName) ?? node.seedHome) : node.seedHome
  const awaySeed = awayName ? (seedMap.get(awayName) ?? node.seedAway) : node.seedAway
  const homePicked = !!homeName && picked === homeName
  const awayPicked = !!awayName && picked === awayName
  const canClick = !locked

  function TeamRow({ name, seed, isPicked, side }: {
    name: string | null; seed: number | null; isPicked: boolean; side: 'home' | 'away'
  }) {
    const clickable = canClick && !!name
    return (
      <button
        disabled={!clickable}
        onClick={() => name && onPick(node, name)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'left',
          height: TH,
          background: isPicked ? 'rgba(56,189,248,0.12)' : 'transparent',
          borderBottom: side === 'home' ? '1px solid rgba(255,255,255,0.04)' : undefined,
          cursor: clickable ? 'pointer' : 'default',
          paddingLeft: 5,
          paddingRight: 5,
          gap: 4,
          border: 'none',
          outline: 'none',
        }}
      >
        {seed != null && (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', width: 12, flexShrink: 0, textAlign: 'right' }}>
            {seed}
          </span>
        )}
        <span style={{
          fontSize: 10,
          fontWeight: isPicked ? 600 : 400,
          color: !name ? 'rgba(255,255,255,0.12)' : isPicked ? '#7dd3fc' : 'rgba(255,255,255,0.6)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontStyle: !name ? 'italic' : undefined,
        }}>
          {name || 'TBD'}
        </span>
        {node.game && (
          <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
            {side === 'home' ? (node.game.homeScore ?? '') : (node.game.awayScore ?? '')}
          </span>
        )}
      </button>
    )
  }

  let borderColor = 'rgba(255,255,255,0.08)'
  if (homePicked || awayPicked) borderColor = 'rgba(56,189,248,0.25)'

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: CW,
        height: CH,
        background: '#2a3348',
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        overflow: 'hidden',
      }}
    >
      <TeamRow name={homeName} seed={homeSeed} isPicked={homePicked} side="home" />
      <TeamRow name={awayName} seed={awaySeed} isPicked={awayPicked} side="away" />
    </div>
  )
}

export function BracketProView({ tournamentId, leagueId, entryId, nodes, initialPicks }: Props) {
  const { data: live } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 12000 })

  const [picks, setPicks] = useState<Record<string, string | null>>(initialPicks)
  const [savingNode, setSavingNode] = useState<string | null>(null)

  const [zoom, setZoom] = useState(0.55)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [hasAutoFit, setHasAutoFit] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const touchStartRef = useRef<{ touches: Array<{ x: number; y: number }>; zoom: number; panX: number; panY: number } | null>(null)

  const seedMap = useMemo(() => buildSeedMap(nodes), [nodes])

  const nodesWithLive = useMemo(() => {
    const gameById = new Map((live?.games ?? []).map((g) => [g.id, g]))
    return nodes.map((n) => {
      const g = n.sportsGameId ? gameById.get(n.sportsGameId) : null
      return { ...n, game: (g as Game) ?? n.game ?? null }
    })
  }, [nodes, live?.games])

  const effective = useMemo(() => computeEffectiveTeams(nodesWithLive, picks), [nodesWithLive, picks])

  const { byRegion, finals, firstFour } = useMemo(() => {
    const reg: Record<string, Node[]> = {}
    const fin: Node[] = []
    const ff: Node[] = []
    ALL_REGIONS.forEach((r) => (reg[r] = []))
    for (const n of nodesWithLive) {
      if (n.round === 0) ff.push(n)
      else if (!n.region) fin.push(n)
      else reg[n.region]?.push(n)
    }
    for (const r of ALL_REGIONS) {
      reg[r].sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    }
    ff.sort((a, b) => a.slot.localeCompare(b.slot))
    fin.sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    return { byRegion: reg, finals: fin, firstFour: ff }
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
  }, [picks, nodesWithLive, entryId])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.08 : 0.08
      setZoom((z) => Math.max(0.25, Math.min(2, z + delta)))
    } else {
      setPanX((x) => x - e.deltaX)
      setPanY((y) => y - e.deltaY)
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const tag = (e.target as HTMLElement).tagName?.toLowerCase()
    if (tag === 'button') return
    if (e.button === 0) {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }, [panX, panY])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return
    setPanX(panStartRef.current.panX + (e.clientX - panStartRef.current.x))
    setPanY(panStartRef.current.panY + (e.clientY - panStartRef.current.y))
  }, [isPanning])

  const handlePointerUp = useCallback(() => setIsPanning(false), [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      e.preventDefault()
      touchStartRef.current = {
        touches: Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY })),
        zoom, panX, panY,
      }
    }
  }, [zoom, panX, panY])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2 && touchStartRef.current) {
      e.preventDefault()
      const startDist = Math.hypot(
        touchStartRef.current.touches[1].x - touchStartRef.current.touches[0].x,
        touchStartRef.current.touches[1].y - touchStartRef.current.touches[0].y
      )
      const curDist = Math.hypot(
        e.touches[1].clientX - e.touches[0].clientX,
        e.touches[1].clientY - e.touches[0].clientY
      )
      setZoom(Math.max(0.25, Math.min(2, touchStartRef.current.zoom * (curDist / startDist))))
      const curCx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const curCy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const startCx = (touchStartRef.current.touches[0].x + touchStartRef.current.touches[1].x) / 2
      const startCy = (touchStartRef.current.touches[0].y + touchStartRef.current.touches[1].y) / 2
      setPanX(touchStartRef.current.panX + (curCx - startCx))
      setPanY(touchStartRef.current.panY + (curCy - startCy))
    }
  }, [])

  const handleTouchEnd = useCallback(() => { touchStartRef.current = null }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const fit = () => {
      const cw = el.clientWidth
      if (cw > 0) {
        const fitZoom = Math.min(1, cw / (FULL_W + 48))
        setZoom(Math.max(0.25, fitZoom))
        setPanX(0)
        setPanY(0)
        setHasAutoFit(true)
      }
    }
    const ro = new ResizeObserver(() => { if (!hasAutoFit) fit() })
    ro.observe(el)
    if (!hasAutoFit) fit()
    return () => ro.disconnect()
  }, [hasAutoFit])

  const resetView = useCallback(() => {
    const el = containerRef.current
    if (el) {
      const fitZoom = Math.min(1, el.clientWidth / (FULL_W + 48))
      setZoom(Math.max(0.25, fitZoom))
    } else {
      setZoom(0.55)
    }
    setPanX(0)
    setPanY(0)
  }, [])

  function renderRegionCells(
    region: string,
    direction: 'ltr' | 'rtl',
    offsetX: number,
    offsetY: number,
  ) {
    const regionNodes = byRegion[region] || []
    const byRound: Record<number, Node[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const n of regionNodes) {
      if (byRound[n.round]) byRound[n.round].push(n)
    }
    Object.values(byRound).forEach(arr => arr.sort((a, b) => a.slot.localeCompare(b.slot)))

    const cells: JSX.Element[] = []
    for (let r = 1; r <= 4; r++) {
      const roundNodes = byRound[r]
      const centers = POS[r as keyof typeof POS]
      for (let i = 0; i < roundNodes.length && i < centers.length; i++) {
        let x: number
        if (direction === 'ltr') {
          x = offsetX + (r - 1) * (CW + CG)
        } else {
          x = offsetX + (4 - r) * (CW + CG)
        }
        const y = offsetY + centers[i] - TH
        cells.push(
          <MiniCell
            key={roundNodes[i].id}
            node={roundNodes[i]}
            picks={picks}
            seedMap={seedMap}
            effective={effective}
            locked={isPickLocked(roundNodes[i])}
            onPick={submitPick}
            x={x}
            y={y}
          />
        )
      }
    }
    return cells
  }

  function renderRegionLines(
    direction: 'ltr' | 'rtl',
    offsetX: number,
    offsetY: number,
  ) {
    const lines: JSX.Element[] = []
    for (let ri = 0; ri < 3; ri++) {
      const r = ri + 1
      const centers = POS[r as keyof typeof POS]
      const nextCenters = POS[(r + 1) as keyof typeof POS]
      for (let i = 0; i < centers.length; i++) {
        const pairIdx = Math.floor(i / 2)
        const cy = offsetY + centers[i]
        const ny = offsetY + nextCenters[pairIdx]

        let sx: number, ex: number
        if (direction === 'ltr') {
          sx = offsetX + ri * (CW + CG) + CW
          ex = offsetX + (ri + 1) * (CW + CG)
        } else {
          sx = offsetX + (3 - ri) * (CW + CG)
          ex = offsetX + (3 - ri - 1) * (CW + CG) + CW
        }
        const mx = (sx + ex) / 2

        lines.push(
          <line key={`${direction}-${r}-${i}-h1`} x1={sx} y1={cy} x2={mx} y2={cy} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        )
        lines.push(
          <line key={`${direction}-${r}-${i}-v`} x1={mx} y1={cy} x2={mx} y2={ny} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
        )
        if (i % 2 === 0) {
          lines.push(
            <line key={`${direction}-${r}-${i}-h2`} x1={mx} y1={ny} x2={ex} y2={ny} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          )
        }
      }
    }
    return lines
  }

  const leftX = 0
  const rightX = REGION_W + CENTER_W
  const topY = 0
  const botY = REGION_H + REGION_V_GAP

  const e8TopCy = topY + POS[4][0]
  const e8BotCy = botY + POS[4][0]

  const centerX = REGION_W
  const centerMidY = FULL_H / 2

  const ffNodes = finals.filter(n => n.round === 5)
  const champNodes = finals.filter(n => n.round === 6)

  const ff0Y = centerMidY - CH - 16
  const ff1Y = centerMidY + 16
  const champY = centerMidY - TH

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)',
        background: '#252d40',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Timer style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.5)' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            Brackets open on {openDate}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
            {waitingForSelection ? "Waiting for Selection Sunday" : "Make your picks before games lock"}
          </div>
        </div>
      </div>

      {firstFour.length > 0 && (
        <div style={{
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
          background: '#1a1f2e',
          padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>First Four</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {firstFour.map((n) => {
              const picked = picks[n.id] ?? null
              const eff = effective.get(n.id)
              const homeName = eff?.home ?? n.homeTeamName
              const awayName = eff?.away ?? n.awayTeamName
              const homeSeed = homeName ? (seedMap.get(homeName) ?? n.seedHome) : n.seedHome
              const awaySeed = awayName ? (seedMap.get(awayName) ?? n.seedAway) : n.seedAway
              const locked = isPickLocked(n)
              return (
                <div key={n.id} style={{ borderRadius: 8, background: '#2a3348', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  {[{ name: homeName, seed: homeSeed, isPicked: !!homeName && picked === homeName, side: 'home' as const },
                    { name: awayName, seed: awaySeed, isPicked: !!awayName && picked === awayName, side: 'away' as const }].map((t) => (
                    <button
                      key={t.side}
                      disabled={!t.name || locked}
                      onClick={() => t.name && submitPick(n, t.name)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 4, height: 20,
                        paddingLeft: 6, paddingRight: 6,
                        background: t.isPicked ? 'rgba(56,189,248,0.12)' : 'transparent',
                        borderBottom: t.side === 'home' ? '1px solid rgba(255,255,255,0.04)' : undefined,
                        cursor: t.name && !locked ? 'pointer' : 'default',
                        border: 'none', outline: 'none', textAlign: 'left',
                      }}
                    >
                      {t.seed != null && <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', width: 12 }}>{t.seed}</span>}
                      <span style={{ fontSize: 10, fontWeight: t.isPicked ? 600 : 400, color: !t.name ? 'rgba(255,255,255,0.12)' : t.isPicked ? '#7dd3fc' : 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {t.name || 'TBD'}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.12))} style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            <ZoomOut style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />
          </button>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.12))} style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            <ZoomIn style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />
          </button>
          <button onClick={resetView} style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            <Maximize2 style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />
          </button>
        </div>

        <div
          ref={containerRef}
          style={{
            overflow: 'hidden',
            borderRadius: 14,
            background: '#1a1f2e',
            border: '1px solid rgba(255,255,255,0.05)',
            cursor: isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{
            padding: 24,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease',
            minWidth: FULL_W + 48,
          }}>
            <div style={{ position: 'relative', width: FULL_W, height: FULL_H, margin: '0 auto' }}>

              <svg
                width={FULL_W}
                height={FULL_H}
                style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
              >
                {renderRegionLines('ltr', leftX, topY)}
                {renderRegionLines('ltr', leftX, botY)}
                {renderRegionLines('rtl', rightX, topY)}
                {renderRegionLines('rtl', rightX, botY)}

                <line x1={leftX + REGION_W} y1={e8TopCy} x2={centerX + (CENTER_W - CW) / 2} y2={ff0Y + TH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <line x1={leftX + REGION_W} y1={e8BotCy} x2={centerX + (CENTER_W - CW) / 2} y2={ff1Y + TH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <line x1={rightX} y1={e8TopCy} x2={centerX + (CENTER_W + CW) / 2} y2={ff0Y + TH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <line x1={rightX} y1={e8BotCy} x2={centerX + (CENTER_W + CW) / 2} y2={ff1Y + TH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

                <line x1={centerX + CENTER_W / 2} y1={ff0Y + CH} x2={centerX + CENTER_W / 2} y2={champY} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                <line x1={centerX + CENTER_W / 2} y1={ff1Y} x2={centerX + CENTER_W / 2} y2={champY + CH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
              </svg>

              <div style={{ position: 'absolute', left: leftX + REGION_W * 0.45, top: topY + REGION_H * 0.42, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.04)', letterSpacing: 6 }}>W</span>
              </div>
              <div style={{ position: 'absolute', left: leftX + REGION_W * 0.45, top: botY + REGION_H * 0.42, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.04)', letterSpacing: 6 }}>E</span>
              </div>
              <div style={{ position: 'absolute', left: rightX + REGION_W * 0.55, top: topY + REGION_H * 0.42, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.04)', letterSpacing: 6 }}>S</span>
              </div>
              <div style={{ position: 'absolute', left: rightX + REGION_W * 0.55, top: botY + REGION_H * 0.42, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: 'rgba(255,255,255,0.04)', letterSpacing: 6 }}>MW</span>
              </div>

              {renderRegionCells('West', 'ltr', leftX, topY)}
              {renderRegionCells('East', 'ltr', leftX, botY)}
              {renderRegionCells('South', 'rtl', rightX, topY)}
              {renderRegionCells('Midwest', 'rtl', rightX, botY)}

              {ffNodes.map((n, i) => (
                <MiniCell
                  key={n.id}
                  node={n}
                  picks={picks}
                  seedMap={seedMap}
                  effective={effective}
                  locked={isPickLocked(n)}
                  onPick={submitPick}
                  x={centerX + (CENTER_W - CW) / 2}
                  y={i === 0 ? ff0Y : ff1Y}
                />
              ))}

              {champNodes.map((n) => (
                <MiniCell
                  key={n.id}
                  node={n}
                  picks={picks}
                  seedMap={seedMap}
                  effective={effective}
                  locked={isPickLocked(n)}
                  onPick={submitPick}
                  x={centerX + (CENTER_W - CW) / 2}
                  y={champY}
                />
              ))}

              <div style={{
                position: 'absolute',
                left: centerX + (CENTER_W - 48) / 2,
                top: centerMidY - 24,
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#2a3348',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Trophy style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.3)' }} />
              </div>

              {ffNodes.length === 0 && champNodes.length === 0 && (
                <div style={{
                  position: 'absolute',
                  left: centerX + (CENTER_W - 48) / 2,
                  top: FULL_H / 2 - 24,
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: '#2a3348',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Trophy style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.3)' }} />
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
