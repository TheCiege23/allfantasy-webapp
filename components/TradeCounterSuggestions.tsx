"use client"

import React from "react"

type Candidate = {
  id: string
  name: string
  pos?: string
  team?: string
}

type Counter = {
  label?: string
  changes?: any[]
  acceptProb?: number
  fairnessScore?: number
  whyTheyAccept?: string[]
  whyItHelpsYou?: string[]
  options?: {
    addCandidates?: Candidate[]
    askCandidates?: Candidate[]
  }
}

export default function TradeCounterSuggestions({
  counters,
  onAddCandidateToGive,
  onAddCandidateToGet,
}: {
  counters: Counter[] | null | undefined
  onAddCandidateToGive: (playerId: string) => void
  onAddCandidateToGet: (playerId: string) => void
}) {
  if (!counters || counters.length === 0) return null

  const [animatedAccept, setAnimatedAccept] = React.useState<number | null>(null)

  const applyBest = (c: Counter) => {
    const add = c.options?.addCandidates ?? []
    const ask = c.options?.askCandidates ?? []

    if (add.length > 0) onAddCandidateToGive(add[0].id)
    if (ask.length > 0) onAddCandidateToGet(ask[0].id)
  }

  const applyLabel = (c: Counter) => {
    const add = (c.options?.addCandidates ?? []).length > 0
    const ask = (c.options?.askCandidates ?? []).length > 0
    if (add && ask) return "Apply (Best Counter)"
    if (add) return "Apply (Add Sweetener)"
    if (ask) return "Apply (Ask Add-on)"
    return "Apply"
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Counter Suggestions (Clickable)
          </div>
          <div className="mt-1 text-xs text-white/60">
            Click a player to auto-add them, or use <span className="text-white/80">Apply</span>{" "}
            to add the best option(s) instantly.
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {counters.map((c, idx) => {
          const add = c.options?.addCandidates ?? []
          const ask = c.options?.askCandidates ?? []
          const showAdd = add.length > 0
          const showAsk = ask.length > 0
          const showApply = showAdd || showAsk

          return (
            <div key={idx} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    {c.label || `Counter Option ${idx + 1}`}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {typeof c.acceptProb === "number" ? (
                      <>Est. Accept: {animatedAccept !== null ? animatedAccept : (c.acceptProb * 100).toFixed(0)}%</>
                    ) : (
                      <>Est. Accept: —</>
                    )}
                    {typeof c.fairnessScore === "number" ? (
                      <span className="ml-2">• Fairness: {c.fairnessScore}</span>
                    ) : null}
                  </div>
                </div>

                {showApply ? (
                  <button
                    type="button"
                    onClick={() => {
                      applyBest(c)
                      if (typeof c.acceptProb === "number") {
                        let start = Math.max(0, Math.round((c.acceptProb - 0.15) * 100))
                        const target = Math.round(c.acceptProb * 100)
                        setAnimatedAccept(start)
                        const interval = setInterval(() => {
                          start += 1
                          if (start >= target) {
                            clearInterval(interval)
                          }
                          setAnimatedAccept(start)
                        }, 15)
                      }
                    }}
                    className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/20"
                    title="Apply the best recommended counter adjustment"
                  >
                    {applyLabel(c)}
                  </button>
                ) : null}
              </div>

              {Array.isArray(c.changes) && c.changes.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-white/70 space-y-1">
                  {c.changes.slice(0, 4).map((ch, i) => (
                    <li key={i}>
                      {typeof ch === "string"
                        ? ch
                        : typeof ch === "object"
                          ? Object.values(ch).filter(Boolean).join(" ")
                          : String(ch)}
                    </li>
                  ))}
                </ul>
              ) : null}

              {showAdd ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-cyan-300">
                    Add to Side B (You Give) — pick one:
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {add.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onAddCandidateToGive(p.id)}
                        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
                        title="Click to add to You Give"
                      >
                        {p.name}
                        {p.pos ? ` (${p.pos})` : ""}
                        {p.team ? ` • ${p.team}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showAsk ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-purple-300">
                    Ask from them (You Get) — pick one:
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ask.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onAddCandidateToGet(p.id)}
                        className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-xs text-purple-100 hover:bg-purple-400/20"
                        title="Click to add to You Get"
                      >
                        {p.name}
                        {p.pos ? ` (${p.pos})` : ""}
                        {p.team ? ` • ${p.team}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
