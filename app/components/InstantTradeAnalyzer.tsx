'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { gtagEvent } from '@/lib/gtag'

const track = gtagEvent

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

export default function InstantTradeAnalyzer() {
  const [tradeText, setTradeText] = useState('')
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeResult, setTradeResult] = useState<InstantTradeResult | null>(null)
  const [tradeError, setTradeError] = useState('')
  const [leagueSize, setLeagueSize] = useState<number>(12)

  const runInstantTrade = async () => {
    if (!tradeText.trim()) return

    const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

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

  return (
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
  )
}
