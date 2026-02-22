"use client"

import { useMemo, useState, useCallback } from "react"
import { Timer, Trophy, Lock, Loader2 } from "lucide-react"
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

const REGION_ORDER = ["West", "East", "South", "Midwest"]
const REGION_ABBREV: Record<string, string> = { West: "W", East: "E", South: "S", Midwest: "MW" }
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

  function TeamButton({ node, name, seed, isPicked, locked, isPropagated, score }: {
    node: Node; name: string | null; seed: number | null; isPicked: boolean; locked: boolean; isPropagated: boolean; score: number | null | undefined
  }) {
    const isSaving = savingNode === node.id
    const canClick = !!name && !locked && !isSaving
    return (
      <button
        disabled={!canClick}
        onClick={() => name && submitPick(node, name)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          width: '100%',
          padding: '7px 10px',
          borderRadius: 8,
          border: isPicked
            ? '1.5px solid rgba(56,189,248,0.6)'
            : '1px solid rgba(255,255,255,0.08)',
          background: isPicked
            ? 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(139,92,246,0.12) 100%)'
            : 'rgba(255,255,255,0.03)',
          cursor: canClick ? 'pointer' : 'default',
          opacity: (!name && isPropagated) ? 0.35 : locked && !isPicked ? 0.55 : 1,
          transition: 'all 0.15s ease',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: 12,
          fontWeight: isPicked ? 600 : 400,
          color: !name ? 'rgba(255,255,255,0.2)' : isPicked ? '#e0f2fe' : 'rgba(255,255,255,0.75)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: !name ? 'italic' : undefined,
        }}>
          {name ? teamLabel(name, seed) : 'TBD'}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.3)',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {score ?? '-'}
        </span>
      </button>
    )
  }

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
    const isSaving = savingNode === node.id

    return (
      <div style={{
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.07)',
        background: '#1e2740',
        padding: compact ? 6 : 8,
        position: 'relative',
      }}>
        {!compact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>{node.slot}</span>
            {node.game?.status && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{node.game.status}</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
          <TeamButton
            node={node}
            name={homeName}
            seed={homeSeed}
            isPicked={homePicked}
            locked={locked}
            isPropagated={isPropagated}
            score={node.game?.homeScore}
          />
          <TeamButton
            node={node}
            name={awayName}
            seed={awaySeed}
            isPicked={awayPicked}
            locked={locked}
            isPropagated={isPropagated}
            score={node.game?.awayScore}
          />
        </div>

        {!compact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 6,
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {locked && <Lock style={{ width: 10, height: 10 }} />}
              {isSaving && <Loader2 style={{ width: 10, height: 10, animation: 'spin 1s linear infinite' }} />}
              {locked ? "Locked" : isSaving ? "Saving..." : homeName && awayName ? "Pick winner" : "Waiting for picks"}
            </span>
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

    const abbrev = REGION_ABBREV[region] ?? region

    return (
      <div style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        background: '#151d30',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: abbrev.length > 1 ? 80 : 96,
          fontWeight: 900,
          color: 'rgba(255,255,255,0.03)',
          letterSpacing: 8,
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          {abbrev}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          position: 'relative',
          zIndex: 1,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.9)',
              letterSpacing: 0.3,
            }}>{region}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(56,189,248,0.6)',
              background: 'rgba(56,189,248,0.08)',
              padding: '2px 8px',
              borderRadius: 6,
              letterSpacing: 0.5,
            }}>{abbrev}</span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))',
          gap: 10,
          position: 'relative',
          zIndex: 1,
        }}>
          {ROUND_COLS.map((c) => (
            <div key={`${region}-${c.round}`}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: 1.2,
                color: 'rgba(255,255,255,0.25)',
                marginBottom: 8,
                paddingLeft: 2,
              }}>{c.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byRound[c.round].map((n) => (
                  <GameCard key={n.id} node={n} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function FinalsCenter() {
    const ffNodes = finals.filter(n => n.round === 5)
    const champNodes = finals.filter(n => n.round === 6)
    const champPick = champNodes[0] ? picks[champNodes[0].id] : null

    return (
      <div style={{
        borderRadius: 16,
        border: '1px solid rgba(56,189,248,0.15)',
        background: 'linear-gradient(180deg, #1a2238 0%, #151d30 100%)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: 3,
          color: 'rgba(255,255,255,0.4)',
          marginBottom: 12,
        }}>Championship</div>

        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          border: '1.5px solid rgba(56,189,248,0.25)',
          background: 'rgba(56,189,248,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Trophy style={{ width: 22, height: 22, color: 'rgba(56,189,248,0.5)' }} />
        </div>

        {champPick && (
          <div style={{
            textAlign: 'center',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: 1.5 }}>Champion</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>{champPick}</div>
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ffNodes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' as const, letterSpacing: 1 }}>Final Four</div>
              {ffNodes.map((n) => <GameCard key={n.id} node={n} />)}
            </div>
          )}

          {champNodes.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 1 }}>National Championship</div>
              {champNodes.map((n) => <GameCard key={n.id} node={n} />)}
            </div>
          )}

          {finals.length === 0 && (
            <div style={{
              borderRadius: 10,
              border: '1px dashed rgba(255,255,255,0.1)',
              padding: 16,
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.2)',
            }}>
              Final Four slots will appear here
            </div>
          )}
        </div>
      </div>
    )
  }

  function FirstFourBlock() {
    if (!firstFour.length) return null
    return (
      <div style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        background: '#151d30',
        padding: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>First Four</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}>
          {firstFour.map((n) => <GameCard key={n.id} node={n} />)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'linear-gradient(135deg, #1a1f4e 0%, #1a2238 50%, #151d30 100%)',
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Timer style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.4)' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            Brackets open on {openDate}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {waitingForSelection ? "Waiting for Selection Sunday" : "Make your picks before games lock"}
          </div>
        </div>
      </div>

      <FirstFourBlock />

      <div className="hidden xl:grid" style={{
        gridTemplateColumns: '1fr 320px 1fr',
        gap: 16,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.05)',
        background: '#111827',
        padding: 16,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RegionMini region="West" />
          <RegionMini region="East" />
        </div>
        <FinalsCenter />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RegionMini region="South" />
          <RegionMini region="Midwest" />
        </div>
      </div>

      <div className="xl:hidden" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {REGION_ORDER.map((region) => (
          <RegionMini key={region} region={region} />
        ))}
        <FinalsCenter />
      </div>
    </div>
  )
}
