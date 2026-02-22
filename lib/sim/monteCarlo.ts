export type ScoringMode = "EDGE" | "MOMENTUM" | "STREAK"

export type Round = "R64" | "R32" | "S16" | "E8" | "F4" | "CH"

export type NodeData = {
  id: string
  round: number
  roundLabel: Round
  seedHome: number
  seedAway: number
  homeTeamName: string | null
  awayTeamName: string | null
  winProb: number
  upsetDelta: number
}

export type WinProbTable = Record<string, number>

export type SimulationResult = {
  summary: {
    winPct: number
    avgScore: number
    upsetRate: number
    chalkBaseline: number
    maxScore: number
    minScore: number
    avgSimUpsets: number
    p50: number
    p90: number
    p99: number
    volatility: number
  }
  roundBreakdown: Record<string, number>
  scoring: string
  runs: number
  bracketId: string
  totalPicks: number
  totalGames: number
  completedAt: string
  note: string
}

const ROUND_NUM_TO_LABEL: Record<number, Round> = {
  1: "R64",
  2: "R32",
  3: "S16",
  4: "E8",
  5: "F4",
  6: "CH",
}

export function seedToWinProb(seedA: number | null, seedB: number | null): number {
  const a = seedA || 8
  const b = seedB || 8
  if (a === b) return 0.5
  const gap = b - a
  return clamp01(0.5 + clamp(gap * 0.03, -0.25, 0.25))
}

export function buildWinProbTable(nodes: any[]): WinProbTable {
  const table: WinProbTable = {}
  for (const n of nodes) {
    if (!n.homeTeamName || !n.awayTeamName || n.seedHome == null || n.seedAway == null) continue
    table[n.id] = seedToWinProb(n.seedHome, n.seedAway)
  }
  return table
}

export function buildNodeData(nodes: any[]): NodeData[] {
  return nodes.map((n) => ({
    id: n.id,
    round: n.round,
    roundLabel: ROUND_NUM_TO_LABEL[n.round] ?? "R64",
    seedHome: n.seedHome || 8,
    seedAway: n.seedAway || 8,
    homeTeamName: n.homeTeamName,
    awayTeamName: n.awayTeamName,
    winProb: seedToWinProb(n.seedHome, n.seedAway),
    upsetDelta: Math.abs((n.seedHome || 8) - (n.seedAway || 8)),
  }))
}

export async function simulateTournamentRuns(opts: {
  runs: number
  nodeData: NodeData[]
  pickMap: Map<string, string>
  scoringMode?: ScoringMode
  onProgress?: (pct: number) => Promise<void>
}): Promise<{
  summary: SimulationResult["summary"]
  roundBreakdown: Record<string, number>
  note: string
}> {
  const { runs, nodeData, pickMap, onProgress, scoringMode = "EDGE" } = opts

  const chalkScore = nodeData.reduce((acc, nd) => {
    return acc + (nd.winProb >= 0.5 ? baseByRound(nd.roundLabel) : 0)
  }, 0)

  let totalScore = 0
  let beatChalkCount = 0
  let totalUserUpsetHits = 0
  let totalSimUpsets = 0
  let maxScore = 0
  let minScore = Infinity
  const roundScores: Record<number, number> = {}
  const scoreSamples: number[] = []

  const progressInterval = Math.max(1, Math.floor(runs / 20))

  for (let i = 0; i < runs; i++) {
    let score = 0
    let simUpsets = 0
    let userUpsetHits = 0

    for (const nd of nodeData) {
      const homeWins = Math.random() < nd.winProb
      const winner = homeWins ? nd.homeTeamName : nd.awayTeamName
      const winnerSeed = homeWins ? nd.seedHome : nd.seedAway
      const loserSeed = homeWins ? nd.seedAway : nd.seedHome
      const isUpset = winnerSeed > loserSeed
      const seedGap = Math.max(0, winnerSeed - loserSeed)

      if (isUpset) simUpsets++

      const userPick = pickMap.get(nd.id)
      if (userPick && userPick === winner) {
        const pts = scoreGame({
          round: nd.roundLabel,
          underdogWon: isUpset,
          seedGap,
          pickUniqPct: null,
          mode: scoringMode,
        })
        score += pts
        if (!roundScores[nd.round]) roundScores[nd.round] = 0
        roundScores[nd.round] += pts
        if (isUpset) userUpsetHits++
      }
    }

    scoreSamples.push(score)
    totalScore += score
    totalSimUpsets += simUpsets
    totalUserUpsetHits += userUpsetHits
    if (score > chalkScore) beatChalkCount++
    if (score > maxScore) maxScore = score
    if (score < minScore) minScore = score

    if (onProgress && i % progressInterval === 0) {
      await onProgress(Math.round((i / runs) * 100))
    }
  }

  scoreSamples.sort((a, b) => a - b)

  const avgScore = Math.round(totalScore / runs)
  const winPct = Math.round((beatChalkCount / runs) * 1000) / 10
  const avgUpsetHits = Math.round((totalUserUpsetHits / runs) * 10) / 10
  const avgSimUpsets = Math.round((totalSimUpsets / runs) * 10) / 10

  const roundAvg: Record<string, number> = {}
  for (const [r, total] of Object.entries(roundScores)) {
    const label = ROUND_NUM_TO_LABEL[Number(r)] ?? `R${r}`
    roundAvg[label] = Math.round(total / runs)
  }

  return {
    summary: {
      winPct,
      avgScore,
      upsetRate: avgUpsetHits,
      chalkBaseline: chalkScore,
      maxScore,
      minScore: minScore === Infinity ? 0 : minScore,
      avgSimUpsets,
      p50: quantile(scoreSamples, 0.5),
      p90: quantile(scoreSamples, 0.9),
      p99: quantile(scoreSamples, 0.99),
      volatility: stddev(scoreSamples),
    },
    roundBreakdown: roundAvg,
    note: "MVP simulation (independent games). Upgrade to full bracket tree for production accuracy.",
  }
}

function scoreGame(opts: {
  round: Round
  underdogWon: boolean
  seedGap: number
  pickUniqPct: number | null
  mode: ScoringMode
}): number {
  const { round, underdogWon, seedGap, pickUniqPct, mode } = opts
  const base = baseByRound(round)

  if (mode === "MOMENTUM") {
    const upset = underdogWon ? Math.min(6, seedGap / 2) : 0
    return base + upset
  }

  if (mode === "EDGE") {
    const upset = underdogWon ? Math.min(6, seedGap / 2) : 0
    const leverage =
      pickUniqPct == null ? 0 : Math.min(5, base * (1 - pickUniqPct) * 0.75)
    return base + upset + leverage
  }

  return base
}

function baseByRound(r: Round): number {
  switch (r) {
    case "R64": return 1
    case "R32": return 2
    case "S16": return 5
    case "E8": return 10
    case "F4": return 18
    case "CH": return 30
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] === undefined) return sorted[base]
  return Math.round((sorted[base] + rest * (sorted[base + 1] - sorted[base])) * 10) / 10
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const v = arr.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (arr.length - 1)
  return Math.round(Math.sqrt(v) * 10) / 10
}
