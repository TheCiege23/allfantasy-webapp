import { PrismaClient, TradeOfferMode, TradeOutcome } from "@prisma/client"

const prisma = new PrismaClient()

type LabeledRow = { p: number; y: 0 | 1 }
type LabeledRowWithId = { id: string; p: number; y: 0 | 1 }

const EDGES_SCORE = [
  0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45,
  0.48, 0.50, 0.52,
  0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00
]

type FlatScores = {
  lineupImpact: number
  vorp: number
  market: number
  behavior: number
  weights: [number, number, number, number]
  composite: number
}

type SegmentParts = {
  isSF: boolean | null
  isTEP: boolean | null
  teamCount: number | null
  opponentTradeSampleSize: number | null
}

type BucketStat = { bucket: number; n: number; meanPred: number; meanObs: number }

const DRIFT_KEYS = ['lineupImpact', 'vorp', 'market', 'behavior', 'composite'] as const
type DriftKey = typeof DRIFT_KEYS[number]

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

function getWeights(f: any): [number, number, number, number] {
  const w = f?.weights
  if (Array.isArray(w) && w.length === 4 && w.every((x: any) => Number.isFinite(Number(x)))) {
    return [Number(w[0]), Number(w[1]), Number(w[2]), Number(w[3])]
  }
  return [0.40, 0.25, 0.20, 0.15]
}

function extractFlatScores(featuresJson: any): FlatScores {
  const f = featuresJson ?? {}
  const lineupImpact = clamp01(Number(f.lineupImpact ?? 0.5))
  const vorp = clamp01(Number(f.vorp ?? 0.5))
  const market = clamp01(Number(f.market ?? 0.5))
  const behavior = clamp01(Number(f.behavior ?? 0.5))
  const weights = getWeights(f)
  const composite = clamp01(
    weights[0] * lineupImpact +
    weights[1] * vorp +
    weights[2] * market +
    weights[3] * behavior
  )
  return { lineupImpact, vorp, market, behavior, weights, composite }
}

function extractSegmentParts(featuresJson: any): SegmentParts {
  const seg = (featuresJson ?? {}).segmentParts ?? {}
  return {
    isSF: seg.isSuperflex ?? seg.isSF ?? null,
    isTEP: seg.isTEPremium ?? seg.isTEP ?? null,
    teamCount: seg.leagueSize ?? seg.teamCount ?? null,
    opponentTradeSampleSize: seg.opponentTradeSampleSize ?? null,
  }
}

function extractCapsApplied(featuresJson: any): string[] {
  const f = featuresJson ?? {}
  return Array.isArray(f.capsApplied) ? f.capsApplied : []
}

function leagueClassFromLegacy(l?: { leagueType?: string | null; specialtyFormat?: string | null }) {
  const lt = (l?.leagueType ?? "").toLowerCase()
  const sfmt = (l?.specialtyFormat ?? "").toLowerCase()
  if (sfmt && sfmt !== "standard") return "SPC"
  if (lt.includes("dyn")) return "DYN"
  if (lt.includes("red")) return "RED"
  return "UNK"
}

function buildSegmentKeyV2(x: {
  isSF: boolean | null
  isTEP: boolean | null
  teamCount: number | null
  opponentTradeSampleSize: number | null
  leagueClass: "DYN" | "RED" | "SPC" | "UNK"
}): string {
  const fmt = x.isSF ? "SF" : "1QB"
  const tep = x.isTEP ? "TEP" : "NONTEP"

  const sz = x.teamCount ?? 0
  const sizeBucket =
    sz >= 14 ? "SZ14P" :
    sz === 12 ? "SZ12" :
    sz === 10 ? "SZ10" :
    sz > 0 ? `SZ${sz}` : "SZUNK"

  const n = x.opponentTradeSampleSize ?? 0
  const hist =
    n >= 10 ? "H10P" :
    n >= 3 ? "H3_9" :
    "H0_2"

  return `${x.leagueClass}_${fmt}_${tep}_${sizeBucket}_${hist}`
}

