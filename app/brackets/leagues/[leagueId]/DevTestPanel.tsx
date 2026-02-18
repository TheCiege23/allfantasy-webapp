"use client"

import { useState } from "react"

function devHeaders(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" }
  const s = (process.env.NEXT_PUBLIC_BRACKET_DEV_SECRET ?? "").trim()
  if (s) h["x-dev-secret"] = s
  return h
}

const ROUND_LABELS: Record<number, string> = {
  1: "R64",
  2: "R32",
  3: "S16",
  4: "E8",
  5: "FF",
  6: "Final",
}

export default function DevTestPanel({ season }: { season: number }) {
  const [round, setRound] = useState(1)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [simAll, setSimAll] = useState(false)

  async function simulateRound(r: number) {
    const res = await fetch("/api/dev/bracket/simulate", {
      method: "POST",
      headers: devHeaders(),
      body: JSON.stringify({ season, round: r }),
    })
    return res.json().catch(() => ({}))
  }

  async function handleSimulate() {
    setLoading(true)
    setResult(null)
    const json = await simulateRound(round)
    setResult(json)
    setLoading(false)
  }

  async function handleSimulateAll() {
    setSimAll(true)
    setResult(null)
    const res = await fetch("/api/dev/bracket/simulate", {
      method: "POST",
      headers: devHeaders(),
      body: JSON.stringify({ season, mode: "full" }),
    })
    const json = await res.json().catch(() => ({}))
    setResult(json)
    setSimAll(false)
  }

  return (
    <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-yellow-300">Dev: Test Scenario Runner</div>
        <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-400 uppercase">
          Dev Only
        </span>
      </div>
      <p className="text-xs text-white/50">
        Simulate game results and run scoring/advancement to verify points, pick locking, and winners.
      </p>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          value={round}
          onChange={(e) => setRound(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <option key={r} value={r}>
              Round {r} ({ROUND_LABELS[r]})
            </option>
          ))}
        </select>

        <button
          onClick={handleSimulate}
          disabled={loading || simAll}
          className="rounded-xl bg-yellow-500 text-black px-4 py-2 text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60 transition-colors"
        >
          {loading ? "Running..." : "Simulate round"}
        </button>

        <button
          onClick={handleSimulateAll}
          disabled={loading || simAll}
          className="rounded-xl border border-yellow-500/30 text-yellow-300 px-4 py-2 text-sm font-medium hover:bg-yellow-500/10 disabled:opacity-60 transition"
        >
          {simAll ? "Simulating all..." : "Simulate full tournament"}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          {result.verdict && (
            <div
              className={`rounded-xl px-3 py-2 text-sm font-medium ${
                result.allAssertionsPass
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/30 text-red-300"
              }`}
            >
              {result.verdict}
            </div>
          )}

          {result.champion && (
            <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-sm text-yellow-200">
              Champion: <span className="font-bold">{result.champion}</span>
            </div>
          )}

          {result.dbAssertions && (
            <div className="space-y-1">
              {result.dbAssertions.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={a.pass ? "text-emerald-400" : "text-red-400"}>
                    {a.pass ? "PASS" : "FAIL"}
                  </span>
                  <span className="text-white/70">{a.name}</span>
                  <span className="text-white/40 ml-auto">{a.detail}</span>
                </div>
              ))}
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-white/40 hover:text-white/60">
              Raw response
            </summary>
            <pre className="mt-2 bg-black/30 border border-white/10 rounded-xl p-3 overflow-auto max-h-56 text-white/60">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
