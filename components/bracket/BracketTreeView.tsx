"use client"

import { useMemo, useState, useCallback, useRef, useEffect } from "react"
import { Trophy, Sparkles, Zap, Info, Check, X, ZoomIn, ZoomOut, Maximize2, Clock } from "lucide-react"
import { useBracketLive } from "@/lib/hooks/useBracketLive"
import { MatchupCardOverlay } from "./MatchupCardOverlay"

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
  readOnly?: boolean
  compact?: boolean
}

const ALL_REGIONS = ["West", "East", "South", "Midwest"]

function isPickLocked(node: Node): boolean {
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

function getGameResult(node: Node): { winner: string | null; isComplete: boolean } {
  const g = node.game
  if (!g) return { winner: null, isComplete: false }
  const status = (g.status || '').toLowerCase().trim()
  const terminalStatuses = ['completed', 'final', 'closed', 'finished', 'post', 'ft']
  const isTerminal = terminalStatuses.some(s => status.includes(s))
  if (!isTerminal && g.homeScore != null && g.awayScore != null && g.homeScore !== g.awayScore) {
    const gameTime = g.startTime ? new Date(g.startTime) : null
    if (gameTime && (Date.now() - gameTime.getTime()) > 4 * 60 * 60 * 1000) {
      const winnerName = g.homeScore > g.awayScore
        ? (node.homeTeamName || g.homeTeam || '')
        : (node.awayTeamName || g.awayTeam || '')
      return { winner: winnerName, isComplete: true }
    }
  }
  if (!isTerminal) return { winner: null, isComplete: false }
  if (g.homeScore != null && g.awayScore != null && g.homeScore !== g.awayScore) {
    const winnerName = g.homeScore > g.awayScore
      ? (node.homeTeamName || g.homeTeam || '')
      : (node.awayTeamName || g.awayTeam || '')
    return { winner: winnerName, isComplete: true }
  }
  return { winner: null, isComplete: false }
}

const CW = 120
const CH = 36
const TH = 18
const VG = 6
const CG = 24
const REGION_H = 8 * CH + 7 * VG
const REGION_W = 4 * CW + 3 * CG
const REGION_V_GAP = 40
const CENTER_W = 180
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

function isUpsetPick(seedMap: Map<string, number>, pickedTeam: string | null, otherTeam: string | null): boolean {
  if (!pickedTeam || !otherTeam) return false
  const pickedSeed = seedMap.get(pickedTeam)
  const otherSeed = seedMap.get(otherTeam)
  if (pickedSeed == null || otherSeed == null) return false
  return pickedSeed > otherSeed && (pickedSeed - otherSeed) >= 3
}

function isUpsetResult(seedMap: Map<string, number>, winner: string | null, loser: string | null): boolean {
  if (!winner || !loser) return false
  const wSeed = seedMap.get(winner)
  const lSeed = seedMap.get(loser)
  if (wSeed == null || lSeed == null) return false
  return wSeed > lSeed && (wSeed - lSeed) >= 3
}

function MiniCell({
  node,
  picks,
  seedMap,
  effective,
  locked,
  onPick,
  readOnly,
  sleeperTeams,
  highlightedTeam,
  onHoverTeam,
  onMatchupClick,
  x,
  y,
}: {
  node: Node
  picks: Record<string, string | null>
  seedMap: Map<string, number>
  effective: Map<string, { home: string | null; away: string | null }>
  locked: boolean
  onPick: (node: Node, team: string) => void
  readOnly?: boolean
  sleeperTeams?: Set<string>
  highlightedTeam?: string | null
  onHoverTeam?: (team: string | null) => void
  onMatchupClick?: (node: Node) => void
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

  const { winner, isComplete } = getGameResult(node)
  const homeCorrect = isComplete && homePicked && winner === homeName
  const awayCorrect = isComplete && awayPicked && winner === awayName
  const homeWrong = isComplete && homePicked && winner !== homeName
  const awayWrong = isComplete && awayPicked && winner !== awayName

  const loser = isComplete && winner ? (winner === homeName ? awayName : homeName) : null
  const hasUpsetResult = isComplete && isUpsetResult(seedMap, winner, loser)
  const homeIsUpsetPick = homePicked && isUpsetPick(seedMap, homeName, awayName)
  const awayIsUpsetPick = awayPicked && isUpsetPick(seedMap, awayName, homeName)

  const isHighlighted = !!(highlightedTeam && (homeName === highlightedTeam || awayName === highlightedTeam))
  const isDimmed = !!(highlightedTeam && !isHighlighted)

  const canClick = !readOnly && !locked

  function pickBg(isPicked: boolean, correct: boolean, wrong: boolean, isUpset: boolean): string {
    if (correct && isUpset) return 'rgba(168,85,247,0.2)'
    if (correct) return 'rgba(34,197,94,0.15)'
    if (wrong) return 'rgba(239,68,68,0.1)'
    if (isPicked && isUpset) return 'rgba(168,85,247,0.12)'
    if (isPicked) return 'rgba(251,146,60,0.18)'
    return 'transparent'
  }

  function pickColor(name: string | null, isPicked: boolean, correct: boolean, wrong: boolean, isSleeper: boolean, isUpset: boolean): string {
    if (!name) return 'rgba(255,255,255,0.12)'
    if (correct && isUpset) return '#c084fc'
    if (correct) return '#22c55e'
    if (wrong) return 'rgba(239,68,68,0.5)'
    if (isPicked && isUpset) return '#c084fc'
    if (isPicked) return '#fb923c'
    if (isSleeper) return '#c084fc'
    return 'rgba(255,255,255,0.75)'
  }

  function seedColor(isSleeper: boolean): string {
    return isSleeper ? '#a855f7' : 'rgba(255,255,255,0.25)'
  }

  function TeamRow({ name, seed, isPicked, side, correct, wrong, isUpset }: {
    name: string | null; seed: number | null; isPicked: boolean; side: 'home' | 'away'; correct: boolean; wrong: boolean; isUpset: boolean
  }) {
    const isSleeper = !!(name && sleeperTeams?.has(name))
    const clickable = canClick && !!name
    const isTeamHighlighted = highlightedTeam === name
    return (
      <button
        disabled={!clickable}
        onClick={() => name && onPick(node, name)}
        onMouseEnter={() => name && onHoverTeam?.(name)}
        onMouseLeave={() => onHoverTeam?.(null)}
        className="w-full flex items-center text-left"
        style={{
          height: TH,
          background: isTeamHighlighted ? 'rgba(251,146,60,0.25)' : pickBg(isPicked, correct, wrong, isUpset),
          borderBottom: side === 'home' ? '1px solid rgba(255,255,255,0.04)' : undefined,
          cursor: clickable ? 'pointer' : 'default',
          paddingLeft: 4,
          paddingRight: 4,
          gap: 3,
        }}
      >
        {seed != null && (
          <span style={{ fontSize: 9, fontWeight: 700, color: seedColor(isSleeper), width: 10, flexShrink: 0 }}>
            {seed}
          </span>
        )}
        {isSleeper && (
          <span style={{ fontSize: 6, fontWeight: 800, color: '#a855f7', flexShrink: 0, lineHeight: 1, background: 'rgba(168,85,247,0.15)', borderRadius: 2, padding: '1px 2px' }}>S</span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: isTeamHighlighted ? 700 : 500,
            color: pickColor(name, isPicked, correct, wrong, isSleeper, isUpset),
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textDecoration: wrong ? 'line-through' : undefined,
          }}
        >
          {name || ''}
        </span>
        {correct && hasUpsetResult && <Zap style={{ width: 8, height: 8, color: '#c084fc', flexShrink: 0 }} />}
        {correct && !hasUpsetResult && <Check style={{ width: 8, height: 8, color: '#22c55e', flexShrink: 0 }} />}
        {wrong && <X style={{ width: 8, height: 8, color: '#ef4444', flexShrink: 0 }} />}
        {isUpset && !isComplete && !correct && !wrong && (
          <span style={{ fontSize: 6, fontWeight: 800, color: '#c084fc', flexShrink: 0 }}>!</span>
        )}
        {node.game && !correct && !wrong && (
          <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            {side === 'home' ? (node.game.homeScore ?? '') : (node.game.awayScore ?? '')}
          </span>
        )}
      </button>
    )
  }

  const hasPick = !!picked
  const hasUpset = homeIsUpsetPick || awayIsUpsetPick
  let borderColor = 'rgba(255,255,255,0.10)'
  if (isHighlighted) borderColor = 'rgba(251,146,60,0.5)'
  else if (homeCorrect || awayCorrect) borderColor = hasUpsetResult ? 'rgba(168,85,247,0.4)' : 'rgba(34,197,94,0.3)'
  else if (homeWrong || awayWrong) borderColor = 'rgba(239,68,68,0.2)'
  else if (hasUpset) borderColor = 'rgba(168,85,247,0.3)'
  else if (hasPick) borderColor = 'rgba(251,146,60,0.25)'

  const upsetAnimation = (hasUpsetResult && (homeCorrect || awayCorrect))
    ? 'bracket-upset-glow 2s ease-in-out infinite'
    : hasUpset && !isComplete
    ? 'bracket-upset-pulse 3s ease-in-out infinite'
    : undefined

  return (
    <div
      className="absolute rounded-lg overflow-hidden"
      style={{
        left: x,
        top: y,
        width: CW,
        height: CH,
        background: '#252d3d',
        border: `1px solid ${borderColor}`,
        animation: upsetAnimation,
        opacity: isDimmed ? 0.3 : 1,
        transition: 'opacity 0.2s ease',
        cursor: 'pointer',
      }}
      onDoubleClick={() => onMatchupClick?.(node)}
    >
      <TeamRow name={homeName} seed={homeSeed} isPicked={homePicked} side="home" correct={homeCorrect} wrong={homeWrong} isUpset={homeIsUpsetPick} />
      <TeamRow name={awayName} seed={awaySeed} isPicked={awayPicked} side="away" correct={awayCorrect} wrong={awayWrong} isUpset={awayIsUpsetPick} />
    </div>
  )
}


const STRATEGY_TIPS = [
  "Lower seeds (1-4) historically dominate late rounds. No team seeded 12+ has ever made the Final Four.",
  "7-11 seeds are classic 'sleeper' territory — they often pull early upsets but rarely go deep.",
  "Every round is worth 32 total points. Late-round picks carry more weight per game.",
  "Pick at least one upset in the 5-12 or 6-11 matchups — these happen frequently.",
  "Only one champion since 1989 was seeded worse than 4th (7-seed UConn in 2014).",
  "First Four play-in games don't count for bracket scoring — focus on Round 1 and beyond.",
]

export function BracketTreeView({ tournamentId, leagueId, entryId, nodes, initialPicks, readOnly, compact }: Props) {
  const { data: live } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 15000 })

  const [picks, setPicks] = useState<Record<string, string | null>>(initialPicks)
  const [savingNode, setSavingNode] = useState<string | null>(null)
  const [showTips, setShowTips] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const [zoom, setZoom] = useState(0.55)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [hasAutoFit, setHasAutoFit] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)

  const seedMap = useMemo(() => buildSeedMap(nodes), [nodes])

  const nodesWithLive = useMemo(() => {
    const gameById = new Map((live?.games ?? []).map((g: any) => [g.id, g]))
    return nodes.map((n) => {
      const g = n.sportsGameId ? gameById.get(n.sportsGameId) : null
      return { ...n, game: (g as Game) ?? n.game ?? null }
    })
  }, [nodes, live?.games])

  const effective = useMemo(() => computeEffectiveTeams(nodesWithLive, picks), [nodesWithLive, picks])

  const sleeperTeams = useMemo(() => {
    const teams = (live as any)?.sleeperTeams as string[] | undefined
    return new Set(teams ?? [])
  }, [live])

  const { byRegion, finals } = useMemo(() => {
    const reg: Record<string, Node[]> = {}
    const fin: Node[] = []
    ALL_REGIONS.forEach((r) => (reg[r] = []))
    for (const n of nodesWithLive) {
      if (!n.region) fin.push(n)
      else reg[n.region]?.push(n)
    }
    for (const r of ALL_REGIONS) {
      reg[r].sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    }
    fin.sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    return { byRegion: reg, finals: fin }
  }, [nodesWithLive])

  const totalPicks = useMemo(() => Object.values(picks).filter(Boolean).length, [picks])
  const totalGames = useMemo(() => nodesWithLive.filter(n => n.round >= 1).length, [nodesWithLive])
  const progressPct = totalGames > 0 ? Math.round((totalPicks / totalGames) * 100) : 0

  const hasAnyResults = useMemo(() => nodesWithLive.some(n => {
    const { isComplete } = getGameResult(n)
    return isComplete
  }), [nodesWithLive])

  const autoFill = useCallback(async () => {
    if (autoFilling || readOnly) return
    setAutoFilling(true)
    try {
      const res = await fetch('/api/bracket/auto-fill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      if (res.ok) window.location.reload()
    } catch {}
    setAutoFilling(false)
  }, [entryId, readOnly, autoFilling])

  const submitPick = useCallback(async (node: Node, teamName: string) => {
    if (!teamName || readOnly) return
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
    if (!res.ok) setPicks((p) => ({ ...p, [node.id]: prev }))
  }, [picks, nodesWithLive, entryId, readOnly])

  const handleMatchupClick = useCallback((node: Node) => {
    if (!isPanning) setSelectedNode(node.id)
  }, [isPanning])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.max(0.3, Math.min(3, z + delta)))
    } else {
      setPanX((x) => x - e.deltaX)
      setPanY((y) => y - e.deltaY)
    }
  }, [])

  const touchStartRef = useRef<{ touches: Array<{ x: number; y: number }>; zoom: number; panX: number; panY: number } | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.altKey || e.pointerType === "touch")) || (e.button === 0 && e.pointerType === "mouse")) {
      e.preventDefault()
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, panX, panY }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [panX, panY])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setPanX(panStartRef.current.panX + dx)
    setPanY(panStartRef.current.panY + dy)
  }, [isPanning])

  const handlePointerUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      e.preventDefault()
      touchStartRef.current = {
        touches: Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY })),
        zoom,
        panX,
        panY,
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
      const scale = curDist / startDist
      setZoom(Math.max(0.3, Math.min(3, touchStartRef.current.zoom * scale)))

      const startCx = (touchStartRef.current.touches[0].x + touchStartRef.current.touches[1].x) / 2
      const startCy = (touchStartRef.current.touches[0].y + touchStartRef.current.touches[1].y) / 2
      const curCx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const curCy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      setPanX(touchStartRef.current.panX + (curCx - startCx))
      setPanY(touchStartRef.current.panY + (curCy - startCy))
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
  }, [])

  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const fitToContainer = () => {
      const cw = el.clientWidth
      if (cw > 0) {
        const neededW = FULL_W + 48
        const fitZoom = Math.min(1, cw / neededW)
        setZoom(Math.max(0.3, fitZoom))
        setPanX(0)
        setPanY(0)
        setHasAutoFit(true)
      }
    }
    const ro = new ResizeObserver(() => {
      if (!hasAutoFit) fitToContainer()
    })
    ro.observe(el)
    if (!hasAutoFit) fitToContainer()
    return () => ro.disconnect()
  }, [hasAutoFit])

  const resetView = useCallback(() => {
    const el = canvasContainerRef.current
    if (el) {
      const cw = el.clientWidth
      const neededW = FULL_W + 48
      const fitZoom = Math.min(1, cw / neededW)
      setZoom(Math.max(0.3, fitZoom))
    } else {
      setZoom(0.55)
    }
    setPanX(0)
    setPanY(0)
  }, [])

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null
    return nodesWithLive.find((n) => n.id === selectedNode) ?? null
  }, [selectedNode, nodesWithLive])

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
            readOnly={readOnly}
            sleeperTeams={sleeperTeams}
            highlightedTeam={highlightedTeam}
            onHoverTeam={setHighlightedTeam}
            onMatchupClick={handleMatchupClick}
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
          <line key={`${direction}-${r}-${i}-h1`} x1={sx} y1={cy} x2={mx} y2={cy} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        )
        lines.push(
          <line key={`${direction}-${r}-${i}-v`} x1={mx} y1={cy} x2={mx} y2={ny} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        )
        if (i % 2 === 0) {
          lines.push(
            <line key={`${direction}-${r}-${i}-h2`} x1={mx} y1={ny} x2={ex} y2={ny} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
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
  const allFinals = [...ffNodes, ...champNodes]

  const ff0Y = centerMidY - CH - 20
  const ff1Y = centerMidY + 20
  const champY = centerMidY - TH

  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="p-3 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>My Bracket</div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="text-2xl font-black" style={{ color: '#fb923c' }}>{totalPicks}</span>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalGames}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: '#fb923c' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bracket-upset-glow {
          0%, 100% { box-shadow: 0 0 4px rgba(168,85,247,0.3), inset 0 0 4px rgba(168,85,247,0.05); }
          50% { box-shadow: 0 0 10px rgba(168,85,247,0.5), inset 0 0 8px rgba(168,85,247,0.1); }
        }
        @keyframes bracket-upset-pulse {
          0%, 100% { box-shadow: 0 0 2px rgba(168,85,247,0.15); }
          50% { box-shadow: 0 0 6px rgba(168,85,247,0.3); }
        }
      `}} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold">My Bracket</h2>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.15)' }}>
            <span className="text-xs font-bold" style={{ color: '#fb923c' }}>{totalPicks}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{totalGames}</span>
          </div>
          {sleeperTeams.size > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
              <Sparkles className="w-3 h-3" />
              {sleeperTeams.size} Sleeper{sleeperTeams.size > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && totalPicks < totalGames && (
            <button
              onClick={autoFill}
              disabled={autoFilling}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.2)' }}
            >
              <Zap className="w-3.5 h-3.5" />
              {autoFilling ? 'Filling...' : 'Auto-Fill'}
            </button>
          )}
          <button
            onClick={() => setShowTips(!showTips)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: showTips ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.04)',
              color: showTips ? '#fb923c' : 'rgba(255,255,255,0.3)',
              border: showTips ? '1px solid rgba(251,146,60,0.2)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showTips && (
        <div className="rounded-xl p-4 space-y-2.5" style={{ background: 'rgba(251,146,60,0.04)', border: '1px solid rgba(251,146,60,0.12)' }}>
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5" style={{ color: '#fb923c' }} />
            <span className="text-xs font-bold" style={{ color: '#fb923c' }}>Strategy Tips</span>
          </div>
          {STRATEGY_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              <span className="mt-0.5" style={{ color: 'rgba(251,146,60,0.4)' }}>&#9679;</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#22c55e' : '#fb923c' }} />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2 justify-end flex-wrap">
          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ZoomOut className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.15))} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <ZoomIn className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
          <button onClick={resetView} className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Maximize2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
          <span className="hidden sm:inline text-[9px] ml-2" style={{ color: 'rgba(255,255,255,0.15)' }}>Scroll to pan | Ctrl+scroll to zoom | Double-click matchup for details</span>
          <span className="sm:hidden text-[9px] ml-2" style={{ color: 'rgba(255,255,255,0.15)' }}>Pinch to zoom | Drag to pan</span>
        </div>
        <div
          ref={canvasContainerRef}
          className="overflow-hidden rounded-xl select-none"
          style={{ background: '#141b2d', border: '1px solid rgba(255,255,255,0.06)', cursor: isPanning ? 'grabbing' : 'grab' }}
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
            {!hasAnyResults && (
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: '#252d3d', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <Clock style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Brackets open on March 17th</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Waiting for Selection Sunday</span>
                </div>
              </div>
            )}
            <div className="relative" style={{ width: FULL_W, height: FULL_H, margin: '0 auto' }}>

              <svg
                className="absolute inset-0 pointer-events-none"
                width={FULL_W}
                height={FULL_H}
                style={{ overflow: 'visible' }}
              >
                {/* West (top-left, LTR) */}
                {renderRegionLines('ltr', leftX, topY)}
                {/* East (bottom-left, LTR) */}
                {renderRegionLines('ltr', leftX, botY)}
                {/* South (top-right, RTL) */}
                {renderRegionLines('rtl', rightX, topY)}
                {/* Midwest (bottom-right, RTL) */}
                {renderRegionLines('rtl', rightX, botY)}

                {/* E8 to center connector lines */}
                {/* West E8 (top-left) → center left */}
                <line x1={leftX + REGION_W} y1={e8TopCy} x2={centerX + (CENTER_W - CW) / 2} y2={ff0Y + TH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                {/* East E8 (bottom-left) → center left */}
                <line x1={leftX + REGION_W} y1={e8BotCy} x2={centerX + (CENTER_W - CW) / 2} y2={ff1Y + TH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                {/* South E8 (top-right) → center right */}
                <line x1={rightX} y1={e8TopCy} x2={centerX + (CENTER_W + CW) / 2} y2={ff0Y + TH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                {/* Midwest E8 (bottom-right) → center right */}
                <line x1={rightX} y1={e8BotCy} x2={centerX + (CENTER_W + CW) / 2} y2={ff1Y + TH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

                {/* FF to Championship */}
                <line x1={centerX + CENTER_W / 2} y1={ff0Y + CH} x2={centerX + CENTER_W / 2} y2={champY} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                <line x1={centerX + CENTER_W / 2} y1={ff1Y} x2={centerX + CENTER_W / 2} y2={champY + CH} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
              </svg>

              {/* Region watermark labels */}
              <div className="absolute pointer-events-none" style={{ left: leftX + REGION_W * 0.45, top: topY + REGION_H * 0.4, transform: 'translate(-50%,-50%)' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.07)', letterSpacing: 4 }}>W</span>
              </div>
              <div className="absolute pointer-events-none" style={{ left: leftX + REGION_W * 0.45, top: botY + REGION_H * 0.4, transform: 'translate(-50%,-50%)' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.07)', letterSpacing: 4 }}>E</span>
              </div>
              <div className="absolute pointer-events-none" style={{ left: rightX + REGION_W * 0.55, top: topY + REGION_H * 0.4, transform: 'translate(-50%,-50%)' }}>
                <span style={{ fontSize: 56, fontWeight: 900, color: 'rgba(255,255,255,0.07)', letterSpacing: 4 }}>S</span>
              </div>
              <div className="absolute pointer-events-none" style={{ left: rightX + REGION_W * 0.55, top: botY + REGION_H * 0.4, transform: 'translate(-50%,-50%)' }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: 'rgba(255,255,255,0.07)', letterSpacing: 4 }}>MW</span>
              </div>

              {/* Matchup cells per region */}
              {renderRegionCells('West', 'ltr', leftX, topY)}
              {renderRegionCells('East', 'ltr', leftX, botY)}
              {renderRegionCells('South', 'rtl', rightX, topY)}
              {renderRegionCells('Midwest', 'rtl', rightX, botY)}

              {/* Center: Final Four games (round 5) */}
              {ffNodes.map((n, i) => (
                <MiniCell
                  key={n.id}
                  node={n}
                  picks={picks}
                  seedMap={seedMap}
                  effective={effective}
                  locked={isPickLocked(n)}
                  onPick={submitPick}
                  readOnly={readOnly}
                  sleeperTeams={sleeperTeams}
                  highlightedTeam={highlightedTeam}
                  onHoverTeam={setHighlightedTeam}
                  onMatchupClick={handleMatchupClick}
                  x={centerX + (CENTER_W - CW) / 2}
                  y={i === 0 ? ff0Y : ff1Y}
                />
              ))}

              {/* Championship game (round 6) */}
              {champNodes.map((n) => (
                <MiniCell
                  key={n.id}
                  node={n}
                  picks={picks}
                  seedMap={seedMap}
                  effective={effective}
                  locked={isPickLocked(n)}
                  onPick={submitPick}
                  readOnly={readOnly}
                  sleeperTeams={sleeperTeams}
                  highlightedTeam={highlightedTeam}
                  onHoverTeam={setHighlightedTeam}
                  onMatchupClick={handleMatchupClick}
                  x={centerX + (CENTER_W - CW) / 2}
                  y={champY}
                />
              ))}

              {/* Trophy */}
              <div
                className="absolute flex items-center justify-center rounded-xl"
                style={{
                  left: centerX + (CENTER_W - 52) / 2,
                  top: centerMidY - 26,
                  width: 52,
                  height: 52,
                  background: '#252d3d',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <Trophy style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.35)' }} />
              </div>

              {/* Champion pick label */}
              {(() => {
                const champNode = champNodes[0] || ffNodes[ffNodes.length - 1]
                const champPick = champNode ? picks[champNode.id] : null
                if (!champPick) return null
                return (
                  <div
                    className="absolute text-center"
                    style={{
                      left: centerX,
                      top: champY + CH + 56,
                      width: CENTER_W,
                    }}
                  >
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>Champion</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', marginTop: 2 }}>{champPick}</div>
                  </div>
                )
              })()}

              {allFinals.length === 0 && (
                <div
                  className="absolute flex items-center justify-center rounded-xl"
                  style={{
                    left: centerX + (CENTER_W - 52) / 2,
                    top: FULL_H / 2 - 26,
                    width: 52,
                    height: 52,
                    background: '#252d3d',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <Trophy style={{ width: 26, height: 26, color: 'rgba(255,255,255,0.35)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedNodeData && (
        <MatchupCardOverlay
          node={selectedNodeData}
          effective={effective.get(selectedNodeData.id) ?? { home: selectedNodeData.homeTeamName, away: selectedNodeData.awayTeamName }}
          picked={picks[selectedNodeData.id] ?? null}
          seedMap={seedMap}
          locked={isPickLocked(selectedNodeData)}
          readOnly={readOnly}
          onPick={(n, team) => { submitPick(n, team); setSelectedNode(null) }}
          onClose={() => setSelectedNode(null)}
          entryId={entryId}
        />
      )}
    </div>
  )
}
