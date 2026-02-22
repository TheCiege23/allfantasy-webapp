"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { Trophy, Sparkles, Zap, Info, Check, X } from "lucide-react"
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
  readOnly?: boolean
  compact?: boolean
}

const REGION_ORDER_LEFT = ["West", "East"]
const REGION_ORDER_RIGHT = ["South", "Midwest"]
const ALL_REGIONS = ["West", "East", "South", "Midwest"]

const ROUND_LABELS: Record<number, string> = {
  1: "R1",
  2: "R2",
  3: "SWEET 16",
  4: "ELITE 8",
  5: "FINAL 4",
  6: "CHAMPIONSHIP",
}

const REGION_LABELS: Record<string, string> = {
  West: "WEST",
  East: "EAST",
  South: "SOUTH",
  Midwest: "MIDWEST",
}

const REGION_SHORT: Record<string, string> = {
  West: "W",
  East: "E",
  South: "S",
  Midwest: "MW",
}

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

function teamInitial(name: string | null): string {
  if (!name) return "?"
  return name.substring(0, 2).toUpperCase()
}

const MATCHUP_H = 56
const MATCHUP_GAP = 6
const ROUND_W = 150
const CONNECTOR_W = 24

function MatchupCell({
  node,
  picks,
  seedMap,
  effective,
  locked,
  savingNode,
  onPick,
  readOnly,
  compact,
  sleeperTeams,
}: {
  node: Node
  picks: Record<string, string | null>
  seedMap: Map<string, number>
  effective: Map<string, { home: string | null; away: string | null }>
  locked: boolean
  savingNode: string | null
  onPick: (node: Node, team: string) => void
  readOnly?: boolean
  compact?: boolean
  sleeperTeams?: Set<string>
}) {
  const picked = picks[node.id] ?? null
  const eff = effective.get(node.id)
  const homeName = eff?.home ?? node.homeTeamName
  const awayName = eff?.away ?? node.awayTeamName
  const homeSeed = homeName ? (seedMap.get(homeName) ?? node.seedHome) : node.seedHome
  const awaySeed = awayName ? (seedMap.get(awayName) ?? node.seedAway) : node.seedAway
  const homePicked = !!homeName && picked === homeName
  const awayPicked = !!awayName && picked === awayName
  const saving = savingNode === node.id
  const cellH = compact ? 44 : MATCHUP_H
  const cellW = compact ? 130 : ROUND_W

  const { winner, isComplete } = getGameResult(node)
  const homeCorrect = isComplete && homePicked && winner === homeName
  const awayCorrect = isComplete && awayPicked && winner === awayName
  const homeWrong = isComplete && homePicked && winner !== homeName
  const awayWrong = isComplete && awayPicked && winner !== awayName
  const homeEliminated = isComplete && winner !== homeName
  const awayEliminated = isComplete && winner !== awayName

  function TeamRow({ name, seed, isPicked, side, isCorrect, isWrong, isElim }: {
    name: string | null; seed: number | null; isPicked: boolean; side: 'home' | 'away'
    isCorrect: boolean; isWrong: boolean; isElim: boolean
  }) {
    const canClick = !readOnly && !locked && !!name
    const isSleeper = !!(name && sleeperTeams?.has(name))
    const rowH = cellH / 2

    let bgColor = 'transparent'
    if (isCorrect) bgColor = 'rgba(34,197,94,0.12)'
    else if (isWrong) bgColor = 'rgba(239,68,68,0.08)'
    else if (isPicked) bgColor = 'rgba(251,146,60,0.15)'

    let nameColor = 'rgba(255,255,255,0.85)'
    if (isElim && !isPicked) nameColor = 'rgba(255,255,255,0.25)'
    else if (isWrong) nameColor = 'rgba(239,68,68,0.5)'
    else if (isCorrect) nameColor = '#22c55e'
    else if (isPicked) nameColor = '#fb923c'
    else if (isSleeper) nameColor = '#c084fc'
    else if (!name) nameColor = 'rgba(255,255,255,0.12)'

    return (
      <button
        disabled={!canClick}
        onClick={() => name && onPick(node, name)}
        className="w-full flex items-center gap-1.5 text-left transition-all duration-150"
        style={{
          height: rowH,
          background: bgColor,
          borderBottom: side === 'home' ? '1px solid rgba(255,255,255,0.06)' : undefined,
          cursor: canClick ? 'pointer' : 'default',
          paddingLeft: compact ? 4 : 6,
          paddingRight: compact ? 4 : 8,
        }}
      >
        <div
          className="shrink-0 rounded flex items-center justify-center font-bold"
          style={{
            width: compact ? 16 : 20,
            height: compact ? 16 : 20,
            fontSize: compact ? 8 : 9,
            background: name
              ? (isPicked ? 'rgba(251,146,60,0.25)' : isSleeper ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.06)')
              : 'rgba(255,255,255,0.03)',
            color: name
              ? (isPicked ? '#fb923c' : isSleeper ? '#a855f7' : 'rgba(255,255,255,0.3)')
              : 'rgba(255,255,255,0.08)',
          }}
        >
          {name ? teamInitial(name) : ''}
        </div>

        {seed != null && (
          <span
            className="font-bold shrink-0"
            style={{
              fontSize: compact ? 9 : 10,
              width: compact ? 12 : 14,
              color: isSleeper ? '#a855f7' : 'rgba(255,255,255,0.3)',
            }}
          >
            {seed}
          </span>
        )}

        <span
          className="font-medium truncate flex-1"
          style={{
            fontSize: compact ? 10 : 11,
            color: nameColor,
            textDecoration: (isElim && isPicked && isWrong) ? 'line-through' : undefined,
          }}
        >
          {name || (compact ? '' : 'TBD')}
        </span>

        {isSleeper && !compact && (
          <Sparkles className="w-3 h-3 shrink-0" style={{ color: '#a855f7' }} />
        )}

        {isCorrect && (
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.2)' }}>
            <Check className="w-2.5 h-2.5" style={{ color: '#22c55e' }} />
          </div>
        )}
        {isWrong && (
          <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <X className="w-2.5 h-2.5" style={{ color: '#ef4444' }} />
          </div>
        )}

        {node.game && !isCorrect && !isWrong && (
          <span className="font-bold shrink-0 ml-0.5 tabular-nums" style={{ fontSize: compact ? 9 : 10, color: 'rgba(255,255,255,0.35)' }}>
            {side === 'home' ? (node.game.homeScore ?? '') : (node.game.awayScore ?? '')}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden transition-shadow duration-150"
      style={{
        width: cellW,
        height: cellH,
        border: picked
          ? (homeCorrect || awayCorrect ? '1px solid rgba(34,197,94,0.3)' : homeWrong || awayWrong ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(251,146,60,0.25)')
          : '1px solid rgba(255,255,255,0.07)',
        background: '#161b22',
        boxShadow: picked ? '0 0 12px rgba(251,146,60,0.06)' : '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      <TeamRow name={homeName} seed={homeSeed} isPicked={homePicked} side="home" isCorrect={homeCorrect} isWrong={homeWrong} isElim={homeEliminated} />
      <TeamRow name={awayName} seed={awaySeed} isPicked={awayPicked} side="away" isCorrect={awayCorrect} isWrong={awayWrong} isElim={awayEliminated} />
    </div>
  )
}

function RegionBracket({
  region,
  nodes,
  picks,
  seedMap,
  effective,
  savingNode,
  onPick,
  direction,
  readOnly,
  sleeperTeams,
}: {
  region: string
  nodes: Node[]
  picks: Record<string, string | null>
  seedMap: Map<string, number>
  effective: Map<string, { home: string | null; away: string | null }>
  savingNode: string | null
  onPick: (node: Node, team: string) => void
  direction: 'ltr' | 'rtl'
  readOnly?: boolean
  sleeperTeams?: Set<string>
}) {
  const byRound: Record<number, Node[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const n of nodes) {
    if (byRound[n.round]) byRound[n.round].push(n)
  }
  Object.values(byRound).forEach((arr) => arr.sort((a, b) => a.slot.localeCompare(b.slot)))

  const rounds = direction === 'ltr' ? [1, 2, 3, 4] : [4, 3, 2, 1]

  const r1Count = byRound[1].length || 8
  const totalHeight = r1Count * (MATCHUP_H + MATCHUP_GAP) - MATCHUP_GAP

  function getMatchupY(round: number, idx: number, total: number): number {
    const blockH = totalHeight / total
    return blockH * idx + (blockH - MATCHUP_H) / 2
  }

  const totalW = rounds.length * (ROUND_W + CONNECTOR_W) - CONNECTOR_W

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div
          className="px-2.5 py-1 rounded-md font-bold text-[11px] uppercase tracking-wider"
          style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.15)' }}
        >
          {REGION_LABELS[region]}
        </div>
        <div className="flex gap-0" style={{ direction: direction === 'rtl' ? 'rtl' : 'ltr' }}>
          {rounds.map((r) => (
            <div key={r} className="text-center" style={{ width: ROUND_W + CONNECTOR_W }}>
              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {ROUND_LABELS[r]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative" style={{ width: totalW + CONNECTOR_W, height: totalHeight }}>
        <svg
          className="absolute inset-0 pointer-events-none"
          width={totalW + CONNECTOR_W}
          height={totalHeight}
        >
          {rounds.map((round, roundIdx) => {
            if (roundIdx === rounds.length - 1) return null
            const nextRound = rounds[roundIdx + 1]
            const currentNodes = byRound[round]
            const nextNodes = byRound[nextRound]
            if (!currentNodes.length || !nextNodes.length) return null

            return currentNodes.map((n, nIdx) => {
              const pairIdx = Math.floor(nIdx / 2)

              const currentY = getMatchupY(round, nIdx, currentNodes.length) + MATCHUP_H / 2
              const nextY = getMatchupY(nextRound, pairIdx, nextNodes.length) + MATCHUP_H / 2

              const currentX = roundIdx * (ROUND_W + CONNECTOR_W) + ROUND_W
              const nextX = (roundIdx + 1) * (ROUND_W + CONNECTOR_W)
              const midX = (currentX + nextX) / 2

              return (
                <g key={n.id}>
                  <line x1={currentX} y1={currentY} x2={midX} y2={currentY} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
                  <line x1={midX} y1={currentY} x2={midX} y2={nextY} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
                  {nIdx % 2 === 0 && (
                    <line x1={midX} y1={nextY} x2={nextX} y2={nextY} stroke="rgba(255,255,255,0.1)" strokeWidth={1.5} />
                  )}
                </g>
              )
            })
          })}
        </svg>

        {rounds.map((round, roundIdx) => {
          const roundNodes = byRound[round]
          return roundNodes.map((n, idx) => {
            const y = getMatchupY(round, idx, roundNodes.length)
            const x = roundIdx * (ROUND_W + CONNECTOR_W)
            return (
              <div
                key={n.id}
                className="absolute"
                style={{ top: y, left: x }}
              >
                <MatchupCell
                  node={n}
                  picks={picks}
                  seedMap={seedMap}
                  effective={effective}
                  locked={isPickLocked(n)}
                  savingNode={savingNode}
                  onPick={onPick}
                  readOnly={readOnly}
                  sleeperTeams={sleeperTeams}
                />
              </div>
            )
          })
        })}
      </div>
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
  const [activeRegion, setActiveRegion] = useState<string>("West")
  const [showTips, setShowTips] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const regionRefs = useRef<Record<string, HTMLDivElement | null>>({})

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
    fin.sort((a, b) => a.round - b.round || a.slot.localeCompare(b.slot))
    return { byRegion: reg, finals: fin }
  }, [nodesWithLive])

  const totalPicks = useMemo(() => {
    return Object.values(picks).filter(Boolean).length
  }, [picks])

  const totalGames = useMemo(() => {
    return nodesWithLive.filter(n => n.round >= 1).length
  }, [nodesWithLive])

  const progressPct = totalGames > 0 ? Math.round((totalPicks / totalGames) * 100) : 0

  const autoFill = useCallback(async () => {
    if (autoFilling || readOnly) return
    setAutoFilling(true)
    try {
      const res = await fetch('/api/bracket/auto-fill', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      if (res.ok) {
        window.location.reload()
      }
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
    if (!res.ok) {
      setPicks((p) => ({ ...p, [node.id]: prev }))
    }
  }, [picks, nodesWithLive, entryId, readOnly])

  function scrollToRegion(region: string) {
    setActiveRegion(region)
    const el = regionRefs.current[region]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
        <div className="flex justify-center gap-1 px-3 pb-3">
          {ALL_REGIONS.map(r => {
            const regionNodes = byRegion[r] || []
            const regionPicks = regionNodes.filter(n => picks[n.id]).length
            const regionTotal = regionNodes.length
            return (
              <div key={r} className="text-center flex-1">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>{REGION_SHORT[r]}</div>
                <div className="text-[10px] font-semibold mt-0.5" style={{ color: regionPicks === regionTotal && regionTotal > 0 ? '#22c55e' : '#fb923c' }}>
                  {regionPicks}/{regionTotal}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold">My Bracket</h2>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.15)' }}>
              <span className="text-xs font-bold" style={{ color: '#fb923c' }}>{totalPicks}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
              <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{totalGames}</span>
            </div>
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
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: progressPct === 100 ? '#22c55e' : '#fb923c' }}
        />
      </div>

      {/* Desktop full bracket */}
      <div className="hidden xl:block">
        <div
          ref={scrollRef}
          className="overflow-auto rounded-xl"
          style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="p-6">
            <div className="flex items-start gap-0 justify-center" style={{ minWidth: '1400px' }}>
              <div className="space-y-8">
                {REGION_ORDER_LEFT.map((region) => (
                  <div key={region} ref={(el) => { regionRefs.current[region] = el }}>
                    <RegionBracket
                      region={region}
                      nodes={byRegion[region]}
                      picks={picks}
                      seedMap={seedMap}
                      effective={effective}
                      savingNode={savingNode}
                      onPick={submitPick}
                      direction="ltr"
                      readOnly={readOnly}
                      sleeperTeams={sleeperTeams}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center justify-center px-6" style={{ minWidth: 220, paddingTop: '15%' }}>
                <div className="text-center mb-4">
                  <div
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    FINAL FOUR
                  </div>
                  <div className="w-12 h-0.5 mx-auto mt-2 rounded-full" style={{ background: 'rgba(251,146,60,0.3)' }} />
                </div>

                <div className="space-y-4">
                  {finals.filter(n => n.round === 5).map((n) => (
                    <MatchupCell
                      key={n.id}
                      node={n}
                      picks={picks}
                      seedMap={seedMap}
                      effective={effective}
                      locked={isPickLocked(n)}
                      savingNode={savingNode}
                      onPick={submitPick}
                      readOnly={readOnly}
                      sleeperTeams={sleeperTeams}
                    />
                  ))}
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    CHAMPIONSHIP
                  </div>
                  {finals.filter(n => n.round === 6).map((n) => (
                    <MatchupCell
                      key={n.id}
                      node={n}
                      picks={picks}
                      seedMap={seedMap}
                      effective={effective}
                      locked={isPickLocked(n)}
                      savingNode={savingNode}
                      onPick={submitPick}
                      readOnly={readOnly}
                      sleeperTeams={sleeperTeams}
                    />
                  ))}
                  {finals.filter(n => n.round === 6).length === 0 && finals.length > 0 && null}

                  <div className="mt-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.05))',
                        border: '2px solid rgba(251,146,60,0.25)',
                        boxShadow: '0 0 20px rgba(251,146,60,0.08)',
                      }}
                    >
                      <Trophy className="w-7 h-7" style={{ color: '#fb923c' }} />
                    </div>
                  </div>

                  {picks && (() => {
                    const champNode = finals.find(n => n.round === 6)
                    const champPick = champNode ? picks[champNode.id] : null
                    if (!champPick) return null
                    return (
                      <div className="mt-2 text-center">
                        <div className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Champion Pick</div>
                        <div className="text-sm font-bold mt-0.5" style={{ color: '#fb923c' }}>{champPick}</div>
                      </div>
                    )
                  })()}
                </div>

                {finals.length === 0 && (
                  <div className="text-[11px] text-center py-8" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    Final Four &amp; Championship<br/>games appear here
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {REGION_ORDER_RIGHT.map((region) => (
                  <div key={region} ref={(el) => { regionRefs.current[region] = el }}>
                    <RegionBracket
                      region={region}
                      nodes={byRegion[region]}
                      picks={picks}
                      seedMap={seedMap}
                      effective={effective}
                      savingNode={savingNode}
                      onPick={submitPick}
                      direction="rtl"
                      readOnly={readOnly}
                      sleeperTeams={sleeperTeams}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet view */}
      <div className="xl:hidden">
        <div className="rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Region pills */}
          <div className="flex gap-1.5 p-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {ALL_REGIONS.map((r) => {
              const isActive = activeRegion === r
              const regionNodes = byRegion[r] || []
              const regionPicks = regionNodes.filter(n => picks[n.id]).length
              const regionTotal = regionNodes.length
              const complete = regionPicks === regionTotal && regionTotal > 0
              return (
                <button
                  key={r}
                  onClick={() => scrollToRegion(r)}
                  className="flex-1 py-2 rounded-lg text-center transition-all"
                  style={{
                    background: isActive ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
                    border: isActive ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isActive ? '#fb923c' : 'rgba(255,255,255,0.35)' }}>
                    {REGION_SHORT[r]}
                  </div>
                  <div className="text-[9px] mt-0.5 font-semibold" style={{ color: complete ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                    {regionPicks}/{regionTotal}
                  </div>
                </button>
              )
            })}
            <button
              onClick={() => {
                setActiveRegion('finals')
                const el = regionRefs.current['finals']
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className="flex-1 py-2 rounded-lg text-center transition-all"
              style={{
                background: activeRegion === 'finals' ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
                border: activeRegion === 'finals' ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div className="text-[10px] font-bold" style={{ color: activeRegion === 'finals' ? '#fb923c' : 'rgba(255,255,255,0.35)' }}>
                <Trophy className="w-3 h-3 mx-auto" />
              </div>
              <div className="text-[9px] mt-0.5 font-semibold" style={{ color: 'rgba(255,255,255,0.2)' }}>F4</div>
            </button>
          </div>

          {/* Round header */}
          <div className="flex gap-0 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            {[1, 2, 3, 4].map((r) => (
              <div key={r} className="flex-1 text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>{ROUND_LABELS[r]}</div>
              </div>
            ))}
          </div>

          <div className="p-3 space-y-6">
            {ALL_REGIONS.map((region) => (
              <div key={region} ref={(el) => { regionRefs.current[region] = el }}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}
                  >
                    {REGION_LABELS[region]}
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-2" style={{ minWidth: 4 * 136 }}>
                    {[1, 2, 3, 4].map((round) => {
                      const roundNodes = (byRegion[region] || []).filter(n => n.round === round).sort((a, b) => a.slot.localeCompare(b.slot))
                      return (
                        <div key={round} className="space-y-1.5 flex-1" style={{ minWidth: 130 }}>
                          {roundNodes.map((n) => (
                            <MatchupCell
                              key={n.id}
                              node={n}
                              picks={picks}
                              seedMap={seedMap}
                              effective={effective}
                              locked={isPickLocked(n)}
                              savingNode={savingNode}
                              onPick={submitPick}
                              readOnly={readOnly}
                              compact
                              sleeperTeams={sleeperTeams}
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div ref={(el) => { regionRefs.current['finals'] = el }}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c' }}
                >
                  FINAL FOUR & CHAMPIONSHIP
                </div>
                <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </div>
              <div className="flex flex-col items-center gap-3">
                {finals.map((n) => (
                  <MatchupCell
                    key={n.id}
                    node={n}
                    picks={picks}
                    seedMap={seedMap}
                    effective={effective}
                    locked={isPickLocked(n)}
                    savingNode={savingNode}
                    onPick={submitPick}
                    readOnly={readOnly}
                    sleeperTeams={sleeperTeams}
                  />
                ))}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mt-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.05))',
                    border: '2px solid rgba(251,146,60,0.25)',
                  }}
                >
                  <Trophy className="w-6 h-6" style={{ color: '#fb923c' }} />
                </div>
                {picks && (() => {
                  const champNode = finals.find(n => n.round === 6)
                  const champPick = champNode ? picks[champNode.id] : null
                  if (!champPick) return null
                  return (
                    <div className="text-center">
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Champion</div>
                      <div className="text-sm font-bold" style={{ color: '#fb923c' }}>{champPick}</div>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
