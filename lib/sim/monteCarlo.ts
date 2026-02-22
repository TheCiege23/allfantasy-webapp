export type NodeData = {
  id: string
  round: number
  seedHome: number
  seedAway: number
  homeTeamName: string | null
  awayTeamName: string | null
  winProb: number
  points: number
  upsetDelta: number
}

export type WinProbEntry = {
  nodeId: string
  homeWinProb: number
}

export type SimulationResult = {
  summary: {
    winPct: number
    avgScore: number
    upsetRate: number
    chalkBaseline: number
    maxScore: number
    minScore: number
    avgSimUpsets: number
  }
  roundBreakdown: Record<string, number>
  scoring: string
  runs: number
  bracketId: string
  totalPicks: number
  totalGames: number
  completedAt: string
}

export function seedToWinProb(seedA: number | null, seedB: number | null): number {
  const a = seedA || 8
  const b = seedB || 8
  if (a === b) return 0.5
  const diff = b - a
  return 1 / (1 + Math.pow(10, -diff / 4))
}

export function roundToEdgePoints(round: number): number {
  const map: Record<number, number> = { 1: 1, 2: 2, 3: 5, 4: 10, 5: 18, 6: 30 }
  return map[round] || 1
}

export function buildWinProbTable(nodes: any[]): WinProbEntry[] {
  return nodes.map((n) => ({
    nodeId: n.id,
    homeWinProb: seedToWinProb(n.seedHome, n.seedAway),
  }))
}

export function buildNodeData(nodes: any[]): NodeData[] {
  return nodes.map((n) => ({
    id: n.id,
    round: n.round,
    seedHome: n.seedHome || 8,
    seedAway: n.seedAway || 8,
    homeTeamName: n.homeTeamName,
    awayTeamName: n.awayTeamName,
    winProb: seedToWinProb(n.seedHome, n.seedAway),
    points: roundToEdgePoints(n.round),
    upsetDelta: Math.abs((n.seedHome || 8) - (n.seedAway || 8)),
  }))
}

export function simulateTournamentRuns(opts: {
  runs: number
  nodeData: NodeData[]
  pickMap: Map<string, string>
  onProgress?: (pct: number) => Promise<void>
}): Promise<{
  summary: SimulationResult["summary"]
  roundBreakdown: Record<string, number>
}> {
  return runSimLoop(opts)
}

async function runSimLoop(opts: {
  runs: number
  nodeData: NodeData[]
  pickMap: Map<string, string>
  onProgress?: (pct: number) => Promise<void>
}) {
  const { runs, nodeData, pickMap, onProgress } = opts

  const chalkScore = nodeData.reduce((acc, nd) => {
    return acc + (nd.winProb >= 0.5 ? nd.points : 0)
  }, 0)

  let totalScore = 0
  let beatChalkCount = 0
  let totalUserUpsetHits = 0
  let totalSimUpsets = 0
  let maxScore = 0
  let minScore = Infinity
  const roundScores: Record<number, number> = {}

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

      if (isUpset) simUpsets++

      const userPick = pickMap.get(nd.id)
      if (userPick && userPick === winner) {
        let pts = nd.points
        if (isUpset) pts += nd.upsetDelta
        score += pts
        if (!roundScores[nd.round]) roundScores[nd.round] = 0
        roundScores[nd.round] += pts
        if (isUpset) userUpsetHits++
      }
    }

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

  const avgScore = Math.round(totalScore / runs)
  const winPct = Math.round((beatChalkCount / runs) * 1000) / 10
  const avgUpsetHits = Math.round((totalUserUpsetHits / runs) * 10) / 10
  const avgSimUpsets = Math.round((totalSimUpsets / runs) * 10) / 10

  const roundAvg: Record<string, number> = {}
  for (const [r, total] of Object.entries(roundScores)) {
    roundAvg[`R${r}`] = Math.round(total / runs)
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
    },
    roundBreakdown: roundAvg,
  }
}
