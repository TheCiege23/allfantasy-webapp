"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Circle,
  RefreshCw,
  Target,
  TrendingUp,
  Shield,
  FileText,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";

type Alert = {
  severity: "warning" | "critical";
  message: string;
  metric: string;
  value: number;
  threshold: number;
};

type CalibrationBucket = {
  bucketMin: number;
  bucketMax: number;
  bucketLabel: string;
  predicted: number;
  observed: number;
  count: number;
};

type CalibrationHealth = {
  reliabilityCurve: CalibrationBucket[];
  ece: number;
  brierScore: number;
  predictionDistribution: Array<{ bucket: string; count: number }>;
  totalPaired: number;
  alerts: Alert[];
};

type SegmentMetric = {
  segment: string;
  value: string;
  ece: number;
  brierScore: number;
  count: number;
};

type SegmentDrift = {
  heatmap: SegmentMetric[];
  worstSegments: SegmentMetric[];
  alerts: Alert[];
};

type FeatureStat = {
  feature: string;
  currentMean: number;
  currentStd: number;
  previousMean: number;
  previousStd: number;
  psi: number;
  zDrift: number;
  drifted: boolean;
};

type FeatureDriftData = {
  features: FeatureStat[];
  alerts: Alert[];
};

type RankingData = {
  auc: number;
  topKHitRates: Array<{ k: number; hitRate: number; count: number }>;
  liftChart: Array<{
    decile: number;
    lift: number;
    baseRate: number;
    decileRate: number;
  }>;
  totalPaired: number;
  alerts: Alert[];
};

type NarrativeData = {
  totalValidations: number;
  failureRate: number;
  incompleteDriverSetRate: number;
  illegalNumberRate: number;
  invalidDriverRate: number;
  bannedPatternRate: number;
  dailyFailureRates: Array<{ date: string; rate: number; count: number }>;
  alerts: Alert[];
};

type ShadowB0Metrics = {
  computedB0: number;
  currentActiveB0: number;
  observedRate: number;
  predictedMean: number;
  logOddsCorrection: number;
  sampleSize: number;
  computedAt: string;
  mature: boolean;
  divergence: number;
};

type SegmentB0Entry = {
  segment: string;
  b0: number;
  sampleSize: number;
  observedRate: number;
  predictedMean: number;
  lastUpdated: string;
};

type RecalibrationData = {
  activeB0: number;
  shadowB0: number | null;
  shadowB0SampleSize: number | null;
  shadowB0ComputedAt: string | null;
  shadowB0Metrics: ShadowB0Metrics | null;
  segmentB0s: { segments: SegmentB0Entry[]; lastUpdated: string } | null;
  lastRecalibrationAt: string | null;
  calibrationHistory: Array<{
    timestamp: string;
    oldB0: number;
    newB0: number;
    sampleSize: number;
    source: string;
  }>;
};

type SummaryCardData = {
  id: string;
  label: string;
  status: "good" | "watch" | "critical";
  detail: string;
};

type DrilldownOffer = {
  id: string;
  acceptProb: number;
  accepted: boolean;
  mode: string;
  isSuperFlex: boolean | null;
  leagueFormat: string | null;
  scoringType: string | null;
  drivers: Array<{ id: string; direction: string; strength: string; value: number }>;
  createdAt: string;
};

type DrilldownData = {
  segmentKey: string;
  segmentValue: string;
  reliabilityCurve: CalibrationBucket[];
  ece: number;
  featureDrift: FeatureStat[];
  sampleOffers: DrilldownOffer[];
  sampleSize: number;
};

type DashboardData = {
  calibration: CalibrationHealth;
  segmentDrift: SegmentDrift;
  featureDrift: FeatureDriftData;
  ranking: RankingData;
  narrative: NarrativeData;
  recalibration?: RecalibrationData;
  dateRange: { from: string; to: string };
  generatedAt: string;
  summaryCards?: SummaryCardData[];
};

