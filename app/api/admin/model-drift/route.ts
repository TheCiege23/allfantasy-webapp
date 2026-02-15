import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAdminSessionCookie } from '@/lib/adminSession'
import { prisma } from '@/lib/prisma'
import { Prisma, TradeOfferMode, TradeOutcome } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const adminPassword = process.env.ADMIN_PASSWORD
  if (adminPassword && authHeader === `Bearer ${adminPassword}`) return true

  const cookieStore = cookies()
  const adminSession = cookieStore.get('admin_session')
  if (adminSession?.value) {
    const payload = verifyAdminSessionCookie(adminSession.value)
    if (payload) return true
  }

  return false
}

function json(data: unknown) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-cache, no-store' },
  })
}

function parseCommonFilters(params: URLSearchParams) {
  const mode = params.get('mode') as TradeOfferMode | null
  const segment = params.get('segment') || undefined
  const days = Math.min(Math.max(parseInt(params.get('days') || '14'), 1), 365)
  const cutoff = new Date(Date.now() - days * 86_400_000)
  return { mode: mode || undefined, segment, days, cutoff }
}

async function handleSummary(filters: ReturnType<typeof parseCommonFilters>) {
  const { mode, segment, cutoff } = filters
  const segKey = segment || 'GLOBAL'

  const where: Prisma.ModelMetricsDailyWhereInput = {
    day: { gte: cutoff },
    segmentKey: segKey,
    ...(mode ? { mode } : {}),
  }

  const rows = await prisma.modelMetricsDaily.findMany({
    where,
    orderBy: { day: 'asc' },
  })

  const emptyIntercept = { meanPred: 0, meanObs: 0, delta: 0 }
  const emptyConfCoverage = { mean: 0, pctHigh: 0, pctMedium: 0, pctLow: 0, total: 0 }
  const emptyRolling = { ece7d: null as number | null, ece30d: null as number | null, brier7d: null as number | null, brier30d: null as number | null }

  if (rows.length === 0) {
    return json({
      calibration: { status: 'good', ece: 0, eceDelta: 0, sparkline: [] },
      accuracy: { brier: 0, brierDelta: 0 },
      rankingQuality: { auc: null, aucDelta: null, insufficientData: true },
      narrativeIntegrity: { failRate: 0, incompleteRate: 0 },
      intercept: emptyIntercept,
      confidenceCoverage: emptyConfCoverage,
      rolling: emptyRolling,
    })
  }

  const sparklineWhere: Prisma.ModelMetricsDailyWhereInput = {
    day: { gte: new Date(Date.now() - 14 * 86_400_000) },
    segmentKey: 'GLOBAL',
    ...(mode ? { mode } : {}),
  }
  const sparklineRows = await prisma.modelMetricsDaily.findMany({
    where: sparklineWhere,
    orderBy: { day: 'asc' },
  })

  const dayMap = new Map<string, { eceSum: number; count: number }>()
  for (const r of sparklineRows) {
    const k = r.day.toISOString().slice(0, 10)
    const entry = dayMap.get(k) || { eceSum: 0, count: 0 }
    entry.eceSum += r.ece
    entry.count += 1
    dayMap.set(k, entry)
  }
  const sparkline = Array.from(dayMap.values()).map((e: { eceSum: number; count: number }) => e.eceSum / e.count)

  const latest = rows[rows.length - 1]
  const prev = rows.length >= 2 ? rows[rows.length - 2] : latest

  const totalLabeled = rows.reduce((s: number, r: any) => s + r.nLabeled, 0)
  const avgEce = rows.reduce((s: number, r: any) => s + r.ece * r.nLabeled, 0) / (totalLabeled || 1)
  const avgBrier = rows.reduce((s: number, r: any) => s + r.brier * r.nLabeled, 0) / (totalLabeled || 1)

  const eceDelta = latest.ece - prev.ece
  const brierDelta = latest.brier - prev.brier

  const aucRows = rows.filter((r: any) => r.auc !== null)
  const latestAuc = aucRows.length > 0 ? aucRows[aucRows.length - 1].auc : null
  const prevAuc = aucRows.length >= 2 ? aucRows[aucRows.length - 2].auc : latestAuc
  const aucDelta = latestAuc !== null && prevAuc !== null ? latestAuc - prevAuc : null

  const totalOffers = rows.reduce((s: number, r: any) => s + r.nOffers, 0)
  const avgFailRate = rows.reduce((s: number, r: any) => s + r.narrativeFailRate * r.nOffers, 0) / (totalOffers || 1)

  const narrativeValid = await prisma.narrativeValidationLog.count({
    where: { createdAt: { gte: filters.cutoff } },
  })
  const narrativeInvalid = await prisma.narrativeValidationLog.count({
    where: { createdAt: { gte: filters.cutoff }, valid: false },
  })
  const incompleteRate = narrativeValid > 0 ? narrativeInvalid / narrativeValid : 0

  const latestBucket = latest.bucketStatsJson as Record<string, any> | null
  const interceptData = latestBucket?.intercept ?? emptyIntercept
  const confCoverage = latestBucket?.confidenceCoverage ?? emptyConfCoverage
  const liftTop10 = latestBucket?.liftTop10 ?? null

  const now = Date.now()
  const rows7d = rows.filter((r: any) => r.day.getTime() >= now - 7 * 86_400_000)
  const rows30d = rows

  function weightedAvg(subset: any[], field: string): number | null {
    const totalN = subset.reduce((s: number, r: any) => s + r.nLabeled, 0)
    if (totalN === 0) return null
    return subset.reduce((s: number, r: any) => s + r[field] * r.nLabeled, 0) / totalN
  }

  const rolling = {
    ece7d: weightedAvg(rows7d, 'ece'),
    ece30d: weightedAvg(rows30d, 'ece'),
    brier7d: weightedAvg(rows7d, 'brier'),
    brier30d: weightedAvg(rows30d, 'brier'),
  }

  let status: 'good' | 'watch' | 'critical' = 'good'
  if (avgEce >= 0.12 || avgFailRate >= 0.03) {
    status = 'critical'
  } else if (avgEce > 0.08 || avgFailRate >= 0.01 || (latestAuc !== null && latestAuc < 0.62)) {
    status = 'watch'
  }

  return json({
    calibration: { status, ece: avgEce, eceDelta, sparkline },
    accuracy: { brier: avgBrier, brierDelta },
    rankingQuality: {
      auc: latestAuc,
      aucDelta,
      insufficientData: aucRows.length < 2,
      liftTop10,
    },
    narrativeIntegrity: { failRate: avgFailRate, incompleteRate, driverMismatchRate: incompleteRate },
    intercept: interceptData,
    confidenceCoverage: confCoverage,
    rolling,
  })
}

