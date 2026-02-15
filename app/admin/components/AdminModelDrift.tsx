'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  AlertTriangle,
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Eye,
  Filter,
  Loader2,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { cx } from '@/components/ui/legacy-ui'

type Status = 'good' | 'watch' | 'critical'

type InterceptData = { meanPred: number; meanObs: number; delta: number }
type ConfidenceCoverage = { mean: number; pctHigh: number; pctMedium: number; pctLow: number; total: number }
type RollingData = { ece7d: number | null; ece30d: number | null; brier7d: number | null; brier30d: number | null }

type SummaryData = {
  calibration: { status: Status; ece: number; eceDelta: number; sparkline: number[] }
  accuracy: { brier: number; brierDelta: number }
  rankingQuality: { auc: number | null; aucDelta: number | null; insufficientData: boolean; liftTop10?: number | null }
  narrativeIntegrity: { failRate: number; incompleteRate: number; driverMismatchRate?: number }
  intercept?: InterceptData
  confidenceCoverage?: ConfidenceCoverage
  rolling?: RollingData
}

type AlertItem = {
  severity: 'warning' | 'critical'
  reason: string
  segment: string
  suggestedAction: string
}

type CalibrationBucket = {
  bucket: string
  meanPred: number
  meanObs: number
  count: number
}

type CalibrationData = {
  reliabilityCurve: CalibrationBucket[]
  predictionDistribution: Array<{ bucket: string; count: number; acceptRate: number }>
}

type SegmentRow = {
  segmentKey: string
  ece: number
  brier: number
  auc: number | null
  nLabeled: number
  biggestDriftFeature?: string | null
  interceptDelta?: number | null
  psiComposite?: number
  psi?: Record<string, number>
  jsd?: Record<string, number>
  corr?: Record<string, number>
}

type SegmentsData = {
  heatmap: SegmentRow[]
  worstSegments: SegmentRow[]
}

type FeaturePoint = { day: string; feature: string; mean: number; std: number; psi: number; jsd: number; corr: number | null }
type CapRatePoint = { day: string; caps: Record<string, number> }
type FeaturesData = { featureDrift: FeaturePoint[]; capRates: CapRatePoint[] }

type DrilldownOffer = {
  id: string
  acceptProb: number
  mode: string
  createdAt: string
  featuresJson?: Record<string, unknown>
  driversJson?: Array<{ id: string; direction: string; strength: string; value: number }>
  outcome?: { outcome: string } | null
}

type DrilldownData = { offers: DrilldownOffer[] }

const DATE_RANGES = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
]

const MODE_OPTIONS = [
  { value: '', label: 'ALL' },
  { value: 'INSTANT', label: 'INSTANT' },
  { value: 'STRUCTURED', label: 'STRUCTURED' },
  { value: 'TRADE_HUB', label: 'TRADE_HUB' },
  { value: 'TRADE_IDEAS', label: 'TRADE_IDEAS' },
  { value: 'PROPOSAL_GENERATOR', label: 'PROPOSAL_GENERATOR' },
]

const DEFAULT_SEGMENT_OPTIONS = [
  { value: 'GLOBAL', label: 'GLOBAL' },
]

const OUTCOME_OPTIONS = [
  { value: '', label: 'All Outcomes' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COUNTERED', label: 'Countered' },
  { value: 'EXPIRED', label: 'Expired' },
]

const PRED_BUCKET_OPTIONS = [
  { value: '', label: 'All Buckets' },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i * 10),
    label: `${i * 10}–${(i + 1) * 10}%`,
  })),
]

function statusColor(s: Status) {
  if (s === 'critical') return { bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-300' }
  if (s === 'watch') return { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' }
  return { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' }
}

function eceStatus(ece: number): Status {
  if (ece >= 0.12) return 'critical'
  if (ece > 0.08) return 'watch'
  return 'good'
}

function brierStatus(brier: number): Status {
  if (brier > 0.30) return 'critical'
  if (brier > 0.20) return 'watch'
  return 'good'
}

function aucStatus(auc: number | null): Status {
  if (auc === null) return 'good'
  if (auc < 0.55) return 'critical'
  if (auc < 0.62) return 'watch'
  return 'good'
}

function DeltaBadge({ value, inverted }: { value: number; inverted?: boolean }) {
  if (Math.abs(value) < 0.0001) return <span className="text-xs text-white/30">—</span>
  const isUp = value > 0
  const isBad = inverted ? !isUp : isUp
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium', isBad ? 'text-red-400' : 'text-emerald-400')}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value > 0 ? '+' : ''}{value.toFixed(4)}
    </span>
  )
}

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" points={points.join(' ')} />
    </svg>
  )
}

function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-white/40" />
}

function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-white/30" />
    </div>
  )
}

function DataChecklist({ context }: { context?: string }) {
  const items = [
    { label: "Run at least 10 trades through the evaluator", done: false },
    { label: "Record trade outcomes for calibration", done: false },
    { label: "Wait for weekly auto-recalibration cycle", done: false },
  ]

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-center gap-3 mb-3">
        <BarChart3 className="h-5 w-5 text-white/30" />
        <div className="text-sm font-semibold text-white/70">Data Collection in Progress</div>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-white/20 mt-0.5 flex-shrink-0" />
            )}
            <span className={cx('text-sm', item.done ? 'text-emerald-400/80 line-through' : 'text-white/60')}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      {context && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-xs text-white/30">
          {context}
        </div>
      )}
    </div>
  )
}