type SectionId = "calibration" | "segment" | "feature" | "ranking" | "narrative" | "recalibration";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Target }> = [
  { id: "calibration", label: "Calibration Health", icon: Target },
  { id: "segment", label: "Segment Drift", icon: BarChart3 },
  { id: "feature", label: "Feature Drift", icon: TrendingUp },
  { id: "ranking", label: "Ranking Quality", icon: Activity },
  { id: "narrative", label: "Narrative Integrity", icon: FileText },
  { id: "recalibration", label: "Auto-Recalibration", icon: Shield },
];

const MODE_OPTIONS = [
  { value: "", label: "All Modes" },
  { value: "instant", label: "Instant" },
  { value: "structured", label: "Structured" },
  { value: "proposal", label: "Proposal" },
];

const SEGMENT_OPTIONS = [
  { value: "", label: "All Segments" },
  { value: "SF", label: "SuperFlex" },
  { value: "1QB", label: "1QB" },
  { value: "Dynasty", label: "Dynasty" },
  { value: "Redraft", label: "Redraft" },
  { value: "TEP", label: "TEP" },
  { value: "PPR", label: "PPR" },
];

function AlertBadge({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const hasCritical = alerts.some((a) => a.severity === "critical");
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${hasCritical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}
    >
      <AlertTriangle className="h-3 w-3" />
      {alerts.length}
    </span>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  status,
}: {
  label: string;
  value: string;
  subtitle?: string;
  status?: "good" | "warning" | "critical" | "neutral";
}) {
  const colors = {
    good: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    critical: "border-red-500/30 bg-red-500/5",
    neutral: "border-white/10 bg-white/[0.02]",
  };
  return (
    <div
      className={`rounded-xl border p-4 ${colors[status || "neutral"]}`}
    >
      <div className="text-xs text-white/50 uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {subtitle && (
        <div className="mt-0.5 text-xs text-white/40">{subtitle}</div>
      )}
    </div>
  );
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0)
    return (
      <div className="text-sm text-emerald-400/80 flex items-center gap-2">
        <Shield className="h-4 w-4" /> No active alerts
      </div>
    );
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`rounded-lg border p-3 text-sm ${a.severity === "critical" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium uppercase text-xs">
              {a.severity}
            </span>
          </div>
          <div className="mt-1">{a.message}</div>
          <div className="mt-1 text-xs opacity-60">
            Value: {typeof a.value === "number" ? a.value.toFixed(4) : a.value}{" "}
            | Threshold: {a.threshold}
          </div>
        </div>
      ))}
    </div>
  );
}

function InsufficientData({ count, needed }: { count: number; needed: number }) {
  const items = [
    { label: "Run at least 10 trades through the evaluator", done: count >= 10 },
    { label: "Record trade outcomes for calibration", done: count >= needed },
    { label: "Wait for weekly auto-recalibration cycle", done: false },
  ];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 mb-4">
        <BarChart3 className="h-6 w-6 text-white/30" />
        <div>
          <div className="text-sm font-semibold text-white/70">Data Collection in Progress</div>
          <div className="text-xs text-white/40 mt-0.5">
            {count} of {needed} paired records collected
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-white/20 mt-0.5 flex-shrink-0" />
            )}
            <span className={`text-sm ${item.done ? "text-emerald-400/80 line-through" : "text-white/60"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2 text-xs text-white/30">
        Metrics will appear automatically once enough paired trade data is available.
      </div>
    </div>
  );
}

