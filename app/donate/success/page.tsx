"use client"

import { useMemo } from "react"

function getMode(): "donate" | "lab" {
  if (typeof window === "undefined") return "donate"
  return new URLSearchParams(window.location.search).get("mode") === "lab" ? "lab" : "donate"
}

export default function DonateSuccessPage() {
  const mode = useMemo(getMode, [])
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-xs text-white/60">Payment confirmed</div>
          <h1 className="mt-3 text-2xl font-semibold">
            {mode === "lab" ? "Bracket Lab Pass unlocked" : "Thank you for supporting"}
          </h1>
          <p className="mt-2 text-white/70">
            {mode === "lab"
              ? "You can now access the Lab dashboard for this tournament."
              : "Your support helps fund performance, data costs, and new features."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/lab"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
            >
              Go to Lab
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-semibold text-slate-950 hover:opacity-95"
            >
              Back to Brackets
            </a>
          </div>

          <p className="mt-6 text-xs text-white/55">
            Bracket Lab is a research/visualization tool. No guarantees. FanCred Brackets does not collect entry fees or pay prizes.
          </p>
        </div>
      </div>
    </div>
  )
}