function resolveSegmentKey(params: {
  legacy?: { isSF: boolean; isTEP: boolean; teamCount: number | null; leagueType?: string | null; specialtyFormat?: string | null }
  segParts: SegmentParts
}): string {
  const { legacy, segParts } = params
  const leagueClass = leagueClassFromLegacy(legacy)

  const isSF = legacy != null ? legacy.isSF : (segParts.isSF ?? null)
  const isTEP = legacy != null ? legacy.isTEP : (segParts.isTEP ?? null)
  const teamCount = legacy != null ? legacy.teamCount : (segParts.teamCount ?? null)
  const sample = segParts.opponentTradeSampleSize ?? 0

  return buildSegmentKeyV2({ leagueClass, isSF, isTEP, teamCount, opponentTradeSampleSize: sample })
}

function bucketIndex(p: number, B = 10): number {
  if (p >= 1) return B - 1
  if (p <= 0) return 0
  return Math.floor(p * B)
}

function computeBucketStats(rows: LabeledRow[], B = 10): BucketStat[] {
  const buckets = Array.from({ length: B }, (_, i) => ({
    bucket: i, n: 0, sumP: 0, sumY: 0
  }))

  for (const r of rows) {
    const b = bucketIndex(r.p, B)
    buckets[b].n++
    buckets[b].sumP += r.p
    buckets[b].sumY += r.y
  }

  return buckets.map(b => ({
    bucket: b.bucket,
    n: b.n,
    meanPred: b.n ? b.sumP / b.n : 0,
    meanObs: b.n ? b.sumY / b.n : 0
  }))
}

function computeECE(rows: LabeledRow[], B = 10): number {
  const N = rows.length
  if (!N) return 0
  const buckets = computeBucketStats(rows, B)
  let ece = 0
  for (const b of buckets) {
    if (!b.n) continue
    ece += (b.n / N) * Math.abs(b.meanPred - b.meanObs)
  }
  return ece
}

function band(rows: LabeledRow[], lo: number, hi: number): LabeledRow[] {
  return rows.filter(r => r.p >= lo && r.p < hi)
}

function computeBandedECE(rows: LabeledRow[]) {
  return {
    all: computeECE(rows, 10),
    mid: computeECE(band(rows, 0.40, 0.60), 4),
    hi:  computeECE(band(rows, 0.60, 0.80), 4),
    lo:  computeECE(band(rows, 0.20, 0.40), 4),
  }
}

function computeBrier(rows: LabeledRow[]): number {
  const N = rows.length
  if (N === 0) return 0
  let sum = 0
  for (const r of rows) {
    const d = r.p - r.y
    sum += d * d
  }
  return sum / N
}

function lowerBound(arr: number[], x: number): number {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] < x) lo = mid + 1
    else hi = mid
  }
  return lo
}

function upperBound(arr: number[], x: number): number {
  let lo = 0, hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid] <= x) lo = mid + 1
    else hi = mid
  }
  return lo
}

function computeAUC(rows: LabeledRow[]): number | null {
  const pos = rows.filter(r => r.y === 1).map(r => r.p).sort((a, b) => a - b)
  const neg = rows.filter(r => r.y === 0).map(r => r.p).sort((a, b) => a - b)
  const nPos = pos.length
  const nNeg = neg.length
  if (nPos < 30 || nNeg < 30) return null

  let wins = 0
  let ties = 0

  for (const p of pos) {
    const j = upperBound(neg, p - Number.EPSILON)
    wins += j

    const left = lowerBound(neg, p)
    const right = upperBound(neg, p)
    ties += Math.max(0, right - left)
  }

  return (wins + 0.5 * ties) / (nPos * nNeg)
}

function binCount(value: number, edges: number[]): number {
  const v = Math.max(edges[0], Math.min(edges[edges.length - 1], value))
  for (let i = 0; i < edges.length - 1; i++) {
    const left = edges[i]
    const right = edges[i + 1]
    const isLast = i === edges.length - 2
    if ((v >= left && v < right) || (isLast && v === right)) return i
  }
  return edges.length - 2
}

