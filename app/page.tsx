'use client'

import React, { useMemo, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ModeToggle } from '@/components/theme/ModeToggle'
import { BracketsNavLinks } from '@/components/bracket/BracketsNavLinks'
import EarlyAccessForm from '@/app/components/EarlyAccessForm'
import InstantTradeAnalyzer from '@/app/components/InstantTradeAnalyzer'

const NewsCrawl = dynamic(() => import('@/components/NewsCrawl'), {
  ssr: false,
  loading: () => null,
})

function DeferredNewsCrawl() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(() => setReady(true), { timeout: 4000 })
      return () => (window as any).cancelIdleCallback(id)
    } else {
      const t = setTimeout(() => setReady(true), 3000)
      return () => clearTimeout(t)
    }
  }, [])
  if (!ready) return null
  return <NewsCrawl />
}

function HomeContent() {
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch('/api/track-visitor', { method: 'POST' }).catch(() => {})
  }, [searchParams])

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'AllFantasy',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web',
      description:
        'AI-powered fantasy sports platform for drafts, waivers, start/sit, and modern league formats across NFL, NBA, and MLB.',
      url: 'https://allfantasy.ai/',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    }),
    []
  )

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Gradient background - theme-aware */}
      <div className="pointer-events-none absolute inset-0 gradient-bg-orbs">
        <div className="gradient-orb-1 absolute -top-32 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full blur-[200px]" />
        <div className="gradient-orb-2 absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full blur-[180px]" />
        <div className="gradient-orb-3 absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full blur-[200px]" />
        <div className="gradient-overlay absolute inset-0" />
      </div>

      <div className="pointer-events-none absolute inset-0 noise-overlay" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 lg:px-12 py-6 sm:py-16 md:py-20">

        {/* Top bar with nav + theme toggle */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <BracketsNavLinks />
          <ModeToggle className="rounded-xl px-3 py-2 text-sm font-semibold active:scale-[0.98] transition" />
        </div>

        {/* Announcement Badge */}
        <div className="mx-auto w-fit mb-6 sm:mb-10">
          <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-purple-600/30 via-pink-500/25 to-cyan-500/30 shadow-lg shadow-purple-500/10" style={{ border: '1px solid var(--border)' }}>
            <span className="text-xs sm:text-sm font-semibold tracking-wide bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--heading-to), var(--heading-via), var(--heading-from))` }}>
              AllFantasy App Launching 2026 - Early Access Open
            </span>
          </div>
        </div>

        {/* HERO GRID */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

          {/* Left: Headline + Form */}
          <div className="text-center lg:text-left space-y-5 sm:space-y-6">
            <div className="space-y-2 sm:space-y-3">
              <h1 className="text-3xl sm:text-5xl md:text-6xl xl:text-7xl font-black tracking-tight leading-[1.05]">
                <span className="block bg-clip-text text-transparent drop-shadow-[0_0_60px_rgba(34,211,238,0.4)]" style={{ backgroundImage: `linear-gradient(to right, var(--hero-from), var(--hero-via), var(--hero-to))` }}>
                  Stop guessing in
                </span>
                <span className="block bg-[length:200%_auto] animate-gradient-x bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--heading-from), var(--heading-to), var(--heading-from))` }}>
                  fantasy football.
                </span>
              </h1>
              <p className="text-lg sm:text-2xl md:text-3xl font-semibold leading-snug max-w-md mx-auto lg:mx-0" style={{ color: 'var(--text)' }}>
                Let AI make the smart moves for you.
              </p>
            </div>

            <p className="text-sm sm:text-lg leading-relaxed max-w-sm mx-auto lg:mx-0" style={{ color: 'var(--muted)' }}>
              Draft better, win more trades, and dominate waivers — powered by AI for <span className="font-bold" style={{ color: 'var(--text)' }}>NFL</span> <span style={{ color: 'var(--muted2)' }}>(more sports coming soon)</span>.
            </p>

            <div className="space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--accent-cyan-strong)' }}>Built by real fantasy players — not a corporation.</p>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>We built the tools we always wished existed.</p>
            </div>

            <EarlyAccessForm />

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Link 
                href="/af-legacy" 
                className="rounded-xl glow-box inline-flex items-center justify-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-3.5 text-sm sm:text-base font-semibold flex-1 min-h-[48px]
                           bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20
                           border border-cyan-400/40
                           hover:from-cyan-500/30 hover:via-purple-500/30 hover:to-cyan-500/30
                           hover:border-cyan-400/60
                           active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition-all duration-300 group"
                style={{ color: 'var(--text)' }}
              >
                <span style={{ color: 'var(--accent-cyan-strong)' }} className="text-lg">⚡</span>
                <span>AF Legacy Tools</span>
                <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
              </Link>

              <Link
                href="/brackets"
                className="rounded-xl inline-flex items-center justify-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-3.5 text-sm sm:text-base font-semibold flex-1 min-h-[48px]
                           bg-gradient-to-r from-purple-600/20 via-indigo-500/20 to-purple-600/20
                           border border-purple-400/40
                           hover:from-purple-600/30 hover:via-indigo-500/30 hover:to-purple-600/30
                           hover:border-purple-400/60
                           active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-400/40 transition-all duration-300 group"
                style={{ color: 'var(--text)' }}
              >
                <span className="text-lg">🏀</span>
                <span>Bracket Challenge</span>
                <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
              </Link>
            </div>
          </div>

          {/* Right: Interactive Instant Trade Analyzer */}
          <InstantTradeAnalyzer />
        </div>

        {/* 2 SECONDARY AI PREVIEW CARDS */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          
          {/* AI Trade Evaluator Card */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/20 flex items-center justify-center">
                  <span className="text-base">⚖️</span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Trade Evaluator</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>Deterministic grades. No guesswork.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20" style={{ color: 'var(--accent-cyan)' }}>4-Tier System</span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2.5 p-2 rounded-lg" style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.15)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black bg-gradient-to-br from-emerald-400/90 to-emerald-600/90 text-white shrink-0">B+</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text)' }}>Amon-Ra → Breece Hall + 1.08</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>Dynasty</span>
                    <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>+420 delta</span>
                    <span className="text-[10px]" style={{ color: 'var(--accent-emerald)' }}>72% accept</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>Letter grades from a 4-layer deterministic engine — market value, lineup delta, replacement level, and manager context.</p>
          </div>

          {/* Waiver AI Card */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-500/20 flex items-center justify-center">
                  <span className="text-base">📈</span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Waiver Wire AI</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>Find hidden gems before your league does.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20" style={{ color: 'var(--accent-emerald)' }}>League-Aware</span>
            </div>
            <div className="space-y-1.5 mb-3">
              {[
                { rank: 1, name: 'Jaylen Wright', tag: 'Stash', score: 91, color: 'from-emerald-400 to-emerald-500' },
                { rank: 2, name: 'Jaxon Smith-Njigba', tag: 'Start', score: 87, color: 'from-cyan-400 to-cyan-500' },
                { rank: 3, name: 'Quentin Johnston', tag: 'Stash', score: 74, color: 'from-amber-400 to-amber-500' },
              ].map((p) => (
                <div key={p.rank} className="flex items-center gap-2 p-1.5 rounded-lg" style={{ background: 'rgba(16, 185, 129, 0.06)' }}>
                  <span className="text-[10px] font-bold w-4 text-center" style={{ color: 'var(--muted2)' }}>{p.rank}</span>
                  <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: p.tag === 'Start' ? 'rgba(34, 211, 238, 0.15)' : 'rgba(168, 85, 247, 0.15)', color: p.tag === 'Start' ? 'var(--accent-cyan)' : 'var(--accent-purple)' }}>{p.tag}</span>
                  <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <div className={`h-full bg-gradient-to-r ${p.color} rounded-full`} style={{ width: `${p.score}%` }} />
                  </div>
                  <span className="text-[10px] font-medium w-6 text-right" style={{ color: 'var(--accent-emerald)' }}>{p.score}</span>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>Scores every free agent using your roster needs, breakout age, athleticism, and dynasty ceiling.</p>
          </div>
        </div>

        {/* TRUST SIGNALS */}
        <div className="mt-10 sm:mt-16 md:mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              { icon: '🔐', label: 'No passwords required' },
              { icon: '⚡', label: 'Results in under 60 seconds' },
              { icon: '💡', label: 'Explains every verdict' },
              { icon: '🏆', label: 'Built for dynasty + redraft' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl transition-all" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <span className="text-lg sm:text-xl">{item.icon}</span>
                <span className="text-[11px] sm:text-xs text-center font-medium" style={{ color: 'var(--muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DIVIDER */}
        <div className="my-10 sm:my-16 md:my-20 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        {/* AF LEAGUE TRANSFER SECTION */}
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 sm:space-y-3 px-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))` }}>
              Bring Your League With You. No Reset Required.
            </h2>
            <p className="text-sm sm:text-base md:text-lg" style={{ color: 'var(--muted)' }}>
              Transfer your existing fantasy league into AllFantasy and let the AI take over — trades, rankings, lineups, and long-term insights included.
            </p>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>Supports full, guided, and manual transfers — depending on platform</p>
          </div>

          {/* Platform Support Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="text-sm font-bold" style={{ color: 'var(--accent-emerald)' }}>Full Transfer</span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">😴</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>Sleeper</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🏈</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>MyFantasyLeague (MFL)</span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>League, rosters, settings, and history imported automatically.</p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="text-sm font-bold" style={{ color: 'var(--accent-amber)' }}>Guided Transfer</span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">🟣</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>Yahoo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🔷</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>Fantrax</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🐝</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>Fleaflicker</span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>We import what's available and guide you through the rest.</p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-transparent p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-sm font-bold" style={{ color: 'var(--accent-red)' }}>Manual Import</span>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">📺</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>ESPN</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <span className="text-sm" style={{ color: 'var(--text)' }}>FFPC</span>
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>Upload or paste league data — we handle the conversion.</p>
            </div>
          </div>

          <p className="text-center text-xs" style={{ color: 'var(--muted2)' }}>
            🔒 Read-only. No passwords. Your original league stays untouched.
          </p>
        </div>

        {/* DIVIDER */}
        <div className="my-10 sm:my-16 md:my-20 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        {/* WHAT THE AI HELPS WITH */}
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center px-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent mb-2" style={{ backgroundImage: `linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))` }}>
              What the AI helps with
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--muted2)' }}>Three tools. One smarter fantasy experience.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
            {[
              { icon: '⚖️', title: 'Trade Coach', desc: 'Grades trades + explains why' },
              { icon: '🔍', title: 'Waiver Scout', desc: 'Finds pickups tailored to your roster' },
              { icon: '📊', title: 'Legacy Report', desc: 'Turns your history into a shareable score' },
            ].map((item, i) => (
              <div key={i} className="group p-4 sm:p-5 rounded-2xl hover:border-cyan-500/30 active:border-cyan-500/30 transition-all" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform">
                  <span className="text-xl sm:text-2xl">{item.icon}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold mb-1" style={{ color: 'var(--text)' }}>{item.title}</h3>
                <p className="text-xs sm:text-sm" style={{ color: 'var(--muted2)' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* DIVIDER */}
        <div className="my-10 sm:my-16 md:my-20 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        {/* AF LEGACY CTA */}
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center max-w-xl mx-auto px-1">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent mb-2 sm:mb-3" style={{ backgroundImage: `linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))` }}>
              See the AI work on real leagues
            </h2>
            <p className="text-sm sm:text-base" style={{ color: 'var(--muted2)' }}>Import your Sleeper leagues and watch the AI analyze trades, rosters, and dynasty trends instantly.</p>
          </div>

          <div className="flex flex-col items-center gap-4 px-2">
            <a
              href="/af-legacy"
              className="group inline-flex items-center justify-center gap-2.5 sm:gap-3 px-6 sm:px-10 py-4 sm:py-5 rounded-2xl text-base sm:text-lg font-bold text-white w-full sm:w-auto min-h-[52px]
                         bg-gradient-to-r from-cyan-500 via-purple-500 to-cyan-500 bg-[length:200%_100%] animate-gradient-x
                         shadow-[0_8px_40px_rgba(34,211,238,0.35),0_0_80px_rgba(168,85,247,0.15)]
                         hover:shadow-[0_12px_50px_rgba(34,211,238,0.5),0_0_100px_rgba(168,85,247,0.25)]
                         hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-cyan-400/30 transition-all duration-300"
            >
              <span className="text-xl sm:text-2xl">⚡</span>
              <span>Try AF Legacy Free</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>No signup required · Most users try this before joining early access</p>
          </div>
        </div>

        {/* DIVIDER */}
        <div className="my-10 sm:my-16 md:my-20 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        {/* BUILT BY PLAYERS */}
        <div className="text-center max-w-2xl mx-auto space-y-4 sm:space-y-5 px-1">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: 'var(--text)' }}>Built by players who actually play</h2>
          <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--muted2)' }}>
            AllFantasy isn't backed by a massive corporation or built to sell ads.
            It's built by competitive fantasy players who were tired of bad advice, shallow tools, and zero transparency.
          </p>
          <p className="text-xs sm:text-sm italic" style={{ color: 'var(--muted2)' }}>If you've ever said "this makes no sense," this is for you.</p>
        </div>

        {/* DIVIDER */}
        <div className="my-10 sm:my-16 md:my-20 h-px" style={{ background: 'linear-gradient(to right, transparent, var(--border), transparent)' }} />

        {/* FINAL CTA */}
        <div className="max-w-lg mx-auto text-center space-y-4 sm:space-y-5 px-1">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, var(--heading-from), var(--heading-via), var(--heading-to))` }}>
            Be there when AllFantasy launches
          </h2>
          <p className="text-sm sm:text-base" style={{ color: 'var(--muted2)' }}>Early access members get priority features, Pro trials, and early league tools.</p>

          <EarlyAccessForm variant="footer" />
        </div>

        {/* FOOTER */}
        <footer className="mt-10 sm:mt-16 pt-6 sm:pt-8 pb-12 sm:pb-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-center">
              <a href="/privacy" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center" style={{ color: 'var(--muted2)' }}>Privacy</a>
              <a href="/terms" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center" style={{ color: 'var(--muted2)' }}>Terms</a>
              <a href="/pricing" className="px-3 sm:px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] flex items-center" style={{ color: 'var(--muted2)' }}>Pricing</a>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>© {new Date().getFullYear()} AllFantasy — All rights reserved</p>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          animation: gradient-x 4s ease infinite;
        }
        .noise-overlay {
          opacity: 0.02;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
        }
      `}</style>

      <a href="/admin" className="fixed bottom-14 right-4 opacity-20 hover:opacity-60 transition-opacity z-50" title="Admin">
        <svg viewBox="0 0 100 120" className="w-8 h-10">
          <defs>
            <linearGradient id="adminShield" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M50 5 L95 20 L95 55 C95 85 50 115 50 115 C50 115 5 85 5 55 L5 20 Z" fill="none" stroke="url(#adminShield)" strokeWidth="4" />
          <text x="50" y="65" textAnchor="middle" fill="url(#adminShield)" fontSize="28" fontWeight="bold">AF</text>
        </svg>
      </a>

      <DeferredNewsCrawl />

      <div className="h-10" />
    </main>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
          <div style={{ color: 'var(--muted2)' }}>Loading...</div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
