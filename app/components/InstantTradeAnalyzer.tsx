'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Copy, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { gtagEvent } from '@/lib/gtag'
import ImproveTradeModal from './ImproveTradeModal'

const track = gtagEvent

type TradeResult = {
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

const QUICK_EXAMPLES = [
  { label: 'Jefferson → Bijan + 1st', text: 'I give: Justin Jefferson\nI get: Bijan Robinson + 2026 1st' },
  { label: 'Chase + 2nd → Lamb', text: "I give: Ja'Marr Chase + 2025 2nd\nI get: CeeDee Lamb" },
  { label: 'Superflex Special', text: 'I give: Josh Allen\nI get: C.J. Stroud + 2026 1st + 2026 2nd' },
  { label: 'Value Overpay', text: 'I give: A.J. Brown + 2025 3rd\nI get: Marvin Harrison Jr.' },
]

export default function InstantTradeAnalyzer() {
  const [tradeText, setTradeText] = useState('')
  const [leagueSize, setLeagueSize] = useState(12)
  const [scoring, setScoring] = useState<'ppr' | 'half' | 'standard' | 'superflex'>('ppr')
  const [isDynasty, setIsDynasty] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TradeResult | null>(null)
  const [error, setError] = useState('')
  const [showImproveModal, setShowImproveModal] = useState(false)
  const [userRosterContext, setUserRosterContext] = useState('')

  const runAnalysis = async (overrideText?: string) => {
    const text = overrideText || tradeText
    if (!text.trim()) return

    setLoading(true)
    setError('')
    setResult(null)

    const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    track('trade_analysis_started', { league_size: leagueSize, scoring, dynasty: isDynasty })

    const getCookie = (name: string) =>
      document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))?.[2]

    try {
      const res = await fetch('/api/instant/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeText: text,
          leagueSize,
          scoring,
          isDynasty,
          eventId,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
        track('trade_analysis_completed', {
          league_size: leagueSize,
          scoring,
          dynasty: isDynasty,
          verdict: data.verdict,
          confidence: data.confidence,
        })

        ;(window as any).fbq?.(
          'track',
          'ViewContent',
          { content_name: 'Trade Analysis', content_category: 'Fantasy Football' },
          { eventID: eventId }
        )
      } else {
        setError(data?.error || 'Analysis failed')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (result) track('early_access_cta_viewed')
  }, [result])

  const copyAnalysis = () => {
    if (!result) return
    const text = `${result.verdict}\n\n${result.bullets.join('\n')}\n\nLeague: ${leagueSize}-team ${isDynasty ? 'Dynasty' : 'Redraft'} ${scoring.toUpperCase()}`
    navigator.clipboard.writeText(text)
    toast.success('Analysis copied to clipboard')
  }

  const loadExample = (text: string) => {
    setTradeText(text)
    setTimeout(() => runAnalysis(text), 80)
  }

  return (
    <div className="relative rounded-3xl p-5 sm:p-6 shadow-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/30">
          ⚖️
        </div>
        <div>
          <div className="font-bold text-lg sm:text-xl tracking-tight" style={{ color: 'var(--text)' }}>Instant AI Trade Analyzer</div>
          <div className="text-[11px]" style={{ color: 'var(--muted2)' }}>Natural language · Zero login · Real projections</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_EXAMPLES.map((ex, i) => (
          <button
            key={i}
            onClick={() => loadExample(ex.text)}
            className="px-3 py-1.5 text-[11px] rounded-full transition-all active:scale-95"
            style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <textarea
        value={tradeText}
        onFocus={() => track('trade_input_focus')}
        onChange={(e) => setTradeText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            runAnalysis()
          }
        }}
        placeholder={'I give: A.J. Brown + 2025 2nd\nI get: CeeDee Lamb'}
        rows={3}
        className="w-full rounded-xl p-4 text-sm outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all resize-none mb-4"
        style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
      />

      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--muted2)' }}>League Size</div>
          <div className="flex gap-1 flex-wrap">
            {[8, 10, 12, 14, 16, 32].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setLeagueSize(n)
                  track('trade_refine_used', { league_size: n })
                }}
                className={`px-3 py-1.5 text-[11px] rounded-lg font-semibold transition-all min-h-[32px] ${
                  leagueSize === n ? 'bg-cyan-400 text-black' : ''
                }`}
                style={leagueSize !== n ? { background: 'var(--subtle-bg)', color: 'var(--muted)' } : undefined}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--muted2)' }}>Scoring</div>
          <select
            value={scoring}
            onChange={(e) => setScoring(e.target.value as any)}
            className="rounded-lg px-3 py-1.5 text-[11px] outline-none min-h-[32px]"
            style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="ppr">PPR</option>
            <option value="half">0.5 PPR</option>
            <option value="standard">Standard</option>
            <option value="superflex">Superflex</option>
          </select>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDynasty}
              onChange={(e) => setIsDynasty(e.target.checked)}
              className="w-4 h-4 accent-cyan-400"
            />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>Dynasty</span>
          </label>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[10px] font-medium mb-1.5" style={{ color: 'var(--muted2)' }}>Your roster (optional — makes AI suggestions specific to your team)</label>
        <textarea
          placeholder={'QB: Josh Allen, Patrick Mahomes\nRB: Bijan Robinson, Breece Hall, Rachaad White\nWR: Justin Jefferson, CeeDee Lamb...\nFAAB remaining: 87%'}
          value={userRosterContext}
          onChange={(e) => setUserRosterContext(e.target.value)}
          rows={3}
          className="w-full rounded-xl p-3 text-[11px] outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 transition-all resize-y"
          style={{ background: 'var(--panel2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        />
        <p className="text-[9px] mt-1" style={{ color: 'var(--muted2)' }}>Paste your roster or just key players + FAAB. More detail = better suggestions.</p>
      </div>

      <button
        onClick={() => runAnalysis()}
        disabled={loading || !tradeText.trim()}
        className="w-full rounded-xl py-3.5 font-bold text-sm text-black min-h-[48px]
                   bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                   shadow-[0_6px_24px_rgba(34,211,238,0.35)]
                   hover:shadow-[0_8px_32px_rgba(34,211,238,0.5)] hover:bg-right
                   active:scale-[0.985] disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center justify-center gap-3 transition-all duration-200"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            AI Engine Running...
          </>
        ) : (
          'Analyze Trade Now'
        )}
      </button>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 space-y-2.5"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
            ))}
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            <div
              className={`p-4 sm:p-5 rounded-xl border text-center ${
                result.lean === 'You'
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : result.lean === 'Even'
                    ? 'border-amber-500/30 bg-amber-500/10'
                    : 'border-red-500/30 bg-red-500/10'
              }`}
            >
              <div className="text-4xl mb-2">
                {result.lean === 'You' ? '🔥' : result.lean === 'Even' ? '⚖️' : '❌'}
              </div>
              <div className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                {result.verdict}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div
                  className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                    result.confidence === 'HIGH'
                      ? 'bg-emerald-500 text-black'
                      : result.confidence === 'MEDIUM'
                        ? 'bg-amber-500 text-black'
                        : 'bg-red-500 text-white'
                  }`}
                >
                  {result.confidence} CONFIDENCE
                </div>
              </div>
            </div>

            {result.values && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-red-500/5" style={{ border: '1px solid var(--border)' }}>
                  <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--accent-red)', opacity: 0.8 }}>YOU GIVE</div>
                  {result.values.youGive.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                      <span className="shrink-0 font-mono" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(result.values.youGiveTotal / (result.values.youGiveTotal + result.values.youGetTotal)) * 100}%` }}
                      className="h-full bg-red-500 rounded-full"
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="text-right font-bold text-xs mt-1" style={{ color: 'var(--accent-red)', opacity: 0.85 }}>
                    {result.values.youGiveTotal.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/5" style={{ border: '1px solid var(--border)' }}>
                  <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--accent-emerald)', opacity: 0.8 }}>YOU GET</div>
                  {result.values.youGet.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                      <span className="shrink-0 font-mono" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(result.values.youGetTotal / (result.values.youGiveTotal + result.values.youGetTotal)) * 100}%` }}
                      className="h-full bg-emerald-500 rounded-full"
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                  <div className="text-right font-bold text-xs mt-1" style={{ color: 'var(--accent-emerald)', opacity: 0.85 }}>
                    {result.values.youGetTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              {result.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-xs shrink-0" style={{ color: 'var(--accent-cyan-strong)' }}>•</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{b}</span>
                </div>
              ))}
            </div>

            {result.sensitivity && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0" style={{ color: 'var(--accent-purple)' }}>💡</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{result.sensitivity}</span>
                </div>
              </div>
            )}

            {result.detectedLeagueSize && (
              <p className="text-[11px]" style={{ color: 'var(--accent-cyan)' }}>
                League size detected from text: {result.detectedLeagueSize}-team
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    result.confidence === 'HIGH'
                      ? 'bg-emerald-400'
                      : result.confidence === 'MEDIUM'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                  }`}
                />
                <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>
                  {result.confidence} confidence
                </span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>
                {result.leagueSize || leagueSize}-team {scoring.toUpperCase()} {isDynasty ? 'dynasty' : 'redraft'}
              </span>
            </div>

            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button
                onClick={copyAnalysis}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.97]"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={() => {
                  setResult(null)
                  setTradeText('')
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.97]"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                Analyze Another
              </button>
            </div>

            <button
              onClick={() => {
                setShowImproveModal(true)
                track('improve_trade_opened')
              }}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                         bg-gradient-to-r from-cyan-500/15 to-purple-500/15
                         border border-cyan-400/30 hover:border-cyan-400/50
                         hover:from-cyan-500/25 hover:to-purple-500/25 transition-all active:scale-[0.985]"
              style={{ color: 'var(--text)' }}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Improve This Trade
            </button>

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
                Unlock Deep Analysis →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-center" style={{ color: 'var(--accent-red)' }}>{error}</p>
        </div>
      )}

      {!result && !loading && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--muted2)' }}>🔒</span>
            <span className="text-[11px]" style={{ color: 'var(--muted2)' }}>No login required · Free instant analysis</span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--muted2)' }}>
            Assumes {leagueSize}-team {scoring.toUpperCase()} {isDynasty ? 'dynasty' : 'redraft'}. Import your league for personalized results.
          </p>
        </div>
      )}

      <ImproveTradeModal
        isOpen={showImproveModal}
        onClose={() => setShowImproveModal(false)}
        originalTradeText={tradeText}
        leagueSize={leagueSize}
        scoring={scoring}
        isDynasty={isDynasty}
        currentResult={result}
        userRoster={userRosterContext}
      />
    </div>
  )
}
