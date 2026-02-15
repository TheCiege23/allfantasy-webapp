import { prisma } from '@/lib/prisma'
import { TradeOfferMode, TradeOutcome } from '@prisma/client'

type LeagueClass = 'DYN' | 'RED' | 'SPC' | 'UNK'

interface LegacyLeagueRow {
  sleeperLeagueId: string
  isSF: boolean
  isTEP: boolean
  teamCount: number | null
  leagueType: string | null
  specialtyFormat: string | null
}

export function leagueClassFromLegacy(l?: {
  leagueType?: string | null
  specialtyFormat?: string | null
}): LeagueClass {
  const lt = (l?.leagueType ?? '').toLowerCase()
  const sfmt = (l?.specialtyFormat ?? '').toLowerCase()
  if (sfmt && sfmt !== 'standard') return 'SPC'
  if (lt.includes('dyn')) return 'DYN'
  if (lt.includes('red')) return 'RED'
  return 'UNK'
}

export function buildSegmentKey(x: {
  isSF: boolean | null
  isTEP: boolean | null
  teamCount: number | null
  opponentTradeSampleSize: number | null
  leagueClass: LeagueClass
}): string {
  const fmt = x.isSF ? 'SF' : '1QB'
  const tep = x.isTEP ? 'TEP' : 'NONTEP'

  const sz = x.teamCount ?? 0
  const sizeBucket =
    sz >= 14 ? 'SZ14P' :
    sz === 12 ? 'SZ12' :
    sz === 10 ? 'SZ10' :
    sz > 0 ? `SZ${sz}` : 'SZUNK'

  const n = x.opponentTradeSampleSize ?? 0
  const hist =
    n >= 10 ? 'H10P' :
    n >= 3 ? 'H3_9' :
    'H0_2'

  return `${x.leagueClass}_${fmt}_${tep}_${sizeBucket}_${hist}`
}

function buildSegmentKeyFromOffer(
  offer: any,
  leagueMap: Map<string, LegacyLeagueRow>,
): string {
  const legacy = offer.leagueId ? leagueMap.get(offer.leagueId) : undefined
  const parts = offer.featuresJson?.segmentParts ?? {}

  const leagueClass = leagueClassFromLegacy(legacy)

  return buildSegmentKey({
    leagueClass,
    isSF: legacy?.isSF ?? parts.isSuperflex ?? null,
    isTEP: legacy?.isTEP ?? parts.isTEPremium ?? null,
    teamCount: legacy?.teamCount ?? parts.leagueSize ?? null,
    opponentTradeSampleSize: parts.opponentTradeSampleSize ?? offer.featuresJson?.managerSampleSize ?? 0,
  })
}

interface LabeledRow {
  p: number
  y: number
}

interface SegmentGroup {
  offers: any[]
  labeled: LabeledRow[]
  capCounts: Record<string, number>
}

export type BucketStats = {
  bucketCount: number[]
  bucketMeanPred: number[]
  bucketMeanObs: number[]
}

function bucketIndex(p: number, B = 10): number {
  if (p >= 1) return B - 1
  if (p <= 0) return 0
  return Math.floor(p * B)
}

function computeECEWithBuckets(
  labeled: LabeledRow[],
  B = 10,
): { ece: number; bucketStats: BucketStats } {
  const N = labeled.length
  const empty: BucketStats = {
    bucketCount: Array(B).fill(0),
    bucketMeanPred: Array(B).fill(0),
    bucketMeanObs: Array(B).fill(0),
  }
  if (N === 0) return { ece: 0, bucketStats: empty }

  const buckets = Array.from({ length: B }, () => ({ n: 0, sumP: 0, sumY: 0 }))

  for (const row of labeled) {
    const b = bucketIndex(row.p, B)
    buckets[b].n += 1
    buckets[b].sumP += row.p
    buckets[b].sumY += row.y
  }

  let ece = 0
  const bucketCount: number[] = []
  const bucketMeanPred: number[] = []
  const bucketMeanObs: number[] = []

  for (const b of buckets) {
    bucketCount.push(b.n)
    if (b.n === 0) {
      bucketMeanPred.push(0)
      bucketMeanObs.push(0)
      continue
    }
    const pBar = b.sumP / b.n
    const yBar = b.sumY / b.n
    bucketMeanPred.push(Math.round(pBar * 10000) / 10000)
    bucketMeanObs.push(Math.round(yBar * 10000) / 10000)
    ece += (b.n / N) * Math.abs(pBar - yBar)
  }

  return { ece, bucketStats: { bucketCount, bucketMeanPred, bucketMeanObs } }
}

function computeBrier(labeled: LabeledRow[]): number {
  if (labeled.length === 0) return 0
  let sum = 0
  for (const row of labeled) {
    sum += (row.p - row.y) ** 2
  }
  return sum / labeled.length
}

