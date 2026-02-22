"use client"

import { useState } from "react"
import {
  FlaskConical,
  BarChart3,
  SlidersHorizontal,
  RefreshCcw,
  Download,
  Zap,
  TrendingUp,
  Shuffle,
  Target,
  Activity,
  ChevronRight,
  Lock,
  Sparkles,
} from "lucide-react"

interface Props {
  userId: string
  tournamentId: string
  tournamentName: string
}

type Tab = "simulations" | "compare" | "strategy" | "recalibrate" | "reports"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "simulations", label: "Simulations", icon: <Activity className="w-4 h-4" /> },
  { id: "compare", label: "Compare", icon: <BarChart3 className="w-4 h-4" /> },
  { id: "strategy", label: "Strategy", icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: "recalibrate", label: "Recalibrate", icon: <RefreshCcw className="w-4 h-4" /> },
  { id: "reports", label: "Reports", icon: <Download className="w-4 h-4" /> },
]

const BRACKET_STYLES = [
  { id: "chalk", label: "Chalk", desc: "Follow the seeds. Minimal upsets.", color: "#22c55e", icon: <Target className="w-5 h-5" /> },
  { id: "balanced", label: "Balanced", desc: "Mix of favorites and calculated upsets.", color: "#3b82f6", icon: <TrendingUp className="w-5 h-5" /> },
  { id: "chaos", label: "Chaos", desc: "Maximum upsets. High risk, high reward.", color: "#ef4444", icon: <Shuffle className="w-5 h-5" /> },
]

