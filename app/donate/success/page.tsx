"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"

function SuccessContent() {
  const params = useSearchParams()
  const router = useRouter()
  const mode = params.get("mode")

  const isLab = mode === "lab"

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 space-y-4">
          <div className="text-5xl">
            {isLab ? "🔬" : "💙"}
          </div>

          <h1 className="text-2xl font-bold">
            {isLab ? "Bracket Lab Unlocked" : "Thank You for Your Support"}
          </h1>

          <p className="text-sm text-white/60">
            {isLab
              ? "You now have access to simulations, strategy exploration, and research tools for this tournament. Head to Bracket Lab to get started."
              : "Your donation helps keep brackets free for everyone. We appreciate your generosity."}
          </p>

          <div className="flex flex-col gap-3 pt-2">
            {isLab && (
              <button
                onClick={() => router.push("/lab")}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Open Bracket Lab
              </button>
            )}

            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl border border-white/10 bg-slate-800/50 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DonateSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-white/50">Loading...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