function computeAUC(labeled: LabeledRow[]): number | null {
  const posScores: number[] = []
  const negScores: number[] = []
  for (const row of labeled) {
    if (row.y === 1) posScores.push(row.p)
    else negScores.push(row.p)
  }

  const nPos = posScores.length
  const nNeg = negScores.length
  if (nPos < 30 || nNeg < 30) return null

  posScores.sort((a, b) => a - b)
  negScores.sort((a, b) => a - b)

  let j = 0
  let wins = 0
  let ties = 0

  for (const p of posScores) {
    while (j < nNeg && negScores[j] < p) j++
    wins += j
    let k = j
    while (k < nNeg && negScores[k] === p) k++
    ties += (k - j)
  }

  const denom = nPos * nNeg
  return (wins + 0.5 * ties) / denom
}

export const EDGES_X = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]
export const EDGES_MARKET_PCT = [-50, -25, -15, -10, -5, 0, 5, 10, 15, 25, 50]
export const EDGES_PPG_DELTA = [-10, -5, -2, -1, 0, 1, 2, 5, 10]

const PSI_FEATURE_EDGES: Record<string, number[]> = {
  lineupImpact:      EDGES_X,
  vorp:              EDGES_X,
  market:            EDGES_X,
  behavior:          EDGES_X,
  marketDeltaOppPct: EDGES_MARKET_PCT,
  deltaThem:         EDGES_PPG_DELTA,
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

function computePSI(
  actualValues: number[],
  expectedValues: number[],
  edges: number[],
): number {
  const m = edges.length - 1
  const aCounts = Array(m).fill(0)
  const eCounts = Array(m).fill(0)

  for (const v of actualValues) aCounts[binCount(v, edges)]++
  for (const v of expectedValues) eCounts[binCount(v, edges)]++

  const aN = actualValues.length || 1
  const eN = expectedValues.length || 1

  let psi = 0
  for (let i = 0; i < m; i++) {
    const a = Math.max(aCounts[i] / aN, 1e-6)
    const e = Math.max(eCounts[i] / eN, 1e-6)
    psi += (a - e) * Math.log(a / e)
  }
  return psi
}

const PSI_FEATURE_KEYS = ['lineupImpact', 'vorp', 'market', 'behavior', 'marketDeltaOppPct', 'deltaThem']

async function computePsiJsonForSegment(
  dayStart: Date,
  mode: TradeOfferMode,
  segmentKey: string,
  currentOffers: any[],
  leagueMap: Map<string, LegacyLeagueRow>,
): Promise<Record<string, number> | null> {
  const refStart = new Date(dayStart)
  refStart.setUTCDate(refStart.getUTCDate() - 30)

  const baselineOffers = await prisma.tradeOfferEvent.findMany({
    where: {
      mode,
      createdAt: { gte: refStart, lt: dayStart },
    },
    select: {
      featuresJson: true,
      leagueId: true,
    },
  })

  const refForSegment = baselineOffers.filter(o => {
    const key = buildSegmentKeyFromOffer(o, leagueMap)
    return key === segmentKey
  })

  if (currentOffers.length === 0 || refForSegment.length === 0) return null

  const result: Record<string, number> = {}

  for (const key of PSI_FEATURE_KEYS) {
    const current = currentOffers
      .map((o: any) => o?.featuresJson?.[key])
      .filter((v: any): v is number => typeof v === 'number')
    const reference = refForSegment
      .map((o: any) => o?.featuresJson?.[key])
      .filter((v: any): v is number => typeof v === 'number')

    if (current.length === 0 || reference.length === 0) {
      result[key] = 0
      continue
    }

    const edges = PSI_FEATURE_EDGES[key] ?? EDGES_X
    result[key] = computePSI(current, reference, edges)
  }

  const extractCapCount = (offers: any[]): number[] =>
    offers.map(o => {
      const caps = o?.featuresJson?.capsApplied
      return Array.isArray(caps) ? caps.length : 0
    })
  const currentCapCounts = extractCapCount(currentOffers)
  const refCapCounts = extractCapCount(refForSegment)
  if (currentCapCounts.length > 0 && refCapCounts.length > 0) {
    const maxCaps = Math.max(...currentCapCounts, ...refCapCounts, 5)
    const edges: number[] = []
    for (let i = 0; i <= maxCaps + 1; i++) edges.push(i)
    result['capsAppliedFreq'] = computePSI(currentCapCounts, refCapCounts, edges)
  }

  return result
}

async function rollupDay(day: Date, mode: TradeOfferMode): Promise<void> {
  const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  const offers = await prisma.tradeOfferEvent.findMany({
    where: { mode, createdAt: { gte: dayStart, lt: dayEnd } },
    select: {
      id: true,
      leagueId: true,
      acceptProb: true,
      featuresJson: true,
      narrativeValid: true,
      driverSetComplete: true,
    },
  })

  if (offers.length === 0) return

  const outcomes = await prisma.tradeOutcomeEvent.findMany({
    where: {
      offerEventId: { in: offers.map(o => o.id) },
    },
    select: {
      offerEventId: true,
      outcome: true,
    },
  })
  const outcomeMap = new Map(outcomes.map(o => [o.offerEventId!, o.outcome]))

  const leagueIds = [...new Set(offers.map(o => o.leagueId).filter((id): id is string => id !== null))]
  const leagueMap = new Map<string, LegacyLeagueRow>()
  if (leagueIds.length > 0) {
    const leagues = await prisma.legacyLeague.findMany({
      where: { sleeperLeagueId: { in: leagueIds } },
      select: {
        sleeperLeagueId: true,
        isSF: true,
        isTEP: true,
        teamCount: true,
        leagueType: true,
        specialtyFormat: true,
      },
    })
    for (const l of leagues) {
      leagueMap.set(l.sleeperLeagueId, l)
    }
  }

  const groups = new Map<string, SegmentGroup>()

  for (const off of offers) {
    const seg = buildSegmentKeyFromOffer(off, leagueMap)
    if (!groups.has(seg)) groups.set(seg, { offers: [], labeled: [], capCounts: {} })
    const g = groups.get(seg)!
    g.offers.push(off)

    const out = outcomeMap.get(off.id)
    if (out === TradeOutcome.ACCEPTED || out === TradeOutcome.REJECTED || out === TradeOutcome.EXPIRED) {
      g.labeled.push({ p: off.acceptProb, y: out === TradeOutcome.ACCEPTED ? 1 : 0 })
    }

    const caps: string[] = (off.featuresJson as any)?.capsApplied ?? []
    for (const c of caps) g.capCounts[c] = (g.capCounts[c] ?? 0) + 1
  }

  for (const [segmentKey, g] of groups) {
    const nOffers = g.offers.length
    const nLabeled = g.labeled.length
    const nAccepted = g.labeled.reduce((s, r) => s + r.y, 0)
    const meanPred = nLabeled ? g.labeled.reduce((s, r) => s + r.p, 0) / nLabeled : 0
    const meanObs = nLabeled ? nAccepted / nLabeled : 0

    const eceResult = computeECEWithBuckets(g.labeled, 10)
    const ece = eceResult.ece
    const bucketStats = eceResult.bucketStats
    const brier = computeBrier(g.labeled)
    const auc = computeAUC(g.labeled)

    const narrativeFailRate = nOffers
      ? g.offers.filter((o: any) => !o.narrativeValid || !o.driverSetComplete).length / nOffers
      : 0

    const capRateJson: Record<string, number> = {}
    for (const [capId, count] of Object.entries(g.capCounts)) {
      capRateJson[capId] = count / Math.max(1, nOffers)
    }

    const psiJson = await computePsiJsonForSegment(dayStart, mode, segmentKey, g.offers, leagueMap)

    await prisma.modelMetricsDaily.upsert({
      where: { day_mode_segmentKey: { day: dayStart, mode, segmentKey } },
      create: {
        day: dayStart,
        mode,
        segmentKey,
        nOffers,
        nLabeled,
        nAccepted,
        meanPred: Math.round(meanPred * 10000) / 10000,
        meanObs: Math.round(meanObs * 10000) / 10000,
        ece: Math.round(ece * 10000) / 10000,
        brier: Math.round(brier * 10000) / 10000,
        auc: auc !== null ? Math.round(auc * 10000) / 10000 : null,
        psiJson: psiJson ?? undefined,
        capRateJson: Object.keys(capRateJson).length > 0 ? capRateJson : undefined,
        bucketStatsJson: bucketStats ?? undefined,
        narrativeFailRate: Math.round(narrativeFailRate * 10000) / 10000,
      },
      update: {
        nOffers,
        nLabeled,
        nAccepted,
        meanPred: Math.round(meanPred * 10000) / 10000,
        meanObs: Math.round(meanObs * 10000) / 10000,
        ece: Math.round(ece * 10000) / 10000,
        brier: Math.round(brier * 10000) / 10000,
        auc: auc !== null ? Math.round(auc * 10000) / 10000 : null,
        psiJson: psiJson ?? undefined,
        capRateJson: Object.keys(capRateJson).length > 0 ? capRateJson : undefined,
        bucketStatsJson: bucketStats ?? undefined,
        narrativeFailRate: Math.round(narrativeFailRate * 10000) / 10000,
      },
    })
  }
}

export async function computeDailyMetrics(day: Date): Promise<void> {
  const modes = Object.values(TradeOfferMode)
  for (const mode of modes) {
    await rollupDay(day, mode)
  }
}