function computePSI(actual: number[], expected: number[], edges: number[]): number {
  const m = edges.length - 1
  const aCounts = Array(m).fill(0)
  const eCounts = Array(m).fill(0)
  for (const v of actual) aCounts[binCount(v, edges)]++
  for (const v of expected) eCounts[binCount(v, edges)]++

  const aN = actual.length || 1
  const eN = expected.length || 1

  let psi = 0
  for (let i = 0; i < m; i++) {
    const a = Math.max(aCounts[i] / aN, 1e-6)
    const e = Math.max(eCounts[i] / eN, 1e-6)
    psi += (a - e) * Math.log(a / e)
  }
  return psi
}

function histProportions(values: number[], edges: number[]): number[] {
  const m = edges.length - 1
  const counts = Array(m).fill(0)
  for (const v of values) counts[binCount(v, edges)]++
  const N = Math.max(1, values.length)
  return counts.map((c: number) => c / N)
}

function jsDivergence(p: number[], q: number[]): number {
  const eps = 1e-12
  const m = p.map((pi, i) => 0.5 * (pi + q[i]))
  const kl = (a: number[], b: number[]) =>
    a.reduce((s, ai, i) => {
      const A = Math.max(ai, eps)
      const B = Math.max(b[i], eps)
      return s + A * Math.log(A / B)
    }, 0)

  return 0.5 * kl(p, m) + 0.5 * kl(q, m)
}

function computePSIandJSD(cur: number[], base: number[], edges: number[]) {
  const psi = computePSI(cur, base, edges)
  const p = histProportions(base, edges)
  const q = histProportions(cur, edges)
  const jsd = jsDivergence(p, q)
  return { psi, jsd }
}

function corrPointBiserial(values: number[], ys: (0 | 1)[]): number | null {
  const n = Math.min(values.length, ys.length)
  if (n < 30) return null

  const vals = values.slice(0, n)
  const y = ys.slice(0, n)

  const mu = vals.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mu) * (v - mu), 0) / Math.max(1, n - 1))
  if (sd === 0) return 0

  const ones: number[] = []
  const zeros: number[] = []
  for (let i = 0; i < n; i++) (y[i] === 1 ? ones : zeros).push(vals[i])

  if (ones.length < 10 || zeros.length < 10) return null
  const m1 = ones.reduce((s, v) => s + v, 0) / ones.length
  const m0 = zeros.reduce((s, v) => s + v, 0) / zeros.length
  const p = ones.length / n
  const q = zeros.length / n
  return ((m1 - m0) / sd) * Math.sqrt(p * q)
}

function mean(values: number[]): number {
  if (!values.length) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const xs = [...values].sort((a, b) => a - b)
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))
  return xs[idx]
}

function scoreDist(values: number[]) {
  return {
    mean: mean(values),
    p10: percentile(values, 0.10),
    p50: percentile(values, 0.50),
    p90: percentile(values, 0.90),
  }
}

function weightStats(weightsArr: [number, number, number, number][]) {
  const out: Record<string, { mean: number; min: number; max: number }> = {
    w0: { mean: 0, min: 0, max: 0 },
    w1: { mean: 0, min: 0, max: 0 },
    w2: { mean: 0, min: 0, max: 0 },
    w3: { mean: 0, min: 0, max: 0 },
  }
  if (!weightsArr.length) return out

  for (let i = 0; i < 4; i++) {
    const vals = weightsArr.map(w => w[i]).filter(Number.isFinite)
    if (!vals.length) continue
    const mn = Math.min(...vals)
    const mx = Math.max(...vals)
    const mu = vals.reduce((s, v) => s + v, 0) / vals.length
    out[`w${i}`] = { mean: mu, min: mn, max: mx }
  }
  return out
}

function buildPsiJson(args: {
  cur: Record<DriftKey, number[]>
  base: Record<DriftKey, number[]>
  edges: number[]
}) {
  const psi: Record<string, number> = {}
  const jsd: Record<string, number> = {}

  for (const k of DRIFT_KEYS) {
    if (args.base[k].length < 200 || args.cur[k].length < 50) continue
    const r = computePSIandJSD(args.cur[k], args.base[k], args.edges)
    psi[k] = r.psi
    jsd[k] = r.jsd
  }

  return { psi, jsd }
}