async function handleCalibration(filters: ReturnType<typeof parseCommonFilters>) {
  const { mode, cutoff } = filters

  const whereClause: Prisma.TradeOfferEventWhereInput = {
    createdAt: { gte: cutoff },
    ...(mode ? { mode } : {}),
  }

  const offers = await prisma.tradeOfferEvent.findMany({
    where: whereClause,
    select: { id: true, acceptProb: true },
  })

  const outcomeMap = new Map<string, TradeOutcome>()
  if (offers.length > 0) {
    const outcomes = await prisma.tradeOutcomeEvent.findMany({
      where: {
        offerEventId: { in: offers.map(o => o.id) },
      },
      select: { offerEventId: true, outcome: true },
    })
    for (const o of outcomes) {
      if (o.offerEventId) outcomeMap.set(o.offerEventId, o.outcome)
    }
  }

  const buckets = Array.from({ length: 10 }, (_, i) => ({
    lo: i * 0.1,
    hi: (i + 1) * 0.1,
    label: `${(i * 10).toString().padStart(2, '0')}-${((i + 1) * 10).toString().padStart(2, '0')}%`,
    sumPred: 0,
    sumObs: 0,
    count: 0,
    acceptCount: 0,
  }))

  function bucketIdx(p: number): number {
    if (p >= 1) return 9
    if (p <= 0) return 0
    return Math.floor(p * 10)
  }

  for (const offer of offers) {
    const prob = offer.acceptProb ?? 0
    const idx = bucketIdx(prob)
    buckets[idx].sumPred += prob
    buckets[idx].count += 1
    const outcome = outcomeMap.get(offer.id)
    if (outcome === 'ACCEPTED') {
      buckets[idx].sumObs += 1
      buckets[idx].acceptCount += 1
    } else if (outcome) {
      buckets[idx].sumObs += 0
    }
  }

  const reliabilityCurve = buckets.map(b => ({
    bucket: b.label,
    meanPred: b.count > 0 ? b.sumPred / b.count : 0,
    meanObs: b.count > 0 ? b.sumObs / b.count : 0,
    count: b.count,
  }))

  const predictionDistribution = buckets.map(b => ({
    bucket: b.label,
    count: b.count,
    acceptRate: b.count > 0 ? b.acceptCount / b.count : 0,
  }))

  return json({ reliabilityCurve, predictionDistribution })
}