function EmptyGuidance({ section }: { section: string }) {
  const messages: Record<string, string> = {
    reliability: 'The reliability curve will appear once paired prediction/outcome data is available. Run trades through the evaluator and record outcomes to populate this chart.',
    distribution: 'Prediction distribution shows how model confidence is spread. It populates automatically as trade evaluations are processed.',
    segments: 'Segment heatmap breaks down calibration by league format, scoring type, and mode. Data appears as trades are evaluated across different segments.',
    features: 'Feature drift tracks how input distributions change over time. Daily feature snapshots build this view automatically.',
    drilldown: 'The drilldown table shows individual offers matching your filters. Evaluate more trades to see data here.',
    caps: 'Cap trigger rates show how often guardrail caps fire. This data accumulates as the model processes trades.',
  }

  return (
    <div className="text-sm text-white/30 py-6 text-center space-y-2">
      <div>{messages[section] || 'No data available yet.'}</div>
    </div>
  )
}

function QuickHealthStrip({ summary, alerts }: { summary: SummaryData | null; alerts: AlertItem[] }) {
  if (!summary) return null

  const critCount = alerts.filter(a => a.severity === 'critical').length
  const warnCount = alerts.filter(a => a.severity === 'warning').length
  const overallStatus: Status = critCount > 0 ? 'critical' : warnCount > 0 ? 'watch' : 'good'
  const overallLabel = overallStatus === 'critical' ? 'Action Needed' : overallStatus === 'watch' ? 'Monitor' : 'Healthy'

  const sc = statusColor(overallStatus)

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border', sc.bg, sc.text)}>
          <span className={cx('h-2 w-2 rounded-full', overallStatus === 'critical' ? 'bg-red-400' : overallStatus === 'watch' ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse')} />
          {overallLabel}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/5 px-3 py-1.5 text-xs text-white/60">
          <Target className="h-3 w-3 text-violet-400" />
          ECE: <span className={cx('font-mono font-semibold', statusColor(eceStatus(summary.calibration.ece)).text)}>
            {summary.calibration.ece.toFixed(4)}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/5 px-3 py-1.5 text-xs text-white/60">
          <Activity className="h-3 w-3 text-indigo-400" />
          Brier: <span className={cx('font-mono font-semibold', statusColor(brierStatus(summary.accuracy.brier)).text)}>
            {summary.accuracy.brier.toFixed(4)}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/5 px-3 py-1.5 text-xs text-white/60">
          <ShieldAlert className="h-3 w-3 text-amber-400" />
          Alerts: <span className="font-semibold">{critCount + warnCount}</span>
          {critCount > 0 && <span className="text-red-400">({critCount} critical)</span>}
        </div>
      </div>
    </div>
  )
}

function buildQs(params: Record<string, string | number>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== undefined) sp.set(k, String(v))
  }
  return sp.toString()
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

function ReliabilityCurve({ data }: { data: CalibrationBucket[] }) {
  const w = 300
  const h = 240
  const pad = { top: 16, right: 16, bottom: 32, left: 40 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const [hovIdx, setHovIdx] = useState<number | null>(null)

  const toX = (v: number) => pad.left + v * cw
  const toY = (v: number) => pad.top + (1 - v) * ch

  const curvePath = data
    .filter((b) => b.count > 0)
    .map((b, i) => `${i === 0 ? 'M' : 'L'}${toX(b.meanPred).toFixed(1)},${toY(b.meanObs).toFixed(1)}`)
    .join(' ')

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm">
        <line x1={pad.left} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="white" strokeOpacity="0.1" strokeDasharray="4 4" />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.left} y1={toY(v)} x2={toX(1)} y2={toY(v)} stroke="white" strokeOpacity="0.05" />
            <text x={pad.left - 4} y={toY(v) + 3} textAnchor="end" fill="white" fillOpacity="0.4" fontSize="9">{v.toFixed(1)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <text key={v} x={toX(v)} y={h - 6} textAnchor="middle" fill="white" fillOpacity="0.4" fontSize="9">{v.toFixed(1)}</text>
        ))}
        {curvePath && <path d={curvePath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />}
        {data.filter((b) => b.count > 0).map((b, i) => (
          <circle
            key={i}
            cx={toX(b.meanPred)}
            cy={toY(b.meanObs)}
            r={hovIdx === i ? 5 : 3.5}
            fill="#8b5cf6"
            stroke="#0a0a0f"
            strokeWidth="1.5"
            className="cursor-pointer"
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
          />
        ))}
      </svg>
      {hovIdx !== null && data.filter((b) => b.count > 0)[hovIdx] && (() => {
        const b = data.filter((b) => b.count > 0)[hovIdx]
        return (
          <div className="absolute top-2 right-2 rounded-lg bg-black/80 border border-white/10 px-3 py-2 text-xs space-y-0.5">
            <div className="text-white/70">{b.bucket}</div>
            <div>Pred: <span className="text-violet-400">{b.meanPred.toFixed(3)}</span></div>
            <div>Obs: <span className="text-emerald-400">{b.meanObs.toFixed(3)}</span></div>
            <div>N: <span className="text-white/60">{b.count}</span></div>
          </div>
        )
      })()}
    </div>
  )
}

