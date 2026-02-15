"use client"

import React, { useMemo, useState } from "react"
import { useV3ModelAdmin } from "@/hooks/useV3ModelAdmin"
import { DriftDashboard } from "@/components/DriftDashboard"

function NumberInput(props: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      className="w-20 rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm"
      type="number"
      step="0.01"
      value={props.value}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  )
}

export function V3WeightsPanel(props: { leagueId: string; season: string; defaultWeek: number }) {
  const admin = useV3ModelAdmin({ leagueId: props.leagueId, season: props.season })

  const defaults = admin.weights?.default ?? { win: 0.22, power: 0.33, luck: 0.1, market: 0.2, skill: 0.15 }

  const [week, setWeek] = useState<number>(props.defaultWeek)
  const [reason, setReason] = useState<string>("manual snapshot")

  const [win, setWin] = useState<number>(defaults.win ?? 0.22)
  const [power, setPower] = useState<number>(defaults.power ?? 0.33)
  const [luck, setLuck] = useState<number>(defaults.luck ?? 0.1)
  const [market, setMarket] = useState<number>(defaults.market ?? 0.2)
  const [skill, setSkill] = useState<number>(defaults.skill ?? 0.15)

  useMemo(() => {
    setWin(defaults.win ?? 0.22)
    setPower(defaults.power ?? 0.33)
    setLuck(defaults.luck ?? 0.1)
    setMarket(defaults.market ?? 0.2)
    setSkill(defaults.skill ?? 0.15)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin.weights?.default])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-bold">V3 weights snapshots</div>
            <div className="text-xs opacity-70">Season {props.season} • stored snapshots + drift monitoring</div>
          </div>
          <button
            className="rounded-xl bg-zinc-800 px-4 py-2 font-bold disabled:opacity-60"
            disabled={admin.loading}
            onClick={() => admin.refresh()}
          >
            Refresh
          </button>
        </div>

        {admin.error ? <div className="text-sm opacity-80 mb-3">Error: {admin.error}</div> : null}

        <div className="rounded-2xl bg-zinc-950 p-4">
          <div className="font-bold mb-2">Create snapshot</div>

          <div className="flex flex-wrap gap-2 items-center mb-3">
            <div className="text-xs opacity-70">Week</div>
            <input
              className="w-24 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm"
              type="number"
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
            />
            <div className="text-xs opacity-70 ml-2">Reason</div>
            <input
              className="min-w-[240px] flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
            <div>
              <div className="text-xs opacity-70 mb-1">win</div>
              <NumberInput value={win} onChange={setWin} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">power</div>
              <NumberInput value={power} onChange={setPower} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">luck</div>
              <NumberInput value={luck} onChange={setLuck} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">market</div>
              <NumberInput value={market} onChange={setMarket} />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">skill</div>
              <NumberInput value={skill} onChange={setSkill} />
            </div>
          </div>

          <div className="mt-3">
            <button
              className="rounded-xl bg-white text-black px-4 py-2 font-bold disabled:opacity-60"
              disabled={admin.loading}
              onClick={() =>
                admin.createSnapshot({
                  season: props.season,
                  week,
                  reason,
                  weights: { win, power, luck, market, skill }
                })
              }
            >
              Save snapshot
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-zinc-950 p-4">
          <div className="font-bold mb-2">Recent snapshots</div>
          <div className="max-h-64 overflow-auto text-sm">
            {(admin.weights?.rows ?? []).map((r: any) => (
              <div key={String(r.id)} className="border-b border-zinc-800 py-2 flex justify-between">
                <div className="opacity-90">
                  <div className="font-semibold">
                    {r.season} • Week {r.week}
                  </div>
                  <div className="text-xs opacity-70">{r.reason ?? "—"}</div>
                </div>
                <div className="text-xs opacity-70 text-right">
                  <div>win {r.weights?.win ?? "—"}</div>
                  <div>power {r.weights?.power ?? "—"}</div>
                  <div>market {r.weights?.market ?? "—"}</div>
                </div>
              </div>
            ))}
            {(!admin.weights?.rows?.length && !admin.loading) ? (
              <div className="text-xs opacity-70">No snapshots yet.</div>
            ) : null}
          </div>
        </div>
      </div>

      <DriftDashboard leagueId={props.leagueId} />
    </div>
  )
}
