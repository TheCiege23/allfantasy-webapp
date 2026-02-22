"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { Trophy } from "lucide-react"
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
  1: "RD 1",
  2: "RD 2",
  3: "SWEET 16",
  4: "ELITE 8",
}

const REGION_LABELS: Record<string, string> = {
  West: "W",
  East: "E",
  South: "S",
  Midwest: "MW",
}

function teamLabel(name: string | null, seed: number | null): string {
  if (!name) return ""
  return seed != null ? `${seed} ${name}` : name
}

function teamSeedLabel(seed: number | null): string {
  return seed != null ? String(seed) : ""
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

const MATCHUP_H = 48
const MATCHUP_GAP = 4
const ROUND_W = 140
const CONNECTOR_W = 20

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
  const h = compact ? 38 : MATCHUP_H

  function TeamRow({ name, seed, isPicked, side }: { name: string | null; seed: number | null; isPicked: boolean; side: 'home' | 'away' }) {
    const canClick = !readOnly && !locked && !!name
    return (
      <button
        disabled={!canClick}
        onClick={() => name && onPick(node, name)}
        className="w-full flex items-center text-left transition-colors"
        style={{
          height: h / 2,
          background: isPicked ? 'rgba(251,146,60,0.2)' : 'rgba(255,255,255,0.03)',
          borderBottom: side === 'home' ? '1px solid rgba(255,255,255,0.06)' : undefined,
          cursor: canClick ? 'pointer' : 'default',
          paddingLeft: 6,
          paddingRight: 6,
        }}
      >
        {seed != null && (
          <span className="text-[10px] font-bold w-4 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {seed}
          </span>
        )}
        <span
          className="text-[11px] font-medium truncate flex-1"
          style={{ color: name ? (isPicked ? '#fb923c' : 'rgba(255,255,255,0.8)') : 'rgba(255,255,255,0.15)' }}
        >
          {name || ''}
        </span>
        {node.game && (
          <span className="text-[10px] font-bold shrink-0 ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {side === 'home' ? (node.game.homeScore ?? '') : (node.game.awayScore ?? '')}
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="rounded overflow-hidden"
      style={{
        width: compact ? 110 : ROUND_W,
        height: h,
        border: picked ? '1px solid rgba(251,146,60,0.3)' : '1px solid rgba(255,255,255,0.08)',
        background: '#1a1f2e',
      }}
    >
      <TeamRow name={homeName} seed={homeSeed} isPicked={homePicked} side="home" />
      <TeamRow name={awayName} seed={awaySeed} isPicked={awayPicked} side="away" />
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

  return (
    <div className="relative" style={{ minWidth: rounds.length * (ROUND_W + CONNECTOR_W) }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="text-[40px] sm:text-[56px] font-black uppercase tracking-wider"
          style={{ color: 'rgba(255,255,255,0.03)' }}
        >
          {region}
        </span>
      </div>

      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: totalHeight }}
      >
        {rounds.map((round, roundIdx) => {
          if (roundIdx === rounds.length - 1) return null
          const nextRound = rounds[roundIdx + 1]
          const currentNodes = byRound[round]
          const nextNodes = byRound[nextRound]
          if (!currentNodes.length || !nextNodes.length) return null

          return currentNodes.map((n, nIdx) => {
            const pairIdx = Math.floor(nIdx / 2)
            const isFirst = nIdx % 2 === 0

            const currentY = getMatchupY(round, nIdx, currentNodes.length) + MATCHUP_H / 2
            const nextY = getMatchupY(nextRound, pairIdx, nextNodes.length) + MATCHUP_H / 2

            const currentX = roundIdx * (ROUND_W + CONNECTOR_W) + ROUND_W
            const nextX = (roundIdx + 1) * (ROUND_W + CONNECTOR_W)
            const midX = currentX + CONNECTOR_W / 2

            return (
              <g key={n.id}>
                <line x1={currentX} y1={currentY} x2={midX} y2={currentY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                <line x1={midX} y1={currentY} x2={midX} y2={nextY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                {isFirst && (
                  <line x1={midX} y1={nextY} x2={nextX} y2={nextY} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
                )}
              </g>
            )
          })
        })}
      </svg>

      <div className="relative flex" style={{ height: totalHeight }}>
        {rounds.map((round, roundIdx) => {
          const roundNodes = byRound[round]
          return (
            <div
              key={round}
              className="relative"
              style={{ width: ROUND_W + (roundIdx < rounds.length - 1 ? CONNECTOR_W : 0) }}
            >
              {roundNodes.map((n, idx) => {
                const y = getMatchupY(round, idx, roundNodes.length)
                return (
                  <div
                    key={n.id}
                    className="absolute"
                    style={{ top: y, left: 0 }}
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
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BracketTreeView({ tournamentId, leagueId, entryId, nodes, initialPicks, readOnly, compact }: Props) {
  const { data: live } = useBracketLive({ tournamentId, leagueId, enabled: true, intervalMs: 15000 })

  const [picks, setPicks] = useState<Record<string, string | null>>(initialPicks)
  const [savingNode, setSavingNode] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)

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

  const ff = useMemo(() => nodesWithLive.filter(n => n.round === 0).sort((a, b) => a.slot.localeCompare(b.slot)), [nodesWithLive])

  if (compact) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: '#0f1319', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="p-3 text-center">
          <div className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>My Bracket</div>
          <div className="text-sm mt-1">
            <span className="font-bold" style={{ color: '#fb923c' }}>{totalPicks}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}> out of </span>
            <span className="font-bold">{totalGames}</span>
          </div>
        </div>
        <div className="flex justify-center gap-0.5 px-2 pb-3">
          {ALL_REGIONS.map(r => {
            const regionNodes = byRegion[r] || []
            const regionPicks = regionNodes.filter(n => picks[n.id]).length
            return (
              <div key={r} className="text-center px-2">
                <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>{REGION_LABELS[r]}</div>
                <div className="w-8 h-1 rounded-full mt-1" style={{ background: regionPicks > 0 ? '#fb923c' : 'rgba(255,255,255,0.06)' }} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">My Bracket</h2>
          <span className="text-sm" style={{ color: '#fb923c' }}>{totalPicks}/{totalGames}</span>
        </div>
      </div>

      <div className="hidden xl:block">
        <div
          ref={scrollRef}
          className="overflow-auto rounded-xl p-4"
          style={{ background: '#0f1319', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-start gap-0 justify-center" style={{ minWidth: '1200px' }}>
            <div className="space-y-6">
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
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-center px-4" style={{ minWidth: 200, paddingTop: '20%' }}>
              <div className="text-center mb-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>FINAL FOUR</div>
              </div>
              <div className="space-y-3">
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
                  />
                ))}
              </div>
              {finals.length === 0 && (
                <div className="text-[11px] text-center py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Final Four slots appear here
                </div>
              )}
              <div className="mt-3 text-center">
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>Championship</div>
                <div className="w-10 h-10 mx-auto mt-2 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)' }}>
                  <Trophy className="w-5 h-5" style={{ color: '#fb923c' }} />
                </div>
                <div className="text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>No tiebreaker yet</div>
              </div>
            </div>

            <div className="space-y-6">
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
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="xl:hidden">
        <div className="overflow-auto" style={{ background: '#0f1319', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="sticky top-0 z-10 flex gap-0" style={{ background: '#0f1319', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {[1, 2, 3, 4].map((r) => (
              <div key={r} className="flex-1 text-center py-2">
                <div className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>{ROUND_LABELS[r]}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1 p-2">
            {ALL_REGIONS.map((region) => (
              <div key={region} ref={(el) => { regionRefs.current[region] = el }}>
                <div className="flex items-center gap-2 py-2 px-1">
                  <span className="text-[28px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.06)' }}>
                    {region}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <div className="flex gap-2" style={{ minWidth: 4 * 120 + 3 * 8 }}>
                    {[1, 2, 3, 4].map((round) => {
                      const roundNodes = (byRegion[region] || []).filter(n => n.round === round).sort((a, b) => a.slot.localeCompare(b.slot))
                      return (
                        <div key={round} className="space-y-1" style={{ width: 120 }}>
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
                            />
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center py-4">
              <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>FINAL FOUR & CHAMPIONSHIP</div>
              <div className="flex flex-col items-center gap-2">
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
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-20 right-4 z-50">
          <div className="grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden shadow-lg" style={{ background: '#1a1f2e', border: '2px solid #fb923c' }}>
            {ALL_REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => scrollToRegion(r)}
                className="px-3 py-2 text-xs font-bold transition"
                style={{
                  background: activeRegion === r ? 'rgba(251,146,60,0.2)' : 'transparent',
                  color: activeRegion === r ? '#fb923c' : 'rgba(255,255,255,0.5)',
                }}
              >
                {REGION_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