function computeLiftAtTop10(labeled: LabeledRow[]): number | null {
  if (labeled.length < 20) return null
  const sorted = [...labeled].sort((a, b) => b.p - a.p)
  const top10Count = Math.max(1, Math.ceil(sorted.length * 0.10))
  const top10 = sorted.slice(0, top10Count)
  const top10AcceptRate = top10.reduce((s, r) => s + r.y, 0) / top10Count
  const baseAcceptRate = labeled.reduce((s, r) => s + r.y, 0) / labeled.length
  if (baseAcceptRate === 0) return null
  return top10AcceptRate / baseAcceptRate
}

function buildBucketStatsJson(args: {
  labeled: LabeledRow[]
  compositeScores: number[]
  weightsArr: [number, number, number, number][]
  corr: Record<string, number | null>
  meanPred: number
  meanObs: number
  confidenceScores: number[]
  confidenceLabels: string[]
}) {
  const reliability = computeBucketStats(args.labeled, 10)
  const eceBands = computeBandedECE(args.labeled)
  const dist = scoreDist(args.compositeScores)
  const weights = weightStats(args.weightsArr)

  const corrClean: Record<string, number> = {
    lineupImpact: args.corr.lineupImpact ?? 0,
    vorp: args.corr.vorp ?? 0,
    market: args.corr.market ?? 0,
    behavior: args.corr.behavior ?? 0,
  }

  const interceptDelta = args.meanObs - args.meanPred
  const intercept = {
    meanPred: args.meanPred,
    meanObs: args.meanObs,
    delta: interceptDelta,
  }

  const totalConf = args.confidenceLabels.length || 1
  const highCount = args.confidenceLabels.filter(l => l === 'HIGH').length
  const medCount = args.confidenceLabels.filter(l => l === 'MEDIUM').length
  const lowCount = args.confidenceLabels.filter(l => l === 'LOW').length
  const confidenceCoverage = {
    mean: args.confidenceScores.length > 0
      ? args.confidenceScores.reduce((s, v) => s + v, 0) / args.confidenceScores.length
      : 0,
    pctHigh: highCount / totalConf,
    pctMedium: medCount / totalConf,
    pctLow: lowCount / totalConf,
    total: args.confidenceLabels.length,
  }

  const liftTop10 = computeLiftAtTop10(args.labeled)

  return {
    reliability,
    scoreDist: dist,
    weights,
    ece: eceBands,
    corr: corrClean,
    intercept,
    confidenceCoverage,
    liftTop10,
  }
}

async function upsertModelMetricsDaily(args: {
  day: Date
  mode: TradeOfferMode
  segmentKey: string
  nOffers: number
  nLabeled: number
  nAccepted: number
  meanPred: number
  meanObs: number
  ece: number
  brier: number
  auc: number | null
  psiJson: { psi: Record<string, number>; jsd: Record<string, number> }
  capRateJson: Record<string, number>
  bucketStatsJson: Record<string, any>
  narrativeFailRate: number
}) {
  const existing = await prisma.modelMetricsDaily.findFirst({
    where: { day: args.day, mode: args.mode, segmentKey: args.segmentKey },
    select: { id: true }
  })

  const data = {
    day: args.day,
    mode: args.mode,
    segmentKey: args.segmentKey,
    nOffers: args.nOffers,
    nLabeled: args.nLabeled,
    nAccepted: args.nAccepted,
    meanPred: args.meanPred,
    meanObs: args.meanObs,
    ece: args.ece,
    brier: args.brier,
    auc: args.auc,
    psiJson: args.psiJson,
    capRateJson: args.capRateJson,
    bucketStatsJson: args.bucketStatsJson,
    narrativeFailRate: args.narrativeFailRate,
  }

  if (existing) {
    await prisma.modelMetricsDaily.update({
      where: { id: existing.id },
      data
    })
  } else {
    await prisma.modelMetricsDaily.create({ data })
  }
}