async function handleSegments(filters: ReturnType<typeof parseCommonFilters>) {
  const { mode, cutoff } = filters

  const where: Prisma.ModelMetricsDailyWhereInput = {
    day: { gte: cutoff },
    ...(mode ? { mode } : {}),
  }

  const rows = await prisma.modelMetricsDaily.findMany({ where })

  const segMap = new Map<string, {
    eceSum: number; brierSum: number; aucSum: number; aucCount: number;
    nLabeled: number; psiJson: Record<string, any> | null; bucketStats: Record<string, any> | null; count: number
  }>()

  for (const r of rows) {
    const entry = segMap.get(r.segmentKey) || {
      eceSum: 0, brierSum: 0, aucSum: 0, aucCount: 0, nLabeled: 0, psiJson: null, bucketStats: null, count: 0,
    }
    entry.eceSum += r.ece * r.nLabeled
    entry.brierSum += r.brier * r.nLabeled
    if (r.auc !== null) { entry.aucSum += r.auc * r.nLabeled; entry.aucCount += r.nLabeled }
    entry.nLabeled += r.nLabeled
    entry.count += 1
    if (r.psiJson) entry.psiJson = r.psiJson as Record<string, any>
    if (r.bucketStatsJson) entry.bucketStats = r.bucketStatsJson as Record<string, any>
    segMap.set(r.segmentKey, entry)
  }

  const heatmap = Array.from(segMap.entries()).map(([segmentKey, e]) => {
    const psiObj = e.psiJson?.psi as Record<string, number> | undefined
    const jsdObj = e.psiJson?.jsd as Record<string, number> | undefined
    const corrObj = e.bucketStats?.corr as Record<string, number> | undefined
    const interceptObj = e.bucketStats?.intercept as { delta: number } | undefined

    const psiValues = psiObj ? Object.values(psiObj).filter(Number.isFinite) : []
    const psiComposite = psiValues.length > 0 ? psiValues.reduce((a, b) => a + b, 0) / psiValues.length : 0

    return {
      segmentKey,
      ece: e.nLabeled > 0 ? e.eceSum / e.nLabeled : 0,
      brier: e.nLabeled > 0 ? e.brierSum / e.nLabeled : 0,
      auc: e.aucCount > 0 ? e.aucSum / e.aucCount : null,
      nLabeled: e.nLabeled,
      interceptDelta: interceptObj?.delta ?? null,
      psiComposite,
      psi: psiObj ?? {},
      jsd: jsdObj ?? {},
      corr: corrObj ?? {},
    }
  })

  const worstSegments = heatmap
    .sort((a, b) => b.ece - a.ece)
    .slice(0, 10)
    .map(seg => {
      const entry = segMap.get(seg.segmentKey)
      let biggestDriftFeature: string | null = null
      if (entry?.psiJson) {
        let maxPsi = 0
        for (const [feat, psi] of Object.entries(entry.psiJson)) {
          if (typeof psi === 'number' && psi > maxPsi) {
            maxPsi = psi
            biggestDriftFeature = feat
          }
        }
      }
      return { ...seg, biggestDriftFeature }
    })

  return json({ heatmap, worstSegments })
}