export function LabDashboardShell({ userId, tournamentId, tournamentName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("simulations")
  const [simCount, setSimCount] = useState(1000)
  const [running, setRunning] = useState(false)
  const [riskSlider, setRiskSlider] = useState(50)
  const [uniquenessSlider, setUniquenessSlider] = useState(50)
  const [upsetSlider, setUpsetSlider] = useState(30)

  return (
    <div className="min-h-screen text-white" style={{ background: "#0a0e17" }}>
      <header className="sticky top-0 z-40 backdrop-blur" style={{ background: "rgba(10,14,23,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)" }}>
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Bracket Lab
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>PASS</span>
              </div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{tournamentName}</div>
            </div>
          </div>
          <a href="/brackets" className="text-xs px-3 py-1.5 rounded-lg transition hover:bg-white/5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Back to Brackets
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition"
              style={{
                background: activeTab === tab.id ? "rgba(251,146,60,0.12)" : "transparent",
                color: activeTab === tab.id ? "#fb923c" : "rgba(255,255,255,0.4)",
                border: activeTab === tab.id ? "1px solid rgba(251,146,60,0.2)" : "1px solid transparent",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === "simulations" && (
          <SimulationsPanel
            simCount={simCount}
            setSimCount={setSimCount}
            running={running}
            setRunning={setRunning}
            tournamentId={tournamentId}
          />
        )}
        {activeTab === "compare" && <ComparePanel />}
        {activeTab === "strategy" && (
          <StrategyPanel
            risk={riskSlider}
            setRisk={setRiskSlider}
            uniqueness={uniquenessSlider}
            setUniqueness={setUniquenessSlider}
            upsetTolerance={upsetSlider}
            setUpsetTolerance={setUpsetSlider}
          />
        )}
        {activeTab === "recalibrate" && <RecalibratePanel />}
        {activeTab === "reports" && <ReportsPanel />}
      </main>
    </div>
  )
}

function SimulationsPanel({
  simCount,
  setSimCount,
  running,
  setRunning,
  tournamentId,
}: {
  simCount: number
  setSimCount: (n: number) => void
  running: boolean
  setRunning: (b: boolean) => void
  tournamentId: string
}) {
  const [results, setResults] = useState<null | { winPct: Record<string, number>; avgScore: number; upsetRate: number }>(null)

  function handleRun() {
    setRunning(true)
    setTimeout(() => {
      setResults({
        winPct: { "Your Bracket": 12.4, "Field Average": 8.1, "Chalk Baseline": 6.3 },
        avgScore: 142,
        upsetRate: 34.2,
      })
      setRunning(false)
    }, 2000)
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Monte Carlo Simulations" subtitle="Run thousands of tournament simulations to evaluate your bracket's strength">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(255,255,255,0.3)" }}>Simulation Runs</label>
            <div className="flex gap-2">
              {[1000, 5000, 10000].map((n) => (
                <button
                  key={n}
                  onClick={() => setSimCount(n)}
                  className="text-xs px-3 py-2 rounded-lg font-semibold transition"
                  style={{
                    background: simCount === n ? "rgba(251,146,60,0.15)" : "rgba(255,255,255,0.03)",
                    color: simCount === n ? "#fb923c" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${simCount === n ? "rgba(251,146,60,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 transition"
            style={{ background: "#fb923c" }}
          >
            {running ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Running {simCount.toLocaleString()}...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Simulations
              </>
            )}
          </button>
        </div>
      </SectionCard>

      {running && (
        <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-full rounded-full h-2 mb-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full animate-pulse" style={{ background: "linear-gradient(90deg, #fb923c, #f59e0b)", width: "60%" }} />
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Simulating {simCount.toLocaleString()} tournament outcomes...
          </p>
        </div>
      )}

      {results && !running && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Win Rate" value={`${results.winPct["Your Bracket"]}%`} sub="vs 8.1% field avg" accent="#22c55e" />
          <StatCard label="Avg Score" value={String(results.avgScore)} sub="projected points" accent="#3b82f6" />
          <StatCard label="Upset Rate" value={`${results.upsetRate}%`} sub="of simulated upsets hit" accent="#f59e0b" />
        </div>
      )}

      {results && !running && (
        <SectionCard title="Win Probability Breakdown" subtitle="How your bracket compares across simulation runs">
          <div className="space-y-3">
            {Object.entries(results.winPct).map(([label, pct]) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
                  <span className="font-bold" style={{ color: "#fb923c" }}>{pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, pct * 4)}%`, background: label === "Your Bracket" ? "#fb923c" : "rgba(255,255,255,0.15)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function ComparePanel() {
  return (
    <div className="space-y-4">
      <SectionCard title="Compare Bracket Styles" subtitle="See how different approaches perform across thousands of simulations">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BRACKET_STYLES.map((style) => (
            <button
              key={style.id}
              className="rounded-xl p-4 text-left transition hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${style.color}33` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${style.color}15`, color: style.color }}>
                  {style.icon}
                </div>
                <span className="text-sm font-bold">{style.label}</span>
              </div>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{style.desc}</p>
              <div className="flex items-center gap-1 mt-3 text-[10px] font-semibold" style={{ color: style.color }}>
                Run comparison <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Style Comparison Results" subtitle="Results will appear here after running a comparison">
        <div className="text-center py-8">
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Select a bracket style above to compare outcomes
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

function StrategyPanel({
  risk,
  setRisk,
  uniqueness,
  setUniqueness,
  upsetTolerance,
  setUpsetTolerance,
}: {
  risk: number
  setRisk: (n: number) => void
  uniqueness: number
  setUniqueness: (n: number) => void
  upsetTolerance: number
  setUpsetTolerance: (n: number) => void
}) {
  return (
    <div className="space-y-4">
      <SectionCard title="Strategy Sliders" subtitle="Adjust parameters to explore how different strategies affect outcomes">
        <div className="space-y-6">
          <SliderControl
            label="Risk Tolerance"
            value={risk}
            onChange={setRisk}
            low="Conservative"
            high="Aggressive"
            color="#ef4444"
          />
          <SliderControl
            label="Uniqueness"
            value={uniqueness}
            onChange={setUniqueness}
            low="Follow Consensus"
            high="Contrarian"
            color="#8b5cf6"
          />
          <SliderControl
            label="Upset Tolerance"
            value={upsetTolerance}
            onChange={setUpsetTolerance}
            low="Chalk Heavy"
            high="Upset Heavy"
            color="#f59e0b"
          />
        </div>

        <div className="mt-6 rounded-xl p-4" style={{ background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.1)" }}>
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#fb923c" }} />
            <div>
              <div className="text-xs font-semibold" style={{ color: "#fb923c" }}>Strategy Profile</div>
              <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                {risk > 60 ? "High-risk" : risk < 40 ? "Conservative" : "Balanced"} approach with{" "}
                {uniqueness > 60 ? "contrarian" : uniqueness < 40 ? "consensus-aligned" : "moderate"} picks and{" "}
                {upsetTolerance > 50 ? "upset-friendly" : "chalk-leaning"} tendencies.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function RecalibratePanel() {
  return (
    <div className="space-y-4">
      <SectionCard title="Round-by-Round Recalibration" subtitle="After each round completes, see how your bracket's outlook changes">
        <div className="space-y-2">
          {["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"].map((round, i) => {
            const completed = i < 0
            return (
              <div
                key={round}
                className="flex items-center justify-between rounded-xl px-4 py-3 transition"
                style={{
                  background: completed ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${completed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: completed ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      color: completed ? "#22c55e" : "rgba(255,255,255,0.3)",
                    }}
                  >
                    R{i + 1}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: completed ? "white" : "rgba(255,255,255,0.5)" }}>{round}</span>
                </div>
                <div className="flex items-center gap-2">
                  {completed ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                      Recalibrated
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                      <Lock className="w-3 h-3" /> Awaiting results
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

function ReportsPanel() {
  const reports = [
    { name: "Bracket Health Report", desc: "Overall bracket strength analysis", format: "PDF" },
    { name: "Volatility Summary", desc: "Which picks carry the most risk", format: "CSV" },
    { name: "Scenario Outcomes", desc: "Best/worst case point projections", format: "PDF" },
    { name: "Simulation Raw Data", desc: "Full simulation run results", format: "CSV" },
  ]

  return (
    <div className="space-y-4">
      <SectionCard title="Exportable Reports" subtitle="Download detailed analysis of your bracket and simulations">
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{r.desc}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>
                  {r.format}
                </span>
                <button
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  style={{ background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.2)" }}
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <h2 className="text-base font-bold mb-0.5">{title}</h2>
      <p className="text-[11px] mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>{subtitle}</p>
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</div>
    </div>
  )
}

function SliderControl({
  label,
  value,
  onChange,
  low,
  high,
  color,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  low: string
  high: string
  color: string
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(90deg, ${color} ${value}%, rgba(255,255,255,0.06) ${value}%)`,
          accentColor: color,
        }}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>{low}</span>
        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>{high}</span>
      </div>
    </div>
  )
}