export async function rollupModelMetricsDaily(params: {
  day: Date
  mode: TradeOfferMode
}) {
  const dayStart = new Date(Date.UTC(params.day.getUTCFullYear(), params.day.getUTCMonth(), params.day.getUTCDate()))
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const baselineEnd = dayStart
  const baselineStart = new Date(dayStart.getTime() - 30 * 24 * 60 * 60 * 1000)

  const offers = await prisma.tradeOfferEvent.findMany({
    where: { mode: params.mode, createdAt: { gte: dayStart, lt: dayEnd } },
    select: {
      id: true,
      leagueId: true,
      acceptProb: true,
      featuresJson: true,
      narrativeValid: true,
      driverSetComplete: true,
      confidenceScore: true,
      confidenceLabel: true,
    }
  })

  if (offers.length === 0) return

  const offerById = new Map(offers.map(o => [o.id, o]))

  const leagueIds = Array.from(new Set(offers.map(o => o.leagueId).filter(Boolean))) as string[]
  const leagues = leagueIds.length
    ? await prisma.legacyLeague.findMany({
        where: { sleeperLeagueId: { in: leagueIds } },
        select: { sleeperLeagueId: true, isSF: true, isTEP: true, teamCount: true, leagueType: true, specialtyFormat: true }
      })
    : []
  const leagueMap = new Map(leagues.map(l => [l.sleeperLeagueId, l]))

  const outcomes = await prisma.tradeOutcomeEvent.findMany({
    where: {
      offerEventId: { in: offers.map(o => o.id) },
    },
    select: { offerEventId: true, outcome: true }
  })
  const outcomeMap = new Map(outcomes.map(o => [o.offerEventId!, o.outcome]))

  type Group = {
    offers: typeof offers
    labeled: LabeledRow[]
    labeledWithId: LabeledRowWithId[]
    capCounts: Record<string, number>
    confidenceScores: number[]
    confidenceLabels: string[]
  }
  const groups = new Map<string, Group>()

  for (const off of offers) {
    const segParts = extractSegmentParts(off.featuresJson)
    const legacy = off.leagueId ? leagueMap.get(off.leagueId) : undefined
    const segmentKey = resolveSegmentKey({ legacy: legacy as any, segParts })

    if (!groups.has(segmentKey)) groups.set(segmentKey, { offers: [], labeled: [], labeledWithId: [], capCounts: {}, confidenceScores: [], confidenceLabels: [] })
    const g = groups.get(segmentKey)!
    g.offers.push(off)

    for (const cap of extractCapsApplied(off.featuresJson)) {
      g.capCounts[cap] = (g.capCounts[cap] ?? 0) + 1
    }

    if (off.confidenceScore != null) g.confidenceScores.push(off.confidenceScore)
    if (off.confidenceLabel) g.confidenceLabels.push(off.confidenceLabel)

    const out = outcomeMap.get(off.id)
    if (out === TradeOutcome.ACCEPTED || out === TradeOutcome.REJECTED || out === TradeOutcome.EXPIRED) {
      const p = clamp01(off.acceptProb)
      const y: 0 | 1 = out === TradeOutcome.ACCEPTED ? 1 : 0
      g.labeled.push({ p, y })
      g.labeledWithId.push({ id: off.id, p, y })
    }
  }

  const baseOffers = await prisma.tradeOfferEvent.findMany({
    where: {
      mode: params.mode,
      createdAt: { gte: baselineStart, lt: baselineEnd },
    },
    select: { featuresJson: true, leagueId: true }
  })

  const baseLeagueIds = Array.from(new Set(baseOffers.map(o => o.leagueId).filter(Boolean))) as string[]
  const baseLeagues = baseLeagueIds.length
    ? await prisma.legacyLeague.findMany({
        where: { sleeperLeagueId: { in: baseLeagueIds } },
        select: { sleeperLeagueId: true, isSF: true, isTEP: true, teamCount: true, leagueType: true, specialtyFormat: true }
      })
    : []
  const baseLeagueMap = new Map(baseLeagues.map(l => [l.sleeperLeagueId, l]))

  const baseBySegment = new Map<string, Record<DriftKey, number[]>>()
  for (const o of baseOffers) {
    const segParts = extractSegmentParts(o.featuresJson)
    const legacy = o.leagueId ? baseLeagueMap.get(o.leagueId) : undefined
    const segKey = resolveSegmentKey({ legacy: legacy as any, segParts })

    if (!baseBySegment.has(segKey)) {
      baseBySegment.set(segKey, { lineupImpact: [], vorp: [], market: [], behavior: [], composite: [] })
    }
    const bucket = baseBySegment.get(segKey)!
    const s = extractFlatScores(o.featuresJson)
    bucket.lineupImpact.push(s.lineupImpact)
    bucket.vorp.push(s.vorp)
    bucket.market.push(s.market)
    bucket.behavior.push(s.behavior)
    bucket.composite.push(s.composite)
  }

  for (const [segmentKey, g] of groups) {
    const nOffers = g.offers.length
    const nLabeled = g.labeled.length
    const nAccepted = g.labeled.reduce((s, r) => s + r.y, 0)

    const meanPredVal = nLabeled ? g.labeled.reduce((s, r) => s + r.p, 0) / nLabeled : 0
    const meanObsVal = nLabeled ? nAccepted / nLabeled : 0

    const ece = computeECE(g.labeled, 10)
    const brier = computeBrier(g.labeled)
    const auc = computeAUC(g.labeled)

    const narrativeFailRate = nOffers
      ? g.offers.filter(o => !o.narrativeValid || !o.driverSetComplete).length / nOffers
      : 0

    const capRateJson: Record<string, number> = {}
    for (const [capId, count] of Object.entries(g.capCounts)) {
      capRateJson[capId] = count / Math.max(1, nOffers)
    }

    const curScores: Record<DriftKey, number[]> = { lineupImpact: [], vorp: [], market: [], behavior: [], composite: [] }
    const weightsArr: [number, number, number, number][] = []

    for (const off of g.offers) {
      const s = extractFlatScores(off.featuresJson)
      curScores.lineupImpact.push(s.lineupImpact)
      curScores.vorp.push(s.vorp)
      curScores.market.push(s.market)
      curScores.behavior.push(s.behavior)
      curScores.composite.push(s.composite)
      weightsArr.push(s.weights)
    }

    const labeledPairs: { s: FlatScores; y: 0 | 1 }[] = []
    for (const lr of g.labeledWithId) {
      const off = offerById.get(lr.id)
      if (!off) continue
      labeledPairs.push({ s: extractFlatScores(off.featuresJson), y: lr.y })
    }

    const corr: Record<string, number | null> = {
      lineupImpact: corrPointBiserial(labeledPairs.map(p => p.s.lineupImpact), labeledPairs.map(p => p.y)),
      vorp: corrPointBiserial(labeledPairs.map(p => p.s.vorp), labeledPairs.map(p => p.y)),
      market: corrPointBiserial(labeledPairs.map(p => p.s.market), labeledPairs.map(p => p.y)),
      behavior: corrPointBiserial(labeledPairs.map(p => p.s.behavior), labeledPairs.map(p => p.y)),
    }

    const baseScores = baseBySegment.get(segmentKey) ?? { lineupImpact: [], vorp: [], market: [], behavior: [], composite: [] }

    const psiJson = buildPsiJson({ cur: curScores, base: baseScores, edges: EDGES_SCORE })

    const bucketStatsJson = buildBucketStatsJson({
      labeled: g.labeled,
      compositeScores: curScores.composite,
      weightsArr,
      corr,
      meanPred: meanPredVal,
      meanObs: meanObsVal,
      confidenceScores: g.confidenceScores,
      confidenceLabels: g.confidenceLabels,
    })

    await upsertModelMetricsDaily({
      day: dayStart,
      mode: params.mode,
      segmentKey,
      nOffers,
      nLabeled,
      nAccepted,
      meanPred: meanPredVal,
      meanObs: meanObsVal,
      ece,
      brier,
      auc,
      psiJson,
      capRateJson,
      bucketStatsJson,
      narrativeFailRate,
    })
  }
}

async function main() {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const modes: TradeOfferMode[] = [
    TradeOfferMode.INSTANT,
    TradeOfferMode.STRUCTURED,
    TradeOfferMode.TRADE_HUB,
    TradeOfferMode.TRADE_IDEAS,
    TradeOfferMode.PROPOSAL_GENERATOR
  ]

  for (const m of modes) {
    await rollupModelMetricsDaily({ day: yesterday, mode: m })
  }
}

if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