async function handleFeatures(filters: ReturnType<typeof parseCommonFilters>, featureFilter?: string) {
  const { mode, cutoff } = filters

  const where: Prisma.ModelMetricsDailyWhereInput = {
    day: { gte: cutoff },
    ...(mode ? { mode } : {}),
  }

  const rows = await prisma.modelMetricsDaily.findMany({
    where,
    orderBy: { day: 'asc' },
  })

  const featureDrift: Array<{ day: string; feature: string; mean: number; std: number; psi: number; jsd: number; corr: number | null }> = []
  const capRates: Array<{ day: string; caps: Record<string, number> }> = []

  const dayCapMap = new Map<string, Map<string, number[]>>()
  const dayPsiMap = new Map<string, Map<string, number[]>>()
  const dayJsdMap = new Map<string, Map<string, number[]>>()
  const dayCorrMap = new Map<string, Map<string, number[]>>()

  for (const r of rows) {
    const dayKey = r.day.toISOString().slice(0, 10)

    if (r.psiJson && typeof r.psiJson === 'object') {
      const psiRoot = r.psiJson as Record<string, any>
      const psiObj = psiRoot.psi ?? psiRoot
      const jsdObj = psiRoot.jsd ?? {}

      if (typeof psiObj === 'object') {
        for (const [feat, val] of Object.entries(psiObj)) {
          if (featureFilter && feat !== featureFilter) continue
          if (typeof val !== 'number') continue
          if (!dayPsiMap.has(dayKey)) dayPsiMap.set(dayKey, new Map())
          const fMap = dayPsiMap.get(dayKey)!
          if (!fMap.has(feat)) fMap.set(feat, [])
          fMap.get(feat)!.push(val)
        }
      }

      if (typeof jsdObj === 'object') {
        for (const [feat, val] of Object.entries(jsdObj)) {
          if (featureFilter && feat !== featureFilter) continue
          if (typeof val !== 'number') continue
          if (!dayJsdMap.has(dayKey)) dayJsdMap.set(dayKey, new Map())
          const fMap = dayJsdMap.get(dayKey)!
          if (!fMap.has(feat)) fMap.set(feat, [])
          fMap.get(feat)!.push(val)
        }
      }
    }

    const bStats = r.bucketStatsJson as Record<string, any> | null
    if (bStats?.corr && typeof bStats.corr === 'object') {
      for (const [feat, val] of Object.entries(bStats.corr)) {
        if (featureFilter && feat !== featureFilter) continue
        if (typeof val !== 'number') continue
        if (!dayCorrMap.has(dayKey)) dayCorrMap.set(dayKey, new Map())
        const fMap = dayCorrMap.get(dayKey)!
        if (!fMap.has(feat)) fMap.set(feat, [])
        fMap.get(feat)!.push(val)
      }
    }

    if (r.capRateJson && typeof r.capRateJson === 'object') {
      const caps = r.capRateJson as Record<string, number>
      if (!dayCapMap.has(dayKey)) dayCapMap.set(dayKey, new Map())
      const cMap = dayCapMap.get(dayKey)!
      for (const [cap, rate] of Object.entries(caps)) {
        if (!cMap.has(cap)) cMap.set(cap, [])
        cMap.get(cap)!.push(typeof rate === 'number' ? rate : 0)
      }
    }
  }

  const allFeatures = new Set<string>()
  for (const m of [dayPsiMap, dayJsdMap]) {
    for (const fMap of m.values()) {
      for (const k of fMap.keys()) allFeatures.add(k)
    }
  }

  for (const [day, psiMap] of dayPsiMap.entries()) {
    for (const feature of allFeatures) {
      const psiVals = psiMap?.get(feature) ?? []
      const jsdVals = dayJsdMap.get(day)?.get(feature) ?? []
      const corrVals = dayCorrMap.get(day)?.get(feature) ?? []

      const avgPsi = psiVals.length > 0 ? psiVals.reduce((a, b) => a + b, 0) / psiVals.length : 0
      const avgJsd = jsdVals.length > 0 ? jsdVals.reduce((a, b) => a + b, 0) / jsdVals.length : 0
      const avgCorr = corrVals.length > 0 ? corrVals.reduce((a, b) => a + b, 0) / corrVals.length : null
      const variance = psiVals.length > 0 ? psiVals.reduce((a, b) => a + (b - avgPsi) ** 2, 0) / psiVals.length : 0

      featureDrift.push({ day, feature, mean: avgPsi, std: Math.sqrt(variance), psi: avgPsi, jsd: avgJsd, corr: avgCorr })
    }
  }

  for (const [day, cMap] of dayCapMap.entries()) {
    const caps: Record<string, number> = {}
    for (const [cap, vals] of cMap.entries()) {
      caps[cap] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    capRates.push({ day, caps })
  }

  featureDrift.sort((a, b) => a.day.localeCompare(b.day))
  capRates.sort((a, b) => a.day.localeCompare(b.day))

  return json({ featureDrift, capRates })
}

async function handleDrilldown(params: URLSearchParams, filters: ReturnType<typeof parseCommonFilters>) {
  const { mode, segment, cutoff } = filters
  const outcome = params.get('outcome') as TradeOutcome | null
  const predBucket = params.get('predBucket')
  const cap = params.get('cap')

  const offerWhere: Prisma.TradeOfferEventWhereInput = {
    createdAt: { gte: cutoff },
    ...(mode ? { mode } : {}),
  }

  if (predBucket) {
    const lo = parseFloat(predBucket) / 100
    const hi = lo + 0.1
    offerWhere.acceptProb = { gte: lo, lt: hi }
  }

  if (segment) {
    offerWhere.leagueFormat = segment
  }

  let offers = await prisma.tradeOfferEvent.findMany({
    where: offerWhere,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const offerIds = offers.map(o => o.id)
  const outcomes = await prisma.tradeOutcomeEvent.findMany({
    where: { offerEventId: { in: offerIds } },
  })
  const outcomeMap = new Map(outcomes.map(o => [o.offerEventId, o]))

  let results = offers.map(o => ({
    ...o,
    outcome: outcomeMap.get(o.id) || null,
  }))

  if (outcome) {
    results = results.filter(r => r.outcome?.outcome === outcome)
  }

  if (cap) {
    results = results.filter(r => {
      const features = r.featuresJson as Record<string, unknown>
      return features && features[cap] !== undefined
    })
  }

  return json({ offers: results.slice(0, 50) })
}

async function handleAlerts(filters: ReturnType<typeof parseCommonFilters>) {
  const { mode, segment } = filters

  const latestDay = await prisma.modelMetricsDaily.findFirst({
    orderBy: { day: 'desc' },
    select: { day: true },
  })

  if (!latestDay) return json({ alerts: [] })

  const where: Prisma.ModelMetricsDailyWhereInput = {
    day: latestDay.day,
    ...(mode ? { mode } : {}),
    ...(segment ? { segmentKey: segment } : {}),
  }

  const rows = await prisma.modelMetricsDaily.findMany({ where })

  const alerts: Array<{
    severity: 'warning' | 'critical'
    reason: string
    segment: string
    suggestedAction: string
  }> = []

  for (const r of rows) {
    if (r.ece >= 0.12) {
      alerts.push({
        severity: 'critical',
        reason: `ECE = ${r.ece.toFixed(4)} exceeds critical threshold (0.12)`,
        segment: r.segmentKey,
        suggestedAction: 'Trigger recalibration for this segment',
      })
    } else if (r.ece > 0.08) {
      alerts.push({
        severity: 'warning',
        reason: `ECE = ${r.ece.toFixed(4)} above good threshold (0.08)`,
        segment: r.segmentKey,
        suggestedAction: 'Monitor ECE trend; consider shadow recalibration',
      })
    }

    if (r.narrativeFailRate >= 0.03) {
      alerts.push({
        severity: 'critical',
        reason: `Narrative fail rate = ${(r.narrativeFailRate * 100).toFixed(1)}% exceeds 3%`,
        segment: r.segmentKey,
        suggestedAction: 'Review narrative generation pipeline for regressions',
      })
    } else if (r.narrativeFailRate >= 0.01) {
      alerts.push({
        severity: 'warning',
        reason: `Narrative fail rate = ${(r.narrativeFailRate * 100).toFixed(1)}% above 1%`,
        segment: r.segmentKey,
        suggestedAction: 'Spot-check recent narrative validation logs',
      })
    }

    if (r.auc !== null && r.auc < 0.62) {
      alerts.push({
        severity: 'warning',
        reason: `AUC = ${r.auc.toFixed(4)} below threshold (0.62)`,
        segment: r.segmentKey,
        suggestedAction: 'Review ranking features; may need more labeled data',
      })
    }

    if (r.brier > 0.30) {
      alerts.push({
        severity: 'warning',
        reason: `Brier score = ${r.brier.toFixed(4)} is elevated`,
        segment: r.segmentKey,
        suggestedAction: 'Check for distribution shift in prediction inputs',
      })
    }

    const bucket = r.bucketStatsJson as Record<string, any> | null
    if (bucket?.intercept) {
      const delta = bucket.intercept.delta as number
      if (Math.abs(delta) > 0.08) {
        alerts.push({
          severity: 'critical',
          reason: `Intercept drift = ${delta > 0 ? '+' : ''}${delta.toFixed(3)} (baseline acceptance rate shifted)`,
          segment: r.segmentKey,
          suggestedAction: 'Trigger auto-recalibration to adjust sigmoid intercept (b0)',
        })
      } else if (Math.abs(delta) > 0.05) {
        alerts.push({
          severity: 'warning',
          reason: `Intercept drift = ${delta > 0 ? '+' : ''}${delta.toFixed(3)} approaching threshold`,
          segment: r.segmentKey,
          suggestedAction: 'Monitor intercept drift; recalibration may be needed soon',
        })
      }
    }

    if (bucket?.confidenceCoverage) {
      const cc = bucket.confidenceCoverage
      if (cc.pctHigh > 0.8 && r.ece > 0.08) {
        alerts.push({
          severity: 'warning',
          reason: `${(cc.pctHigh * 100).toFixed(0)}% of predictions are HIGH confidence but ECE is elevated (${r.ece.toFixed(4)})`,
          segment: r.segmentKey,
          suggestedAction: 'Confidence thresholds may be too lax; tighten HIGH confidence cutoff',
        })
      }
    }

    if (bucket?.corr) {
      const corrKeys = ['lineupImpact', 'vorp', 'market', 'behavior'] as const
      for (const ck of corrKeys) {
        const val = bucket.corr[ck] as number | undefined
        if (val !== undefined && Math.abs(val) < 0.05) {
          const psiObj = r.psiJson as Record<string, any> | null
          const psiVal = psiObj?.psi?.[ck] as number | undefined
          if (psiVal !== undefined && psiVal < 0.10) {
            alerts.push({
              severity: 'warning',
              reason: `${ck} correlation near zero (${val.toFixed(3)}) with low PSI (${psiVal.toFixed(3)}) — feature relevance may have shifted`,
              segment: r.segmentKey,
              suggestedAction: `Investigate whether ${ck} is still predictive; consider weight adjustment`,
            })
          }
        }
      }
    }
  }

  alerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1
    if (a.severity !== 'critical' && b.severity === 'critical') return 1
    return 0
  })

  return json({ alerts })
}

async function handleSegmentKeys(filters: ReturnType<typeof parseCommonFilters>) {
  const { cutoff } = filters

  const rows = await prisma.modelMetricsDaily.findMany({
    where: { day: { gte: cutoff } },
    select: { segmentKey: true },
    distinct: ['segmentKey'],
    orderBy: { segmentKey: 'asc' },
  })

  const keys = rows.map(r => r.segmentKey).sort((a, b) => {
    if (a === 'GLOBAL') return -1
    if (b === 'GLOBAL') return 1
    return a.localeCompare(b)
  })

  return json({ keys })
}

export const GET = withApiUsage({ endpoint: "/api/admin/model-drift", tool: "AdminModelDrift" })(async (request: NextRequest) => {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const type = params.get('type') || 'summary'
    const filters = parseCommonFilters(params)

    switch (type) {
      case 'summary':
        return handleSummary(filters)
      case 'calibration':
        return handleCalibration(filters)
      case 'segments':
        return handleSegments(filters)
      case 'features':
        return handleFeatures(filters, params.get('feature') || undefined)
      case 'drilldown':
        return handleDrilldown(params, filters)
      case 'alerts':
        return handleAlerts(filters)
      case 'segment_keys':
        return handleSegmentKeys(filters)
      default:
        return json({ error: `Unknown type: ${type}` })
    }
  } catch (err) {
    console.error('[admin/model-drift] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