function PredictionDistribution({ data }: { data: CalibrationData['predictionDistribution'] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const w = 300
  const h = 200
  const pad = { top: 16, right: 16, bottom: 32, left: 40 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const barW = cw / data.length - 2

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm">
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * ch
        const x = pad.left + i * (cw / data.length) + 1
        const y = pad.top + ch - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={2} fill="#6366f1" fillOpacity="0.7" />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" fill="white" fillOpacity="0.35" fontSize="7">{d.bucket.split('-')[0]}</text>
          </g>
        )
      })}
      {data.length > 0 && (() => {
        const pts = data.map((d, i) => {
          const x = pad.left + i * (cw / data.length) + barW / 2 + 1
          const y = pad.top + ch - d.acceptRate * ch
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        return <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" points={pts.join(' ')} />
      })()}
      {[0, 0.5, 1].map((v) => (
        <text key={v} x={pad.left - 4} y={pad.top + ch - v * ch + 3} textAnchor="end" fill="white" fillOpacity="0.3" fontSize="8">{(v * maxCount).toFixed(0)}</text>
      ))}
    </svg>
  )
}

function SegmentHeatmap({ data }: { data: SegmentRow[] }) {
  if (data.length === 0) return <DataChecklist context="Segment heatmap breaks down calibration by league format, scoring type, and mode. Data appears as trades are evaluated across different segments." />

  const cellColor = (val: number, thresholds: [number, number]) => {
    if (val >= thresholds[1]) return 'text-red-400'
    if (val >= thresholds[0]) return 'text-amber-400'
    return 'text-emerald-400'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 text-white/50 font-medium">Segment</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">ECE</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Brier</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">AUC</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">Intercept Δ</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">PSI</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">N</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.segmentKey} className="border-b border-white/5 hover:bg-white/[0.03]">
              <td className="py-2 px-3 text-white/80 font-medium">{row.segmentKey}</td>
              <td className={cx('py-2 px-3 text-right font-mono', cellColor(row.ece, [0.08, 0.12]))}>{row.ece.toFixed(4)}</td>
              <td className={cx('py-2 px-3 text-right font-mono', cellColor(row.brier, [0.20, 0.30]))}>{row.brier.toFixed(4)}</td>
              <td className={cx('py-2 px-3 text-right font-mono', row.auc !== null ? (row.auc < 0.62 ? 'text-amber-400' : 'text-emerald-400') : 'text-white/30')}>
                {row.auc !== null ? row.auc.toFixed(4) : '—'}
              </td>
              <td className={cx('py-2 px-3 text-right font-mono', row.interceptDelta != null ? (Math.abs(row.interceptDelta) > 0.08 ? 'text-red-400' : Math.abs(row.interceptDelta) > 0.05 ? 'text-amber-400' : 'text-emerald-400') : 'text-white/30')}>
                {row.interceptDelta != null ? (row.interceptDelta > 0 ? '+' : '') + row.interceptDelta.toFixed(3) : '—'}
              </td>
              <td className={cx('py-2 px-3 text-right font-mono', row.psiComposite !== undefined ? (row.psiComposite > 0.25 ? 'text-red-400' : row.psiComposite > 0.10 ? 'text-amber-400' : 'text-emerald-400') : 'text-white/30')}>
                {row.psiComposite !== undefined ? row.psiComposite.toFixed(3) : '—'}
              </td>
              <td className="py-2 px-3 text-right text-white/50">{row.nLabeled.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WorstSegmentsTable({ data, onView }: { data: SegmentRow[]; onView: (seg: string) => void }) {
  if (data.length === 0) return <DataChecklist context="Worst segments appear once enough paired outcomes exist across different league formats and modes." />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 text-white/50 font-medium">Segment</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">N</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">ECE</th>
            <th className="text-right py-2 px-3 text-white/50 font-medium">AUC</th>
            <th className="text-left py-2 px-3 text-white/50 font-medium">Drift Feature</th>
            <th className="py-2 px-3" />
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.segmentKey} className="border-b border-white/5 hover:bg-white/[0.03]">
              <td className="py-2 px-3 text-white/80 font-medium">{row.segmentKey}</td>
              <td className="py-2 px-3 text-right text-white/50">{row.nLabeled.toLocaleString()}</td>
              <td className={cx('py-2 px-3 text-right font-mono', row.ece >= 0.12 ? 'text-red-400' : row.ece > 0.08 ? 'text-amber-400' : 'text-emerald-400')}>
                {row.ece.toFixed(4)}
              </td>
              <td className="py-2 px-3 text-right font-mono text-white/60">
                {row.auc !== null ? row.auc.toFixed(4) : '—'}
              </td>
              <td className="py-2 px-3 text-white/50 text-xs">{row.biggestDriftFeature || '—'}</td>
              <td className="py-2 px-3">
                <button onClick={() => onView(row.segmentKey)} className="rounded-lg bg-white/10 hover:bg-white/15 px-2 py-1 text-xs transition">
                  <Eye className="h-3 w-3 inline mr-1" />View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FeatureDriftChart({ data, feature }: { data: FeaturePoint[]; feature: string }) {
  const filtered = data.filter((d) => d.feature === feature)
  if (filtered.length < 2) return <EmptyGuidance section="features" />

  const w = 300
  const h = 180
  const pad = { top: 16, right: 16, bottom: 28, left: 48 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom

  const mins = Math.min(...filtered.map((d) => d.mean))
  const maxs = Math.max(...filtered.map((d) => d.mean))
  const range = maxs - mins || 1

  const pts = filtered.map((d, i) => {
    const x = pad.left + (i / (filtered.length - 1)) * cw
    const y = pad.top + (1 - (d.mean - mins) / range) * ch
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const latestPsi = filtered[filtered.length - 1]?.psi

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {latestPsi !== undefined && (
          <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', latestPsi > 0.25 ? 'bg-red-500/20 text-red-400' : latestPsi > 0.1 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400')}>
            PSI: {latestPsi.toFixed(3)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.left} y1={pad.top + (1 - v) * ch} x2={w - pad.right} y2={pad.top + (1 - v) * ch} stroke="white" strokeOpacity="0.05" />
            <text x={pad.left - 4} y={pad.top + (1 - v) * ch + 3} textAnchor="end" fill="white" fillOpacity="0.3" fontSize="8">
              {(mins + v * range).toFixed(2)}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" points={pts.join(' ')} />
        {filtered.length > 0 && (
          <>
            <text x={pad.left} y={h - 4} fill="white" fillOpacity="0.3" fontSize="7">{filtered[0].day.slice(5)}</text>
            <text x={w - pad.right} y={h - 4} textAnchor="end" fill="white" fillOpacity="0.3" fontSize="7">{filtered[filtered.length - 1].day.slice(5)}</text>
          </>
        )}
      </svg>
    </div>
  )
}

function CapRateChart({ data }: { data: CapRatePoint[] }) {
  if (data.length === 0) return <EmptyGuidance section="caps" />

  const allCaps = new Set<string>()
  for (const d of data) {
    for (const k of Object.keys(d.caps)) allCaps.add(k)
  }
  const capKeys = Array.from(allCaps).slice(0, 6)
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']

  const w = 300
  const h = 180
  const pad = { top: 16, right: 16, bottom: 28, left: 40 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const barW = Math.min(cw / data.length - 2, 20)

  const maxTotal = Math.max(...data.map((d) => capKeys.reduce((s, k) => s + (d.caps[k] || 0), 0)), 0.01)

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-sm">
        {data.map((d, i) => {
          const x = pad.left + i * (cw / data.length) + 1
          let yOff = 0
          return (
            <g key={i}>
              {capKeys.map((cap, ci) => {
                const val = d.caps[cap] || 0
                const barH = (val / maxTotal) * ch
                const y = pad.top + ch - yOff - barH
                yOff += barH
                return <rect key={cap} x={x} y={y} width={barW} height={barH} rx={1} fill={colors[ci % colors.length]} fillOpacity="0.7" />
              })}
              {i % Math.max(1, Math.floor(data.length / 4)) === 0 && (
                <text x={x + barW / 2} y={h - 6} textAnchor="middle" fill="white" fillOpacity="0.3" fontSize="7">{d.day.slice(5)}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {capKeys.map((cap, i) => (
          <div key={cap} className="flex items-center gap-1 text-[10px] text-white/50">
            <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
            {cap}
          </div>
        ))}
      </div>
    </div>
  )
}

function DrilldownModal({ offer, onClose }: { offer: DrilldownOffer; onClose: () => void }) {
  const drivers = (offer.driversJson || []) as Array<{ id: string; direction: string; strength: string; value: number }>
  const features = (offer.featuresJson || {}) as Record<string, unknown>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-[#12121a] border border-white/10 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Offer Details</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-white/40 text-xs">ID</div>
              <div className="font-mono text-xs mt-1 truncate">{offer.id}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-white/40 text-xs">Mode</div>
              <div className="mt-1">{offer.mode}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-white/40 text-xs">Accept Prob</div>
              <div className="mt-1 font-mono">{(offer.acceptProb * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5">
              <div className="text-white/40 text-xs">Outcome</div>
              <div className="mt-1">{offer.outcome?.outcome || 'Pending'}</div>
            </div>
            <div className="bg-black/30 rounded-lg p-3 border border-white/5 col-span-2">
              <div className="text-white/40 text-xs">Created</div>
              <div className="mt-1">{new Date(offer.createdAt).toLocaleString()}</div>
            </div>
          </div>
          {drivers.length > 0 && (
            <div>
              <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Drivers</div>
              <div className="space-y-1">
                {drivers.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-white/70">{d.id}</span>
                    <span className="flex items-center gap-2">
                      <span className={cx('text-xs', d.direction === 'up' ? 'text-emerald-400' : 'text-red-400')}>{d.direction}</span>
                      <span className="text-xs text-white/40">{d.strength}</span>
                      <span className="font-mono text-xs">{d.value.toFixed(3)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(features).length > 0 && (
            <div>
              <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Features</div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(features).slice(0, 14).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between bg-black/20 rounded px-2 py-1 text-xs border border-white/5">
                    <span className="text-white/50">{k}</span>
                    <span className="font-mono">{typeof v === 'number' ? v.toFixed(3) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminModelDrift() {
  const [days, setDays] = useState(14)
  const [mode, setMode] = useState('')
  const [segment, setSegment] = useState('GLOBAL')
  const [alertsOnly, setAlertsOnly] = useState(false)

  const [segmentOptions, setSegmentOptions] = useState(DEFAULT_SEGMENT_OPTIONS)

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [calibration, setCalibration] = useState<CalibrationData | null>(null)
  const [segments, setSegments] = useState<SegmentsData | null>(null)
  const [features, setFeatures] = useState<FeaturesData | null>(null)
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null)

  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingCalibration, setLoadingCalibration] = useState(true)
  const [loadingSegments, setLoadingSegments] = useState(true)
  const [loadingFeatures, setLoadingFeatures] = useState(true)
  const [loadingDrilldown, setLoadingDrilldown] = useState(true)

  const [selectedFeature, setSelectedFeature] = useState('x1')
  const [drillSegment, setDrillSegment] = useState('')
  const [drillOutcome, setDrillOutcome] = useState('')
  const [drillBucket, setDrillBucket] = useState('')
  const [drillCap, setDrillCap] = useState('')
  const [selectedOffer, setSelectedOffer] = useState<DrilldownOffer | null>(null)

  const [error, setError] = useState<string | null>(null)

  const baseParams = useCallback(() => {
    const p: Record<string, string | number> = { days }
    if (mode) p.mode = mode
    if (segment && segment !== 'GLOBAL') p.segment = segment
    return p
  }, [days, mode, segment])

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const qs = buildQs({ ...baseParams(), type: 'summary' })
      const data = await apiFetch<SummaryData>(`/api/admin/model-drift?${qs}`)
      setSummary(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingSummary(false)
    }
  }, [baseParams])

  const fetchAlerts = useCallback(async () => {
    try {
      const qs = buildQs({ ...baseParams(), type: 'alerts' })
      const data = await apiFetch<{ alerts: AlertItem[] }>(`/api/admin/model-drift?${qs}`)
      setAlerts(data.alerts || [])
    } catch {}
  }, [baseParams])

  const fetchCalibration = useCallback(async () => {
    setLoadingCalibration(true)
    try {
      const qs = buildQs({ ...baseParams(), type: 'calibration' })
      const data = await apiFetch<CalibrationData>(`/api/admin/model-drift?${qs}`)
      setCalibration(data)
    } catch {} finally {
      setLoadingCalibration(false)
    }
  }, [baseParams])

  const fetchSegments = useCallback(async () => {
    setLoadingSegments(true)
    try {
      const qs = buildQs({ ...baseParams(), type: 'segments' })
      const data = await apiFetch<SegmentsData>(`/api/admin/model-drift?${qs}`)
      setSegments(data)
    } catch {} finally {
      setLoadingSegments(false)
    }
  }, [baseParams])

  const fetchFeatures = useCallback(async () => {
    setLoadingFeatures(true)
    try {
      const qs = buildQs({ ...baseParams(), type: 'features' })
      const data = await apiFetch<FeaturesData>(`/api/admin/model-drift?${qs}`)
      setFeatures(data)
    } catch {} finally {
      setLoadingFeatures(false)
    }
  }, [baseParams])

  const fetchDrilldown = useCallback(async () => {
    setLoadingDrilldown(true)
    try {
      const p: Record<string, string | number> = { ...baseParams(), type: 'drilldown' }
      if (drillSegment) p.segment = drillSegment
      if (drillOutcome) p.outcome = drillOutcome
      if (drillBucket) p.predBucket = drillBucket
      if (drillCap) p.cap = drillCap
      const qs = buildQs(p)
      const data = await apiFetch<DrilldownData>(`/api/admin/model-drift?${qs}`)
      setDrilldown(data)
    } catch {} finally {
      setLoadingDrilldown(false)
    }
  }, [baseParams, drillSegment, drillOutcome, drillBucket, drillCap])

  const fetchSegmentKeys = useCallback(async () => {
    try {
      const qs = buildQs({ days, type: 'segment_keys' })
      const data = await apiFetch<{ keys: string[] }>(`/api/admin/model-drift?${qs}`)
      const opts = (data.keys || ['GLOBAL']).map(k => ({ value: k, label: k }))
      setSegmentOptions(opts.length > 0 ? opts : DEFAULT_SEGMENT_OPTIONS)
    } catch {}
  }, [days])

  useEffect(() => {
    fetchSegmentKeys()
  }, [days])

  useEffect(() => {
    setError(null)
    fetchSummary()
    fetchAlerts()
    fetchCalibration()
    fetchSegments()
    fetchFeatures()
    fetchDrilldown()
  }, [days, mode, segment])

  useEffect(() => {
    fetchDrilldown()
  }, [drillSegment, drillOutcome, drillBucket, drillCap])

  const featureOptions = features
    ? Array.from(new Set(features.featureDrift.map((d) => d.feature))).sort()
    : ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7']

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical')
  const warningAlerts = alerts.filter((a) => a.severity === 'warning')

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 space-y-6">
        <div className="sticky top-16 z-20 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5 -mx-1 px-1 pb-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-violet-500/20 text-violet-300 px-2.5 py-0.5 text-xs font-mono font-semibold">v2.1.0</span>
            <div className="flex items-center rounded-lg bg-black/30 border border-white/10 overflow-hidden">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={cx(
                    'px-3 py-1.5 text-sm font-medium transition',
                    days === r.value ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none hover:bg-white/5 transition appearance-none cursor-pointer pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '12px',
              }}
            >
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#12121a]">{o.label}</option>
              ))}
            </select>

            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none hover:bg-white/5 transition appearance-none cursor-pointer pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '12px',
              }}
            >
              {segmentOptions.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#12121a]">{o.label}</option>
              ))}
            </select>

            <select
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none hover:bg-white/5 transition appearance-none cursor-pointer pr-8"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '12px',
              }}
            >
              <option value="2025" className="bg-[#12121a]">2025 Season</option>
              <option value="2024" className="bg-[#12121a]">2024 Season</option>
            </select>

            <button
              onClick={() => setAlertsOnly(!alertsOnly)}
              className={cx(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition border',
                alertsOnly ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70'
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Alerts only
            </button>

            {loadingSummary && <Spinner />}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
        )}

        {!loadingSummary && <QuickHealthStrip summary={summary} alerts={alerts} />}

        {!alertsOnly && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {loadingSummary ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-black/30 border border-white/10 p-5 animate-pulse h-32" />
                ))
              ) : summary ? (
                <>
                  {(() => {
                    const s = summary.calibration
                    const sc = statusColor(s.status)
                    return (
                      <div className={cx('rounded-xl border p-5', sc.bg)}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-white/50 uppercase tracking-wider">Calibration</span>
                          <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', sc.badge)}>
                            {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                          </span>
                        </div>
                        <div className="text-2xl font-bold">{s.ece.toFixed(4)}</div>
                        <div className="flex items-center justify-between mt-2">
                          <DeltaBadge value={s.eceDelta} />
                          <span className={sc.text}><Sparkline data={s.sparkline} /></span>
                        </div>
                      </div>
                    )
                  })()}
                  {(() => {
                    const ic = summary.intercept ?? { meanPred: 0, meanObs: 0, delta: 0 }
                    const absDelta = Math.abs(ic.delta)
                    const icStatus: Status = absDelta > 0.08 ? 'critical' : absDelta > 0.05 ? 'watch' : 'good'
                    const sc = statusColor(icStatus)
                    const rolling7dDelta = summary.rolling?.ece7d !== null && summary.rolling?.ece7d !== undefined ? ic.delta : null
                    return (
                      <div className={cx('rounded-xl border p-5', sc.bg)} title="Measures systematic over/underconfidence.">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-white/50 uppercase tracking-wider">Intercept Drift</span>
                          <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', sc.badge)}>
                            {icStatus.charAt(0).toUpperCase() + icStatus.slice(1)}
                          </span>
                        </div>
                        <div className="text-2xl font-bold font-mono">
                          {ic.delta > 0 ? '+' : ''}{ic.delta.toFixed(3)}
                        </div>
                        <div className="flex items-center justify-between mt-2 text-xs text-white/40">
                          <span>Pred: {ic.meanPred.toFixed(3)}</span>
                          <span>Obs: {ic.meanObs.toFixed(3)}</span>
                        </div>
                        {summary.rolling && summary.rolling.ece7d !== null && (
                          <div className="text-[10px] text-white/30 mt-1">7d rolling Δ available</div>
                        )}
                      </div>
                    )
                  })()}
                  {(() => {
                    const rq = summary.rankingQuality
                    const s = aucStatus(rq.auc)
                    const sc = statusColor(s)
                    return (
                      <div className={cx('rounded-xl border p-5', sc.bg)}>
                        <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Ranking Quality</div>
                        <div className="text-2xl font-bold">
                          {rq.auc !== null ? rq.auc.toFixed(4) : <span className="text-base text-white/30">Awaiting data</span>}
                        </div>
                        {rq.aucDelta !== null && (
                          <div className="mt-1"><DeltaBadge value={rq.aucDelta} inverted /></div>
                        )}
                        {rq.liftTop10 != null && (
                          <div className="text-xs text-white/50 mt-1">Lift@10%: <span className="text-violet-400 font-mono font-semibold">{rq.liftTop10.toFixed(1)}x</span></div>
                        )}
                        <div className="text-[10px] text-white/30 mt-1">Are accepted trades ranking higher?</div>
                      </div>
                    )
                  })()}
                  {(() => {
                    const ni = summary.narrativeIntegrity
                    const failPct = ni.failRate * 100
                    const incompletePct = ni.incompleteRate * 100
                    const mismatchPct = (ni.driverMismatchRate ?? 0) * 100
                    const anyRed = failPct > 2 || incompletePct > 2 || mismatchPct > 2
                    const s: Status = anyRed ? 'critical' : failPct >= 1 ? 'watch' : 'good'
                    const sc = statusColor(s)
                    return (
                      <div className={cx('rounded-xl border p-5', sc.bg)}>
                        <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Narrative Integrity</div>
                        <div className="text-2xl font-bold">{failPct.toFixed(1)}%</div>
                        <div className="text-xs text-white/40 mt-1">GPT fail rate</div>
                        <div className={cx('text-xs mt-1', incompletePct > 2 ? 'text-red-400' : 'text-white/30')}>INCOMPLETE_DRIVER_SET: {incompletePct.toFixed(1)}%</div>
                        <div className={cx('text-xs mt-0.5', mismatchPct > 2 ? 'text-red-400' : 'text-white/30')}>Driver mismatch: {mismatchPct.toFixed(1)}%</div>
                      </div>
                    )
                  })()}
                </>
              ) : null}
            </div>


            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-violet-400" />
                  Reliability Curve
                </h3>
                {loadingCalibration ? <SectionSpinner /> : calibration ? (
                  <ReliabilityCurve data={calibration.reliabilityCurve} />
                ) : <EmptyGuidance section="reliability" />}
              </div>
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                  Prediction Distribution
                </h3>
                {loadingCalibration ? <SectionSpinner /> : calibration ? (
                  <div>
                    <PredictionDistribution data={calibration.predictionDistribution} />
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-white/40">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-500" /> Count</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-3 border-t border-dashed border-emerald-500" /> Accept Rate</span>
                    </div>
                  </div>
                ) : <EmptyGuidance section="distribution" />}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-4">Segment Heatmap</h3>
                {loadingSegments ? <SectionSpinner /> : segments ? (
                  <SegmentHeatmap data={segments.heatmap} />
                ) : null}
              </div>
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-4">Worst Segments</h3>
                {loadingSegments ? <SectionSpinner /> : segments ? (
                  <WorstSegmentsTable
                    data={segments.worstSegments}
                    onView={(seg) => { setDrillSegment(seg); }}
                  />
                ) : null}
              </div>
            </div>

            {segments && (() => {
              const globalRow = segments.heatmap.find(r => r.segmentKey === 'GLOBAL') || segments.heatmap[0]
              if (!globalRow?.psi && !globalRow?.jsd && !globalRow?.corr) return null
              const psiData = globalRow.psi || {}
              const jsdData = globalRow.jsd || {}
              const corrData = globalRow.corr || {}
              const allFeatures = Array.from(new Set([...Object.keys(psiData), ...Object.keys(jsdData), ...Object.keys(corrData)]))
              if (allFeatures.length === 0) return null
              return (
                <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                    Drift Analysis
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-2 px-3 text-white/50 font-medium">Feature</th>
                          <th className="text-right py-2 px-3 text-white/50 font-medium">PSI</th>
                          <th className="text-right py-2 px-3 text-white/50 font-medium">JSD</th>
                          <th className="text-right py-2 px-3 text-white/50 font-medium">Corr Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allFeatures.map(feat => {
                          const psi = psiData[feat]
                          const jsd = jsdData[feat]
                          const corr = corrData[feat]
                          return (
                            <tr key={feat} className="border-b border-white/5 hover:bg-white/[0.03]">
                              <td className="py-2 px-3 text-white/80 font-medium">{feat}</td>
                              <td className={cx('py-2 px-3 text-right font-mono', psi !== undefined ? (psi > 0.25 ? 'text-red-400' : psi > 0.10 ? 'text-amber-400' : 'text-emerald-400') : 'text-white/30')}>
                                {psi !== undefined ? psi.toFixed(3) : '—'}
                              </td>
                              <td className={cx('py-2 px-3 text-right font-mono', jsd !== undefined ? (jsd > 0.02 ? 'text-amber-400' : 'text-emerald-400') : 'text-white/30')}>
                                {jsd !== undefined ? jsd.toFixed(4) : '—'}
                              </td>
                              <td className={cx('py-2 px-3 text-right font-mono', corr !== undefined ? (Math.abs(corr) > 0.2 ? 'text-purple-400' : 'text-emerald-400') : 'text-white/30')}>
                                {corr !== undefined ? (corr > 0 ? '+' : '') + corr.toFixed(3) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-400" />
                    Feature Drift
                  </h3>
                  <select
                    value={selectedFeature}
                    onChange={(e) => setSelectedFeature(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none cursor-pointer"
                  >
                    {featureOptions.map((f) => (
                      <option key={f} value={f} className="bg-[#12121a]">{f}</option>
                    ))}
                  </select>
                </div>
                {loadingFeatures ? <SectionSpinner /> : features ? (
                  <FeatureDriftChart data={features.featureDrift} feature={selectedFeature} />
                ) : null}
              </div>
              <div className="rounded-xl bg-black/30 border border-white/10 p-5">
                <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Cap Trigger Rates
                </h3>
                {loadingFeatures ? <SectionSpinner /> : features ? (
                  <CapRateChart data={features.capRates} />
                ) : null}
              </div>
            </div>

            <div className="rounded-xl bg-black/30 border border-white/10 p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-cyan-400" />
                Drilldown Table
              </h3>
              <div className="flex flex-wrap gap-3 mb-4">
                <select value={drillSegment} onChange={(e) => setDrillSegment(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer">
                  <option value="" className="bg-[#12121a]">All Segments</option>
                  {segmentOptions.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#12121a]">{o.label}</option>
                  ))}
                </select>
                <select value={drillOutcome} onChange={(e) => setDrillOutcome(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer">
                  {OUTCOME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#12121a]">{o.label}</option>
                  ))}
                </select>
                <select value={drillBucket} onChange={(e) => setDrillBucket(e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none cursor-pointer">
                  {PRED_BUCKET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#12121a]">{o.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={drillCap}
                  onChange={(e) => setDrillCap(e.target.value)}
                  placeholder="Cap filter..."
                  className="bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30 w-28"
                />
              </div>
              {loadingDrilldown ? <SectionSpinner /> : drilldown && drilldown.offers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 px-2 text-white/50 font-medium">Created</th>
                        <th className="text-left py-2 px-2 text-white/50 font-medium">Mode</th>
                        <th className="text-right py-2 px-2 text-white/50 font-medium">Prob</th>
                        <th className="text-left py-2 px-2 text-white/50 font-medium">Outcome</th>
                        <th className="text-left py-2 px-2 text-white/50 font-medium">Top Drivers</th>
                        <th className="text-left py-2 px-2 text-white/50 font-medium">Caps</th>
                        <th className="py-2 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {drilldown.offers.map((o) => {
                        const drivers = (o.driversJson || []) as Array<{ id: string; direction: string; strength: string; value: number }>
                        const feats = (o.featuresJson || {}) as Record<string, unknown>
                        const capKeys = Object.keys(feats).filter((k) => k.startsWith('cap') || k.includes('Cap'))
                        return (
                          <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                            <td className="py-2 px-2 text-white/60">{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td className="py-2 px-2 text-white/70">{o.mode}</td>
                            <td className="py-2 px-2 text-right font-mono text-white/80">{(o.acceptProb * 100).toFixed(1)}%</td>
                            <td className="py-2 px-2">
                              <span className={cx(
                                'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                o.outcome?.outcome === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-400' :
                                o.outcome?.outcome === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                                'bg-white/10 text-white/50'
                              )}>
                                {o.outcome?.outcome || 'Pending'}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-white/50 max-w-[200px] truncate">
                              {drivers.slice(0, 3).map((d) => d.id).join(', ') || '—'}
                            </td>
                            <td className="py-2 px-2 text-white/40">{capKeys.length > 0 ? capKeys.join(', ') : '—'}</td>
                            <td className="py-2 px-2">
                              <button onClick={() => setSelectedOffer(o)} className="rounded bg-white/10 hover:bg-white/15 px-2 py-0.5 text-[10px] transition">
                                Open
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyGuidance section="drilldown" />
              )}
            </div>
          </>
        )}

        {alertsOnly && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-white/40">
            <ShieldAlert className="h-12 w-12 mb-3 opacity-30" />
            <div className="text-lg font-medium">No Active Alerts</div>
            <div className="text-sm mt-1">All metrics within healthy thresholds</div>
          </div>
        )}

        {alertsOnly && alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={cx(
                  'rounded-xl border p-4',
                  a.severity === 'critical' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={cx('h-4 w-4', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')} />
                  <span className={cx('text-xs font-semibold uppercase', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')}>
                    {a.severity}
                  </span>
                  <span className="text-xs text-white/40 ml-auto">{a.segment}</span>
                </div>
                <div className={cx('text-sm', a.severity === 'critical' ? 'text-red-300' : 'text-amber-300')}>{a.reason}</div>
                <div className="text-xs text-white/40 mt-1 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  {a.suggestedAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="hidden xl:block w-72 flex-shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="rounded-xl bg-black/30 border border-white/10 p-4">
            <h3 className="text-sm font-semibold text-white/70 mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-400" />
              Alerts
              {alerts.length > 0 && (
                <span className="ml-auto rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400 font-medium">{alerts.length}</span>
              )}
            </h3>
            {alerts.length === 0 ? (
              <div className="text-xs text-emerald-400/70 flex items-center gap-1.5 py-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                All clear
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {alerts.map((a, i) => (
                  <div
                    key={i}
                    className={cx(
                      'rounded-lg border p-3 text-xs',
                      a.severity === 'critical' ? 'border-red-500/20 bg-red-500/5' : 'border-amber-500/20 bg-amber-500/5'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className={cx('h-3 w-3', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')} />
                      <span className={cx('font-semibold uppercase text-[10px]', a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')}>
                        {a.severity}
                      </span>
                    </div>
                    <div className={cx('text-[11px] leading-relaxed', a.severity === 'critical' ? 'text-red-300/80' : 'text-amber-300/80')}>
                      {a.reason}
                    </div>
                    <div className="text-[10px] text-white/30 mt-1">{a.segment}</div>
                    <div className="text-[10px] text-white/40 mt-1 italic">{a.suggestedAction}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {summary && (
            <div className="rounded-xl bg-black/30 border border-white/10 p-4">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Quick Stats</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/40">ECE</span>
                  <span className={statusColor(eceStatus(summary.calibration.ece)).text}>{summary.calibration.ece.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Brier</span>
                  <span className={statusColor(brierStatus(summary.accuracy.brier)).text}>{summary.accuracy.brier.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">AUC</span>
                  <span className={summary.rankingQuality.auc !== null ? statusColor(aucStatus(summary.rankingQuality.auc)).text : 'text-white/30'}>
                    {summary.rankingQuality.auc?.toFixed(4) ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Fail Rate</span>
                  <span className="text-white/60">{(summary.narrativeIntegrity.failRate * 100).toFixed(1)}%</span>
                </div>
                {summary.intercept && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Intercept</span>
                    <span className={Math.abs(summary.intercept.delta) > 0.05 ? 'text-amber-400' : 'text-white/60'}>
                      {summary.intercept.delta > 0 ? '+' : ''}{summary.intercept.delta.toFixed(3)}
                    </span>
                  </div>
                )}
                {summary.rolling?.ece7d !== null && summary.rolling?.ece7d !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/40">ECE 7d</span>
                    <span className={statusColor(eceStatus(summary.rolling.ece7d)).text}>{summary.rolling.ece7d.toFixed(4)}</span>
                  </div>
                )}
                {summary.rolling?.brier7d !== null && summary.rolling?.brier7d !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Brier 7d</span>
                    <span className="text-white/60 font-mono">{summary.rolling.brier7d.toFixed(4)}</span>
                  </div>
                )}
                {summary.rankingQuality.liftTop10 != null && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Lift@10%</span>
                    <span className="text-violet-400 font-mono">{summary.rankingQuality.liftTop10.toFixed(1)}x</span>
                  </div>
                )}
                {summary.confidenceCoverage && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[10px] text-white/30 uppercase mb-1">Confidence Dist.</div>
                    <div className="text-[11px] text-white/50">
                      <span className="text-emerald-400">HIGH: {(summary.confidenceCoverage.pctHigh * 100).toFixed(0)}%</span>
                      {' | '}
                      <span className="text-amber-400">MED: {(summary.confidenceCoverage.pctMedium * 100).toFixed(0)}%</span>
                      {' | '}
                      <span className="text-red-400">LOW: {(summary.confidenceCoverage.pctLow * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {selectedOffer && <DrilldownModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />}
    </div>
  )
}
