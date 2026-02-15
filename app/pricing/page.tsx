'use client'

import Link from 'next/link'

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#05060a] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[160px]" />
        <div className="absolute top-52 -left-56 h-[520px] w-[520px] rounded-full bg-fuchsia-500/7 blur-[180px]" />
        <div className="absolute -bottom-64 right-0 h-[560px] w-[560px] rounded-full bg-indigo-500/9 blur-[190px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition mb-6 sm:mb-8 min-h-[44px]"
        >
          <span>←</span> Back to Home
        </Link>

        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-white/90 to-white/70 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="mt-2 sm:mt-3 text-sm sm:text-base text-white/50">Unlock the full power of AI-driven fantasy sports</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 overflow-visible max-w-md sm:max-w-none mx-auto">
          <div className="group relative rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-br from-white/20 via-white/5 to-transparent">
            <div className="relative rounded-[15px] sm:rounded-[23px] bg-gradient-to-br from-[#0a0c12] via-[#0d1018] to-[#080a0f] p-4 sm:p-5 h-full flex flex-col">
              <div className="text-xs uppercase tracking-wider text-white/40 font-medium">Free</div>
              <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold text-white">AF Free</h3>
              <p className="mt-1 text-xs text-white/40">The core experience — no AI</p>
              <div className="mt-2.5 sm:mt-3">
                <span className="text-2xl sm:text-3xl font-black text-white">$0</span>
                <span className="text-white/40 text-sm">/forever</span>
              </div>
              <ul className="mt-3 sm:mt-4 space-y-2 text-sm text-white/60 flex-1">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Unlimited leagues</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> League & DM chat</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Legacy import & ranking</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Career stats & history</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70">✗</span> <span className="text-white/40">No AI features</span></li>
              </ul>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <span className="text-xs text-white/40">Legacy refresh: 1/week</span>
              </div>
            </div>
          </div>

          <div className="group relative rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-br from-cyan-500/40 via-cyan-500/10 to-transparent">
            <div className="absolute -inset-1 rounded-3xl blur-xl opacity-30 bg-cyan-500/10" />
            <div className="relative rounded-[15px] sm:rounded-[23px] bg-gradient-to-br from-[#0a0c12] via-[#0d1018] to-[#080a0f] p-4 sm:p-5 h-full flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-cyan-400/70 font-medium">Pro</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-[10px] text-cyan-300 font-medium">Popular</span>
              </div>
              <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold bg-gradient-to-r from-cyan-200 to-cyan-400 bg-clip-text text-transparent">AF Pro</h3>
              <p className="mt-1 text-xs text-cyan-300/50">For competitive players</p>
              <div className="mt-2.5 sm:mt-3">
                <span className="text-2xl sm:text-3xl font-black text-white">$9.99</span>
                <span className="text-white/40 text-sm">/month</span>
              </div>
              <div className="text-xs text-cyan-300/60 mt-1">or $99.99/year (save 17%)</div>
              <ul className="mt-3 sm:mt-4 space-y-2 text-sm text-white/60 flex-1">
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Everything in Free</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> AI Analysis (25/day)</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> AI Coach (25/day)</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Start/Sit advice</li>
                <li className="flex items-center gap-2"><span className="text-cyan-400">✓</span> Auto league settings</li>
              </ul>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <span className="text-xs text-cyan-300/50">Legacy refresh: Daily</span>
              </div>
            </div>
          </div>

          <div className="group relative rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-br from-purple-500/40 via-purple-500/10 to-transparent">
            <div className="absolute -inset-1 rounded-3xl blur-xl opacity-30 bg-purple-500/10" />
            <div className="relative rounded-[15px] sm:rounded-[23px] bg-gradient-to-br from-[#0a0c12] via-[#0d1018] to-[#080a0f] p-4 sm:p-5 h-full flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-purple-400/70 font-medium">Commissioner</span>
                <span className="text-lg">🧠</span>
              </div>
              <h3 className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold bg-gradient-to-r from-purple-200 to-purple-400 bg-clip-text text-transparent">AF Super Commissioner</h3>
              <p className="mt-1 text-xs text-purple-300/50">Run the best league possible</p>
              <div className="mt-2.5 sm:mt-3">
                <span className="text-2xl sm:text-3xl font-black text-white">$4.99</span>
                <span className="text-white/40 text-sm">/month</span>
              </div>
              <div className="text-xs text-purple-300/60 mt-1">or $49.99/year (save 17%)</div>
              <ul className="mt-3 sm:mt-4 space-y-2 text-sm text-white/60 flex-1">
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span> AI collusion detection</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span> AI tanking detection</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span> AI weekly recaps</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span> AI rivalry weeks</li>
                <li className="flex items-center gap-2"><span className="text-purple-400">✓</span> League import (Sleeper)</li>
                <li className="flex items-center gap-2"><span className="text-red-400/70">✗</span> <span className="text-white/40">No player AI</span></li>
              </ul>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <span className="text-xs text-purple-300/50">Commissioner AI: Unlimited</span>
              </div>
            </div>
          </div>

          <div className="group relative rounded-2xl sm:rounded-3xl p-[1px] bg-gradient-to-br from-amber-500/50 via-yellow-500/20 to-orange-500/30 shadow-[0_0_30px_rgba(251,191,36,0.15)]">
            <div className="absolute -inset-1 rounded-3xl blur-xl opacity-30 bg-amber-500/15 pointer-events-none" />
            <div className="rounded-[15px] sm:rounded-[23px] bg-gradient-to-br from-[#0f0d08] via-[#0d1018] to-[#080a0f] p-4 sm:p-5 h-full flex flex-col">
              <div className="text-xs uppercase tracking-wider text-amber-400/80 font-medium">Supreme</div>
              <h3 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300 bg-clip-text text-transparent">AF Supreme</h3>
              <p className="mt-1 text-xs text-amber-300/50">Power user + status + no friction</p>
              <div className="mt-2.5 sm:mt-3">
                <span className="text-2xl sm:text-3xl font-black text-white">$12.99</span>
                <span className="text-white/40 text-sm">/month</span>
              </div>
              <div className="text-xs text-amber-300/60 mt-1">or $120.99/year (save 22%)</div>
              <ul className="mt-3 sm:mt-4 space-y-2 text-sm text-white/60 flex-1">
                <li className="flex items-center gap-2"><span className="text-amber-400">✓</span> All Free features</li>
                <li className="flex items-center gap-2"><span className="text-amber-400">✓</span> All Pro features</li>
                <li className="flex items-center gap-2"><span className="text-amber-400">✓</span> All Commissioner features</li>
                <li className="flex items-center gap-2"><span className="text-amber-400">👑</span> Supreme badge</li>
                <li className="flex items-center gap-2"><span className="text-amber-400">✓</span> Priority feature access</li>
                <li className="flex items-center gap-2"><span className="text-amber-400">✓</span> Unlimited everything</li>
              </ul>
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-amber-500/20">
                <span className="text-xs text-amber-300/60">All AI: Unlimited</span>
              </div>
            </div>
            <div className="absolute -top-3 -right-3 z-[9999] pointer-events-none">
              <span className="text-3xl sm:text-4xl" style={{ filter: 'drop-shadow(0 2px 10px rgba(251,191,36,0.8))' }}>👑</span>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-10 text-center pb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500/80 to-purple-500/80 text-white font-bold hover:from-cyan-400/90 hover:to-purple-400/90 active:scale-[0.98] transition shadow-[0_12px_35px_rgba(0,0,0,0.35)] min-h-[48px] w-full sm:w-auto justify-center"
          >
            Get Early Access
          </Link>
        </div>
      </div>
    </main>
  )
}