function CalibrationHealthSection({ data }: { data: CalibrationHealth }) {
  if (data.totalPaired < 5) return <InsufficientData count={data.totalPaired} needed={5} />;

  const curveData = data.reliabilityCurve.map((b) => ({
    name: b.bucketLabel,
    predicted: Math.round(b.predicted * 100),
    observed: Math.round(b.observed * 100),
    count: b.count,
  }));

  const eceStatus: "good" | "warning" | "critical" =
    data.ece > 0.12 ? "critical" : data.ece > 0.08 ? "warning" : "good";
  const brierStatus: "good" | "warning" | "critical" =
    data.brierScore > 0.3 ? "critical" : data.brierScore > 0.2 ? "warning" : "good";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="ECE"
          value={data.ece.toFixed(4)}
          subtitle="Expected Calibration Error"
          status={eceStatus}
        />
        <MetricCard
          label="Brier Score"
          value={data.brierScore.toFixed(4)}
          subtitle="Lower is better"
          status={brierStatus}
        />
        <MetricCard
          label="Paired Records"
          value={data.totalPaired.toLocaleString()}
          subtitle="Offers with outcomes"
          status="neutral"
        />
        <MetricCard
          label="Alerts"
          value={String(data.alerts.length)}
          subtitle={data.alerts.length === 0 ? "All clear" : "Action needed"}
          status={data.alerts.length > 0 ? "warning" : "good"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">
            Reliability Curve (Calibration Plot)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
                domain={[0, 100]}
                label={{
                  value: "Acceptance Rate %",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#ffffff40",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                stroke="#ffffff20"
                strokeDasharray="5 5"
                segment={[
                  { x: "0–10%", y: 5 },
                  { x: "90–100%", y: 95 },
                ]}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Predicted"
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="observed"
                stroke="#10b981"
                strokeWidth={2}
                name="Observed"
                dot={{ r: 4 }}
              />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-white/30 mt-2 text-center">
            Perfect calibration: predicted = observed (diagonal line)
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">
            Prediction Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.predictionDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="bucket"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.predictionDistribution.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.bucket.startsWith("90") || entry.bucket.startsWith("0–")
                        ? "#ef4444"
                        : "#6366f1"
                    }
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-white/30 mt-2 text-center">
            Red buckets indicate potential over/under-confidence
          </div>
        </div>
      </div>

      <AlertList alerts={data.alerts} />
    </div>
  );
}

function SegmentDriftSection({
  data,
  onDrilldown,
}: {
  data: SegmentDrift;
  onDrilldown: (segmentKey: string, segmentValue: string) => void;
}) {
  if (data.heatmap.length === 0)
    return <InsufficientData count={0} needed={10} />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/70 mb-4">
          ECE by Segment (Heatmap)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-white/50 font-medium">
                  Segment
                </th>
                <th className="text-left py-2 px-3 text-white/50 font-medium">
                  Value
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  ECE
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  Brier
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  N
                </th>
              </tr>
            </thead>
            <tbody>
              {data.heatmap.map((row, i) => {
                const eceColor =
                  row.ece > 0.15
                    ? "text-red-400"
                    : row.ece > 0.08
                      ? "text-amber-400"
                      : "text-emerald-400";
                return (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition"
                    onClick={() => onDrilldown(row.segment, row.value)}
                  >
                    <td className="py-2 px-3 text-white/70">{row.segment}</td>
                    <td className="py-2 px-3 text-white/90 font-medium underline decoration-dotted underline-offset-2">
                      {row.value}
                    </td>
                    <td className={`py-2 px-3 text-right font-mono ${eceColor}`}>
                      {row.ece.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-white/60">
                      {row.brierScore.toFixed(4)}
                    </td>
                    <td className="py-2 px-3 text-right text-white/50">
                      {row.count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {data.worstSegments.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">
            Top 10 Worst Segments
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data.worstSegments.map((s) => ({
                name: `${s.segment}: ${s.value}`,
                ece: s.ece,
                count: s.count,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                type="number"
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="ece" radius={[0, 4, 4, 0]}>
                {data.worstSegments.map((s, i) => (
                  <Cell
                    key={i}
                    fill={s.ece > 0.15 ? "#ef4444" : s.ece > 0.08 ? "#f59e0b" : "#10b981"}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <AlertList alerts={data.alerts} />
    </div>
  );
}

function FeatureDriftSection({ data }: { data: FeatureDriftData }) {
  if (data.features.length === 0)
    return <InsufficientData count={0} needed={10} />;

  const featureLabels: Record<string, string> = {
    lineupImpact: "Lineup Impact",
    vorp: "VORP",
    market: "Market Value",
    behavior: "Manager Behavior",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.features.map((f) => (
          <MetricCard
            key={f.feature}
            label={featureLabels[f.feature] || f.feature}
            value={`PSI: ${f.psi.toFixed(3)}`}
            subtitle={`z-drift: ${f.zDrift.toFixed(2)}`}
            status={f.drifted ? (f.psi > 0.5 ? "critical" : "warning") : "good"}
          />
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/70 mb-4">
          Feature Distribution Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-white/50 font-medium">
                  Feature
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  Prev Mean
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  Curr Mean
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  Prev Std
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  Curr Std
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  PSI
                </th>
                <th className="text-right py-2 px-3 text-white/50 font-medium">
                  |z|
                </th>
                <th className="text-center py-2 px-3 text-white/50 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data.features.map((f) => (
                <tr
                  key={f.feature}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="py-2 px-3 text-white/90 font-medium">
                    {featureLabels[f.feature] || f.feature}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-white/60">
                    {f.previousMean.toFixed(4)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-white/90">
                    {f.currentMean.toFixed(4)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-white/60">
                    {f.previousStd.toFixed(4)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-white/90">
                    {f.currentStd.toFixed(4)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${f.psi > 0.25 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {f.psi.toFixed(4)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-mono ${f.zDrift > 3 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    {f.zDrift.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {f.drifted ? (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-red-500/20 text-red-400">
                        DRIFT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/70 mb-4">
          PSI by Feature
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={data.features.map((f) => ({
              name: featureLabels[f.feature] || f.feature,
              psi: f.psi,
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#ffffff60", fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#ffffff60", fontSize: 11 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a2e",
                border: "1px solid #ffffff20",
                borderRadius: "8px",
                fontSize: 12,
              }}
            />
            <ReferenceLine y={0.25} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Drift threshold", fill: "#ef444480", fontSize: 10 }} />
            <Bar dataKey="psi" radius={[4, 4, 0, 0]}>
              {data.features.map((f, i) => (
                <Cell key={i} fill={f.drifted ? "#ef4444" : "#6366f1"} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <AlertList alerts={data.alerts} />
    </div>
  );
}

function RankingQualitySection({ data }: { data: RankingData }) {
  if (data.totalPaired < 10)
    return <InsufficientData count={data.totalPaired} needed={10} />;

  const aucStatus: "good" | "warning" | "critical" =
    data.auc < 0.62 ? "critical" : data.auc < 0.70 ? "warning" : "good";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="AUC"
          value={data.auc.toFixed(4)}
          subtitle="Area Under ROC Curve"
          status={aucStatus}
        />
        {data.topKHitRates.map((tk) => (
          <MetricCard
            key={tk.k}
            label={`Top-${tk.k}% Hit Rate`}
            value={`${(tk.hitRate * 100).toFixed(1)}%`}
            subtitle={`${tk.count} trades in bucket`}
            status={tk.hitRate > 0.5 ? "good" : tk.hitRate > 0.3 ? "warning" : "critical"}
          />
        ))}
      </div>

      {data.liftChart.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">
            Lift Chart
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.liftChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="decile"
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
                label={{
                  value: "Decile (1 = highest predicted)",
                  position: "insideBottom",
                  offset: -5,
                  fill: "#ffffff40",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
                label={{
                  value: "Lift",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#ffffff40",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                formatter={(value: any, name?: string) => {
                  if (name === "lift") return [`${value}x`, "Lift"];
                  return [value, name || ""];
                }}
              />
              <ReferenceLine y={1} stroke="#ffffff30" strokeDasharray="5 5" />
              <Bar dataKey="lift" radius={[4, 4, 0, 0]}>
                {data.liftChart.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.lift >= 1 ? "#10b981" : "#ef4444"}
                    opacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-white/30 mt-2 text-center">
            Lift &gt; 1.0 = better than random; decile 1 should have highest
            lift
          </div>
        </div>
      )}

      <AlertList alerts={data.alerts} />
    </div>
  );
}

function NarrativeIntegritySection({ data }: { data: NarrativeData }) {
  if (data.totalValidations === 0)
    return <InsufficientData count={0} needed={1} />;

  const failStatus: "good" | "warning" | "critical" =
    data.failureRate > 0.03
      ? "critical"
      : data.failureRate > 0.01
        ? "warning"
        : "good";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Failure Rate"
          value={`${(data.failureRate * 100).toFixed(2)}%`}
          subtitle={`${data.totalValidations} total validations`}
          status={failStatus}
        />
        <MetricCard
          label="Incomplete Driver Set"
          value={`${(data.incompleteDriverSetRate * 100).toFixed(2)}%`}
          status={data.incompleteDriverSetRate > 0.01 ? "warning" : "good"}
        />
        <MetricCard
          label="Illegal Numbers"
          value={`${(data.illegalNumberRate * 100).toFixed(2)}%`}
          status={data.illegalNumberRate > 0.01 ? "warning" : "good"}
        />
        <MetricCard
          label="Invalid Drivers"
          value={`${(data.invalidDriverRate * 100).toFixed(2)}%`}
          status={data.invalidDriverRate > 0.01 ? "warning" : "good"}
        />
      </div>

      {data.dailyFailureRates.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/70 mb-4">
            Daily Failure Rate Trend
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dailyFailureRates}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#ffffff60", fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#ffffff60", fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#1a1a2e",
                  border: "1px solid #ffffff20",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                formatter={(value: any) => [
                  `${(value * 100).toFixed(2)}%`,
                  "Failure Rate",
                ]}
              />
              <ReferenceLine
                y={0.01}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{ value: "1% warn", fill: "#f59e0b80", fontSize: 10 }}
              />
              <ReferenceLine
                y={0.03}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: "3% critical", fill: "#ef444480", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <AlertList alerts={data.alerts} />
    </div>
  );
}

function RecalibrationSection({ data }: { data: RecalibrationData }) {
  const shadow = data.shadowB0Metrics;
  const segments = data.segmentB0s?.segments ?? [];
  const history = data.calibrationHistory ?? [];

  const shadowAge = data.shadowB0ComputedAt
    ? Math.round(
        (Date.now() - new Date(data.shadowB0ComputedAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : null;

  const shadowStatus =
    data.shadowB0 == null
      ? "none"
      : shadowAge != null && shadowAge >= 7
        ? "mature"
        : "pending";

  const historyChartData = history.map((h) => ({
    date: new Date(h.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    b0: h.newB0,
    source: h.source,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Active b0"
          value={data.activeB0.toFixed(3)}
          subtitle="Currently used intercept"
          status="neutral"
        />
        <MetricCard
          label="Shadow b0"
          value={data.shadowB0 != null ? data.shadowB0.toFixed(3) : "None"}
          subtitle={
            shadowStatus === "mature"
              ? `Ready to promote (${shadowAge}d old)`
              : shadowStatus === "pending"
                ? `Pending (${shadowAge}d / 7d needed)`
                : "No shadow computed yet"
          }
          status={
            shadowStatus === "mature"
              ? "good"
              : shadowStatus === "pending"
                ? "warning"
                : "neutral"
          }
        />
        <MetricCard
          label="Last Recalibration"
          value={
            data.lastRecalibrationAt
              ? new Date(data.lastRecalibrationAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Never"
          }
          subtitle="Weekly cadence"
          status="neutral"
        />
      </div>

      {shadow && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h4 className="mb-3 text-sm font-semibold text-white/90">
            Shadow b0 Details
          </h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-white/50">Observed Accept Rate</p>
              <p className="text-sm font-medium text-white/90">
                {(shadow.observedRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Predicted Mean</p>
              <p className="text-sm font-medium text-white/90">
                {(shadow.predictedMean * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Log-Odds Correction</p>
              <p className="text-sm font-medium text-white/90">
                {shadow.logOddsCorrection > 0 ? "+" : ""}
                {shadow.logOddsCorrection.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Divergence</p>
              <p
                className={`text-sm font-medium ${shadow.divergence > 0.4 ? "text-red-400" : shadow.divergence > 0.2 ? "text-amber-400" : "text-emerald-400"}`}
              >
                {shadow.divergence.toFixed(3)}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Sample Size</p>
              <p className="text-sm font-medium text-white/90">
                {shadow.sampleSize}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/50">Computed</p>
              <p className="text-sm font-medium text-white/90">
                {new Date(shadow.computedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h4 className="mb-3 text-sm font-semibold text-white/90">
            Segment b0 Profiles
          </h4>
          <p className="mb-3 text-xs text-white/50">
            Separate intercepts per format segment when sample size &ge; 50
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/50">
                  <th className="pb-2 pr-4">Segment</th>
                  <th className="pb-2 pr-4">b0</th>
                  <th className="pb-2 pr-4">vs Global</th>
                  <th className="pb-2 pr-4">Observed</th>
                  <th className="pb-2 pr-4">Predicted</th>
                  <th className="pb-2 pr-4">Samples</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((seg) => {
                  const diff = seg.b0 - data.activeB0;
                  return (
                    <tr
                      key={seg.segment}
                      className="border-b border-white/5 text-white/80"
                    >
                      <td className="py-2 pr-4 font-medium">{seg.segment}</td>
                      <td className="py-2 pr-4 font-mono">
                        {seg.b0.toFixed(3)}
                      </td>
                      <td
                        className={`py-2 pr-4 font-mono ${diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-white/50"}`}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(3)}
                      </td>
                      <td className="py-2 pr-4">
                        {(seg.observedRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4">
                        {(seg.predictedMean * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4">{seg.sampleSize}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {segments.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/40">
          No segment profiles yet. Need &ge; 50 paired outcomes per segment.
        </div>
      )}

      {historyChartData.length > 1 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <h4 className="mb-3 text-sm font-semibold text-white/90">
            b0 History
          </h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#ffffff40" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#ffffff40"
                tick={{ fontSize: 11 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a2e",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <ReferenceLine
                y={-1.1}
                stroke="#ffffff30"
                strokeDasharray="5 5"
                label={{
                  value: "Default",
                  fill: "#ffffff40",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="b0"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ fill: "#818cf8", r: 4 }}
                name="b0"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {historyChartData.length <= 1 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-sm text-white/40">
          Not enough calibration history to chart. History builds over weekly recalibration cycles.
        </div>
      )}
    </div>
  );
}

function DrilldownPanel({
  drilldown,
  onClose,
}: {
  drilldown: DrilldownData;
  onClose: () => void;
}) {
  const curveData = drilldown.reliabilityCurve.map((b) => ({
    name: b.bucketLabel,
    predicted: Math.round(b.predicted * 100),
    observed: Math.round(b.observed * 100),
    count: b.count,
  }));

  const featureLabels: Record<string, string> = {
    lineupImpact: "Lineup Impact",
    vorp: "VORP",
    market: "Market Value",
    behavior: "Manager Behavior",
  };

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-6 animate-in slide-in-from-top">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Drilldown: {drilldown.segmentKey} = {drilldown.segmentValue}
          <span className="ml-2 text-sm font-normal text-white/50">
            ({drilldown.sampleSize} samples, ECE: {drilldown.ece.toFixed(4)})
          </span>
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 hover:bg-white/10 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold text-white/70 mb-4">
            Segment Reliability Curve
          </h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: "#ffffff60", fontSize: 11 }} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #ffffff20", borderRadius: "8px", fontSize: 12 }} />
              <Line type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={2} name="Predicted" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="observed" stroke="#10b981" strokeWidth={2} name="Observed" dot={{ r: 3 }} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {drilldown.featureDrift.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h4 className="text-sm font-semibold text-white/70 mb-4">
              Feature Drift (Segment)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {drilldown.featureDrift.map((f) => (
                <div key={f.feature} className={`rounded-lg border p-3 ${f.drifted ? "border-red-500/30 bg-red-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="text-xs text-white/50">{featureLabels[f.feature] || f.feature}</div>
                  <div className="text-sm font-bold mt-1">PSI: {f.psi.toFixed(3)}</div>
                  <div className="text-xs text-white/40">z: {f.zDrift.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {drilldown.sampleOffers.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold text-white/70 mb-4">
            Sample Offers ({drilldown.sampleOffers.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-white/50 font-medium">ID</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Accept Prob</th>
                  <th className="text-center py-2 px-3 text-white/50 font-medium">Accepted</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Mode</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Drivers</th>
                  <th className="text-left py-2 px-3 text-white/50 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {drilldown.sampleOffers.map((offer) => (
                  <tr key={offer.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-white/60 font-mono text-xs">{offer.id.slice(0, 8)}...</td>
                    <td className="py-2 px-3 text-right font-mono text-white/90">{(offer.acceptProb * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${offer.accepted ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {offer.accepted ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white/70">{offer.mode}</td>
                    <td className="py-2 px-3 text-white/60 text-xs max-w-[200px] truncate">
                      {offer.drivers.map((d) => `${d.id}(${d.direction})`).join(", ")}
                    </td>
                    <td className="py-2 px-3 text-white/50 text-xs">
                      {new Date(offer.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ cards }: { cards: SummaryCardData[] }) {
  const statusColors: Record<string, string> = {
    good: "bg-emerald-500",
    watch: "bg-amber-500",
    critical: "bg-red-500",
  };
  const borderColors: Record<string, string> = {
    good: "border-emerald-500/30",
    watch: "border-amber-500/30",
    critical: "border-red-500/30",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`rounded-xl border bg-white/[0.02] p-4 ${borderColors[card.status] || "border-white/10"}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`h-2.5 w-2.5 rounded-full ${statusColors[card.status] || "bg-white/30"}`} />
            <span className="text-sm font-semibold text-white/90">{card.label}</span>
          </div>
          <div className="text-xs text-white/50 mt-1">{card.detail}</div>
        </div>
      ))}
    </div>
  );
}

function TopSegmentsCard({ data }: { data: SegmentDrift }) {
  if (data.heatmap.length === 0) return null;

  const sorted = [...data.heatmap].sort((a, b) => b.count - a.count);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.length > 3 ? sorted.slice(-3).reverse() : [];

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-violet-400" />
        Top Segments
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Most Data</div>
          <div className="space-y-1.5">
            {top3.map((seg, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                <span className="text-sm text-white/80">{seg.segment}: <span className="font-medium text-white/90">{seg.value}</span></span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40">{seg.count} records</span>
                  <span className={`text-xs font-mono ${seg.ece > 0.12 ? "text-red-400" : seg.ece > 0.08 ? "text-amber-400" : "text-emerald-400"}`}>
                    ECE {seg.ece.toFixed(3)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {bottom3.length > 0 && (
          <div>
            <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Least Data</div>
            <div className="space-y-1.5">
              {bottom3.map((seg, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                  <span className="text-sm text-white/80">{seg.segment}: <span className="font-medium text-white/90">{seg.value}</span></span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/40">{seg.count} records</span>
                    <span className={`text-xs font-mono ${seg.ece > 0.12 ? "text-red-400" : seg.ece > 0.08 ? "text-amber-400" : "text-emerald-400"}`}>
                      ECE {seg.ece.toFixed(3)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  label,
  icon: Icon,
  alertCount,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  icon: typeof Target;
  alertCount: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold">{label}</span>
          {alertCount > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-red-500/20 text-red-400 text-xs px-1.5">
              {alertCount}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function AdminCalibration() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);
  const [mode, setMode] = useState("");
  const [segment, setSegment] = useState("");
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<SectionId>>(
    new Set(["calibration", "segment", "feature", "ranking", "narrative", "recalibration"])
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ days: String(daysBack) });
      if (mode) params.set("mode", mode);
      if (segment) params.set("segment", segment);
      const res = await fetch(`/api/admin/calibration?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [daysBack, mode, segment]);

  const fetchDrilldown = useCallback(async (segmentKey: string, segmentValue: string) => {
    setDrilldownLoading(true);
    setDrilldown(null);
    try {
      const params = new URLSearchParams({ days: String(daysBack), drilldownKey: segmentKey, drilldownValue: segmentValue });
      const res = await fetch(`/api/admin/calibration?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDrilldown(json.drilldown);
    } catch {
      setDrilldown(null);
    } finally {
      setDrilldownLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSection = (id: SectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sectionAlertCounts: Record<SectionId, number> = {
    calibration: data?.calibration.alerts.length ?? 0,
    segment: data?.segmentDrift.alerts.length ?? 0,
    feature: data?.featureDrift.alerts.length ?? 0,
    ranking: data?.ranking.alerts.length ?? 0,
    narrative: data?.narrative.alerts.length ?? 0,
    recalibration: 0,
  };

  const allAlerts = data
    ? [
        ...data.calibration.alerts,
        ...data.segmentDrift.alerts,
        ...data.featureDrift.alerts,
        ...data.ranking.alerts,
        ...data.narrative.alerts,
      ]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calibration Dashboard</h1>
          <p className="text-sm text-white/50 mt-1">
            Trade engine health monitoring &amp; drift detection
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-white/40" />
          </div>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-sm px-3 py-2 outline-none"
          >
            {MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-sm px-3 py-2 outline-none"
          >
            {SEGMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
            className="rounded-lg bg-white/5 border border-white/10 text-sm px-3 py-2 outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {data?.summaryCards && data.summaryCards.length > 0 && (
        <SummaryCards cards={data.summaryCards} />
      )}

      {allAlerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
            <AlertTriangle className="h-4 w-4" />
            {allAlerts.length} Active Alert{allAlerts.length !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-amber-300/70">
            {allAlerts.filter((a) => a.severity === "critical").length} critical,{" "}
            {allAlerts.filter((a) => a.severity === "warning").length} warnings
          </div>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className={`space-y-4 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
          <div className="text-xs text-white/30">
            Data range: {data.dateRange.from} to {data.dateRange.to} | Generated:{" "}
            {new Date(data.generatedAt).toLocaleString()}
          </div>

          <TopSegmentsCard data={data.segmentDrift} />

          <CollapsibleSection
            id="calibration"
            label="Calibration Health"
            icon={Target}
            alertCount={sectionAlertCounts.calibration}
            expanded={expandedSections.has("calibration")}
            onToggle={() => toggleSection("calibration")}
          >
            <CalibrationHealthSection data={data.calibration} />
          </CollapsibleSection>

          <CollapsibleSection
            id="segment"
            label="Segment Drift"
            icon={BarChart3}
            alertCount={sectionAlertCounts.segment}
            expanded={expandedSections.has("segment")}
            onToggle={() => toggleSection("segment")}
          >
            <SegmentDriftSection data={data.segmentDrift} onDrilldown={fetchDrilldown} />
            {drilldownLoading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
              </div>
            )}
            {drilldown && !drilldownLoading && (
              <div className="mt-4">
                <DrilldownPanel drilldown={drilldown} onClose={() => setDrilldown(null)} />
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="feature"
            label="Feature Drift"
            icon={TrendingUp}
            alertCount={sectionAlertCounts.feature}
            expanded={expandedSections.has("feature")}
            onToggle={() => toggleSection("feature")}
          >
            <FeatureDriftSection data={data.featureDrift} />
          </CollapsibleSection>

          <CollapsibleSection
            id="ranking"
            label="Ranking Quality"
            icon={Activity}
            alertCount={sectionAlertCounts.ranking}
            expanded={expandedSections.has("ranking")}
            onToggle={() => toggleSection("ranking")}
          >
            <RankingQualitySection data={data.ranking} />
          </CollapsibleSection>

          <CollapsibleSection
            id="narrative"
            label="Narrative Integrity"
            icon={FileText}
            alertCount={sectionAlertCounts.narrative}
            expanded={expandedSections.has("narrative")}
            onToggle={() => toggleSection("narrative")}
          >
            <NarrativeIntegritySection data={data.narrative} />
          </CollapsibleSection>

          {data.recalibration && (
            <CollapsibleSection
              id="recalibration"
              label="Auto-Recalibration"
              icon={Shield}
              alertCount={sectionAlertCounts.recalibration}
              expanded={expandedSections.has("recalibration")}
              onToggle={() => toggleSection("recalibration")}
            >
              <RecalibrationSection data={data.recalibration} />
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}
