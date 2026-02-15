'use client'

import React, { useMemo, useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ModeToggle } from '@/components/theme/ModeToggle'

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

const track = (event: string, params: Record<string, any> = {}) => {
  if (typeof window === 'undefined') return
  ;(window as any).gtag?.('event', event, {
    ...params,
    page_path: window.location.pathname,
  })
}

interface UTMParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
}

interface InstantTradeResult {
  verdict: string
  lean: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  bullets: string[]
  sensitivity?: string
  detectedLeagueSize?: number | null
  leagueSize?: number
  fairnessScore?: number
  values?: {
    youGive: { name: string; value: number; source: string }[]
    youGet: { name: string; value: number; source: string }[]
    youGiveTotal: number
    youGetTotal: number
    percentDiff: number
    fairnessScore?: number
  }
}

function HomeContent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tradeText, setTradeText] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeResult, setTradeResult] = useState<InstantTradeResult | null>(null)
  const [tradeError, setTradeError] = useState('')
  const [leagueSize, setLeagueSize] = useState<number>(12)
  const [utmParams, setUtmParams] = useState<UTMParams>({
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: null,
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setUtmParams({
      utm_source: searchParams.get('utm_source'),
      utm_medium: searchParams.get('utm_medium'),
      utm_campaign: searchParams.get('utm_campaign'),
      utm_content: searchParams.get('utm_content'),
      utm_term: searchParams.get('utm_term'),
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
    })
    fetch('/api/track-visitor', { method: 'POST' }).catch(() => {})
  }, [searchParams])

  const generateEventId = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

  const runInstantTrade = async () => {
    if (!tradeText.trim()) return

    const eventId = generateEventId()

    track('trade_analysis_started', { league_size: leagueSize })

    setTradeLoading(true)
    setTradeResult(null)
    setTradeError('')

    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
      return match ? match[2] : undefined
    }

    try {
      const res = await fetch('/api/instant/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeText,
          leagueSize,
          eventId,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setTradeResult(data)
        track('trade_analysis_completed', {
          league_size: leagueSize,
          verdict: data.verdict,
          confidence: data.confidence,
        })

        ;(window as any).fbq?.(
          'track',
          'ViewContent',
          {
            content_name: 'Trade Analysis',
            content_category: 'Fantasy Football',
          },
          { eventID: eventId }
        )
      } else {
        setTradeError(data?.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setTradeError('Network error. Please try again.')
    } finally {
      setTradeLoading(false)
    }
  }

  useEffect(() => {
    if (tradeResult) {
      track('early_access_cta_viewed')
    }
  }, [tradeResult])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const eventId = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
      
      const res = await fetch('/api/early-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          eventId,
          ...utmParams,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        return
      }

      (window as any).fbq?.("track", "CompleteRegistration", {}, { eventID: eventId });

      const getCookie = (name: string) => {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : undefined;
      };
      const fbp = getCookie('_fbp');
      const fbc = getCookie('_fbc');

      fetch("/api/meta/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          email,
          fbp,
          fbc,
          source_url: window.location.href
        }),
      }).catch((err) => console.warn('Meta CAPI call failed:', err));

      const encodedEmail = encodeURIComponent(email.trim())
      router.push(`/success?email=${encodedEmail}${data?.alreadyExists ? '&existing=true' : ''}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[200px]" />
        <div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[180px]" />
        <div className="absolute bottom-0 right-0 h-[600px] w-[600px] rounded-full bg-indigo-600/15 blur-[200px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5" />
      </div>

      <div className="pointer-events-none absolute inset-0 noise-overlay" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8 lg:px-12 py-6 sm:py-16 md:py-20">

        {/* Top bar with theme toggle */}
        <div className="flex justify-end mb-4 sm:mb-6">
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

        {/* HERO SECTION */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          
          {/* Left: Headline + CTA */}
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

            {/* CTA Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3 p-2 rounded-2xl backdrop-blur-xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 w-full rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 outline-none text-base focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all min-h-[48px]"
                  style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 font-bold text-base text-black min-h-[48px]
                             bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                             shadow-[0_8px_32px_rgba(34,211,238,0.4),0_0_0_1px_rgba(34,211,238,0.2)]
                             hover:shadow-[0_12px_40px_rgba(34,211,238,0.5),0_0_0_1px_rgba(34,211,238,0.3)]
                             hover:translate-y-[-2px] hover:bg-right
                             active:translate-y-0 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-cyan-400/30
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? 'Saving...' : 'Get AI Early Access'}
                </button>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-amber-500/15 border border-amber-400/30">
                  <span className="text-amber-400">🎁</span>
                  <span className="text-[11px] sm:text-xs font-medium" style={{ color: 'var(--badge-text-amber)' }}>Founding users get 10 days of AF Pro free</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--muted2)' }}>
                  {error ? <span className="text-red-400">{error}</span> : 'No spam · Cancel anytime'}
                </p>
              </div>
            </form>

            {/* Secondary CTA */}
            <Link 
              href="/af-legacy" 
              className="inline-flex items-center justify-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-3.5 rounded-xl text-sm sm:text-base font-semibold w-full sm:w-auto min-h-[48px]
                         bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20
                         border border-cyan-400/40 shadow-lg shadow-cyan-500/10
                         hover:from-cyan-500/30 hover:via-purple-500/30 hover:to-cyan-500/30
                         hover:border-cyan-400/60 hover:shadow-cyan-500/20
                         active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 transition-all duration-300 group"
              style={{ color: 'var(--text)' }}
            >
              <span style={{ color: 'var(--accent-cyan-strong)' }} className="text-lg">⚡</span>
              <span>See the AI in action with AF Legacy</span>
              <span className="group-hover:translate-x-1.5 transition-transform duration-300">→</span>
            </Link>
          </div>

          {/* Right: Interactive Instant Trade Analyzer */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/25 via-purple-500/20 to-transparent rounded-3xl blur-3xl scale-110" />

            <div className="relative rounded-2xl sm:rounded-3xl backdrop-blur-2xl p-4 sm:p-6 shadow-2xl shadow-black/40" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>

              <div className="flex items-center justify-between mb-4 sm:mb-5 pb-3 sm:pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <span className="text-base sm:text-lg">⚖️</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Instant Trade Check</div>
                    <div className="text-[11px]" style={{ color: 'var(--muted2)' }}>Paste your trade. Get a real verdict.</div>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 font-medium" style={{ color: 'var(--accent-cyan)' }}>Free</span>
              </div>

              <textarea
                value={tradeText}
                onFocus={() => track('trade_input_focus')}
                onChange={(e) => setTradeText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runInstantTrade(); } }}
                placeholder={'I give: A.J. Brown + 2025 2nd\nI get: CeeDee Lamb'}
                rows={3}
                className="w-full rounded-xl p-3 sm:p-4 text-base sm:text-sm outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all resize-none mb-3"
                style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />

              <button
                onClick={runInstantTrade}
                disabled={tradeLoading || !tradeText.trim()}
                className="w-full rounded-xl py-3.5 font-bold text-sm text-black min-h-[48px]
                           bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                           shadow-[0_6px_24px_rgba(34,211,238,0.35)]
                           hover:shadow-[0_8px_32px_rgba(34,211,238,0.5)] hover:bg-right
                           active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              >
                {tradeLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Analyzing...
                  </span>
                ) : 'Analyze Trade'}
              </button>

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {[8, 10, 12, 14, 16, 32].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setLeagueSize(size)
                      track('trade_refine_used', { league_size: size })
                    }}
                    className={`px-3.5 py-2 rounded-full text-xs font-semibold transition min-h-[36px] min-w-[64px]
                      ${leagueSize === size
                        ? 'bg-cyan-400 text-black'
                        : ''
                      }`}
                    style={leagueSize !== size ? { background: 'var(--subtle-bg)', color: 'var(--muted)' } : undefined}
                  >
                    {size}-team
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-2 text-center" style={{ color: 'var(--muted2)' }}>
                Tap to refine — no login required
              </p>

              {tradeError && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-300">{tradeError}</p>
                </div>
              )}

              {tradeResult && (
                <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`p-3 rounded-xl border ${
                    tradeResult.lean === 'You'
                      ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-400/5 border-emerald-500/25'
                      : tradeResult.lean === 'Even'
                        ? 'bg-gradient-to-r from-amber-500/15 to-amber-400/5 border-amber-500/25'
                        : 'bg-gradient-to-r from-red-500/15 to-red-400/5 border-red-500/25'
                  }`}>
                    <div className="text-[10px] uppercase tracking-widest font-semibold mb-1" style={{ color: 'var(--muted2)' }}>Verdict</div>
                    <div className="text-xl sm:text-2xl font-black" style={{
                      color: tradeResult.lean === 'You' ? 'var(--accent-emerald)' :
                      tradeResult.lean === 'Even' ? 'var(--accent-amber)' : 'var(--accent-red)'
                    }}>
                      {tradeResult.verdict}
                    </div>
                  </div>

                  {tradeResult.values && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-red-500/5" style={{ border: '1px solid var(--border)' }}>
                        <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--accent-red)', opacity: 0.8 }}>You Give</div>
                        {tradeResult.values.youGive.map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                            <span className="shrink-0" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 text-xs font-bold text-right" style={{ borderTop: '1px solid var(--border)', color: 'var(--accent-red)', opacity: 0.85 }}>
                          {tradeResult.values.youGiveTotal.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-500/5" style={{ border: '1px solid var(--border)' }}>
                        <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--accent-emerald)', opacity: 0.8 }}>You Get</div>
                        {tradeResult.values.youGet.map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                            <span className="shrink-0" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="mt-1 pt-1 text-xs font-bold text-right" style={{ borderTop: '1px solid var(--border)', color: 'var(--accent-emerald)', opacity: 0.85 }}>
                          {tradeResult.values.youGetTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {tradeResult.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 text-xs shrink-0" style={{ color: 'var(--accent-cyan-strong)' }}>•</span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{b}</span>
                      </div>
                    ))}
                  </div>

                  {tradeResult.sensitivity && (
                    <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-start gap-2">
                        <span className="text-sm shrink-0" style={{ color: 'var(--accent-purple)' }}>💡</span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{tradeResult.sensitivity}</span>
                      </div>
                    </div>
                  )}

                  {tradeResult.detectedLeagueSize && (
                    <p className="text-[11px]" style={{ color: 'var(--accent-cyan)' }}>
                      League size detected from text: {tradeResult.detectedLeagueSize}-team
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        tradeResult.confidence === 'HIGH' ? 'bg-emerald-400' :
                        tradeResult.confidence === 'MEDIUM' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>{tradeResult.confidence} confidence</span>
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>{tradeResult.leagueSize || leagueSize}-team PPR dynasty baseline</span>
                  </div>

                  <div className="pt-3 text-center space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--muted2)' }}>Want roster context, league-specific grades, and AI negotiation tools?</p>
                    <Link
                      href="/af-legacy"
                      onClick={() => track('early_access_cta_clicked')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                                 bg-gradient-to-r from-purple-500/20 to-cyan-500/20
                                 border border-purple-400/40 hover:border-purple-400/60
                                 hover:from-purple-500/30 hover:to-cyan-500/30 transition-all"
                      style={{ color: 'var(--text)' }}
                    >
                      <span>Unlock Deep Analysis</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              )}

              {!tradeResult && !tradeLoading && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted2)' }}>🔒</span>
                    <span className="text-[11px]" style={{ color: 'var(--muted2)' }}>No login required · Free instant analysis</span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>Assumes 12-team PPR dynasty. Import your league for personalized results.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2 SECONDARY AI PREVIEW CARDS */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          
          {/* AI Power Rankings Card */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/20 flex items-center justify-center">
                  <span className="text-base">🏆</span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Power Rankings</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>See where your team really stands.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20" style={{ color: 'var(--accent-amber)' }}>AI Generated</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
                <span className="text-sm font-bold" style={{ color: 'var(--accent-amber)' }}>Contender</span>
              </div>
              <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>#3 <span className="text-sm" style={{ color: 'var(--muted2)' }}>of 12</span></span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>Contender, Frisky, or Rebuilding — the AI ranks every team using your league context.</p>
          </div>

          {/* AI Lineup Insights Card */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-500/20 flex items-center justify-center">
                  <span className="text-base">📋</span>
                </div>
                <div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>AI Lineup Insights</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted2)' }}>Start the right players. Every week.</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20" style={{ color: 'var(--accent-emerald)' }}>AI Generated</span>
            </div>
            <div className="flex items-center gap-3 mb-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-medium" style={{ color: 'var(--accent-emerald-strong)' }}>Start:</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>James Conner</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                <div className="h-full w-4/5 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" />
              </div>
              <span className="text-xs" style={{ color: 'var(--accent-emerald-strong)' }}>82%</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>The AI breaks down matchups, projections, and risk to help you lock in lineups with confidence.</p>
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
            {/* Full Transfer */}
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

            {/* Guided Transfer */}
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

            {/* Manual Import */}
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

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 p-2 rounded-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 w-full rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 outline-none text-base focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all min-h-[48px]"
                style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto rounded-xl px-6 sm:px-8 py-3.5 sm:py-4 font-bold text-black min-h-[48px]
                           bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                           shadow-[0_8px_32px_rgba(34,211,238,0.4)]
                           hover:shadow-[0_12px_40px_rgba(34,211,238,0.5)] hover:translate-y-[-2px] hover:bg-right
                           active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-cyan-400/30
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? 'Saving...' : 'Get AI Early Access'}
              </button>
            </div>
          </form>
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
