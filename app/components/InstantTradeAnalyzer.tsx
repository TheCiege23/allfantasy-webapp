'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Copy, Sparkles, X, Search, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { gtagEvent } from '@/lib/gtag'
import ImproveTradeModal from './ImproveTradeModal'

const track = gtagEvent

type PlayerAsset = {
  name: string
  position: string
  team: string
  age: number
  value: number
  rank: number
  trend: number
}

type PickAsset = {
  label: string
  year: number
  round: number
}

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

const LEAGUE_SIZES = [8, 10, 12, 14, 16, 32]

const PICK_OPTIONS = [
  { label: '2025 1st', year: 2025, round: 1 },
  { label: '2025 2nd', year: 2025, round: 2 },
  { label: '2025 3rd', year: 2025, round: 3 },
  { label: '2026 1st', year: 2026, round: 1 },
  { label: '2026 2nd', year: 2026, round: 2 },
  { label: '2026 3rd', year: 2026, round: 3 },
  { label: '2027 1st', year: 2027, round: 1 },
  { label: '2027 2nd', year: 2027, round: 2 },
]

function PlayerSearch({ onSelect }: { onSelect: (p: PlayerAsset) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerAsset[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchPlayers = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/instant/player-search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
      setIsOpen(true)
    } catch { setResults([]) }
    setLoading(false)
  }, [])

  const handleChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchPlayers(val), 250)
  }

  const posColor = (pos: string) => {
    switch (pos) {
      case 'QB': return '#ef4444'
      case 'RB': return '#22d3ee'
      case 'WR': return '#a855f7'
      case 'TE': return '#f59e0b'
      default: return 'var(--muted2)'
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
        <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--muted2)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim().length >= 2) {
              e.preventDefault()
              if (results.length > 0) {
                onSelect(results[0])
              } else {
                onSelect({ name: query.trim(), position: '??', team: '', age: 0, value: 0, rank: 0, trend: 0 })
              }
              setQuery(''); setIsOpen(false); setResults([])
            }
          }}
          placeholder="Search players..."
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: 'var(--text)' }}
        />
        {loading && <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: 'var(--muted2)' }} />}
      </div>
      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            {results.map((p, i) => (
              <button
                key={i}
                onClick={() => { onSelect(p); setQuery(''); setIsOpen(false); setResults([]) }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-cyan-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: posColor(p.position) + '20', color: posColor(p.position) }}>{p.position}</span>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{p.name}</span>
                  <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>{p.team}</span>
                </div>
                <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--accent-cyan-strong)' }}>{p.value.toLocaleString()}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AssetCard({ asset, onRemove, type }: { asset: PlayerAsset | PickAsset; onRemove: () => void; type: 'player' | 'pick' }) {
  if (type === 'pick') {
    const pick = asset as PickAsset
    return (
      <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>PICK</span>
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{pick.label}</span>
        </div>
        <button onClick={onRemove} className="p-0.5 rounded hover:bg-red-500/20 transition-colors"><X className="w-3 h-3" style={{ color: 'var(--muted2)' }} /></button>
      </div>
    )
  }

  const player = asset as PlayerAsset
  const posColor = player.position === 'QB' ? '#ef4444' : player.position === 'RB' ? '#22d3ee' : player.position === 'WR' ? '#a855f7' : '#f59e0b'

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0" style={{ background: posColor + '20', color: posColor }}>{player.position}</span>
        <div className="min-w-0">
          <div className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{player.name}</div>
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--muted2)' }}>
            <span>{player.team}</span>
            <span>·</span>
            <span>{player.age?.toFixed(1)} y.o.</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <div className="text-xs font-bold font-mono" style={{ color: 'var(--accent-cyan-strong)' }}>{player.value.toLocaleString()}</div>
          <div className="flex items-center gap-0.5 justify-end">
            {player.trend > 0 ? <TrendingUp className="w-2.5 h-2.5 text-emerald-400" /> : player.trend < 0 ? <TrendingDown className="w-2.5 h-2.5 text-red-400" /> : <Minus className="w-2.5 h-2.5" style={{ color: 'var(--muted2)' }} />}
            <span className={`text-[9px] font-mono ${player.trend > 0 ? 'text-emerald-400' : player.trend < 0 ? 'text-red-400' : ''}`} style={player.trend === 0 ? { color: 'var(--muted2)' } : undefined}>
              {player.trend > 0 ? '+' : ''}{player.trend}
            </span>
          </div>
        </div>
        <button onClick={onRemove} className="p-0.5 rounded hover:bg-red-500/20 transition-colors"><X className="w-3 h-3" style={{ color: 'var(--muted2)' }} /></button>
      </div>
    </div>
  )
}

function PickSelector({ onSelect }: { onSelect: (pick: PickAsset) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-[10px] px-2 py-1 rounded-md transition-all hover:opacity-80"
        style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)' }}
      >
        + Pick
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 right-0 mt-1 rounded-lg shadow-xl overflow-hidden min-w-[120px]"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}
          >
            {PICK_OPTIONS.map((p, i) => (
              <button
                key={i}
                onClick={() => { onSelect(p); setIsOpen(false) }}
                className="w-full px-3 py-1.5 text-[11px] text-left hover:bg-cyan-500/10 transition-colors"
                style={{ color: 'var(--text)' }}
              >
                {p.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function InstantTradeAnalyzer() {
  const [teamAPlayers, setTeamAPlayers] = useState<PlayerAsset[]>([])
  const [teamAPicks, setTeamAPicks] = useState<PickAsset[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<PlayerAsset[]>([])
  const [teamBPicks, setTeamBPicks] = useState<PickAsset[]>([])
  const [leagueSize, setLeagueSize] = useState(12)
  const [scoring, setScoring] = useState<'ppr' | 'half' | 'standard' | 'superflex'>('ppr')
  const [isDynasty, setIsDynasty] = useState(true)
  const [tePremium, setTePremium] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TradeResult | null>(null)
  const [error, setError] = useState('')
  const [showImproveModal, setShowImproveModal] = useState(false)

  const teamATotal = teamAPlayers.reduce((s, p) => s + p.value, 0)
  const teamBTotal = teamBPlayers.reduce((s, p) => s + p.value, 0)
  const hasAssets = teamAPlayers.length + teamAPicks.length > 0 && teamBPlayers.length + teamBPicks.length > 0

  const buildTradeText = () => {
    const giveItems = [
      ...teamAPlayers.map(p => p.name),
      ...teamAPicks.map(p => p.label),
    ]
    const getItems = [
      ...teamBPlayers.map(p => p.name),
      ...teamBPicks.map(p => p.label),
    ]
    return `I give: ${giveItems.join(' + ')}\nI get: ${getItems.join(' + ')}`
  }

  const runAnalysis = async () => {
    if (!hasAssets) return

    setLoading(true)
    setError('')
    setResult(null)

    const tradeText = buildTradeText()
    const eventId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    track('trade_analysis_started', { league_size: leagueSize, scoring, dynasty: isDynasty, tePremium })

    const getCookie = (name: string) =>
      document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))?.[2]

    try {
      const res = await fetch('/api/instant/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeText,
          leagueSize,
          scoring,
          isDynasty,
          tePremium,
          eventId,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
        track('trade_analysis_completed', { league_size: leagueSize, scoring, dynasty: isDynasty, tePremium, verdict: data.verdict, confidence: data.confidence })
        ;(window as any).fbq?.('track', 'ViewContent', { content_name: 'Trade Analysis', content_category: 'Fantasy Football' }, { eventID: eventId })
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

  const tradeText = buildTradeText()

  const copyAnalysis = () => {
    if (!result) return
    const text = `${result.verdict}\n\n${result.bullets.join('\n')}\n\nLeague: ${leagueSize}-team ${isDynasty ? 'Dynasty' : 'Redraft'} ${scoring.toUpperCase()}${tePremium ? ' TEP' : ''}`
    navigator.clipboard.writeText(text)
    toast.success('Analysis copied to clipboard')
  }

  const clearAll = () => {
    setTeamAPlayers([]); setTeamAPicks([])
    setTeamBPlayers([]); setTeamBPicks([])
    setResult(null); setError('')
  }

  const loadQuickExample = () => {
    setTeamAPlayers([{ name: "Ja'Marr Chase", position: 'WR', team: 'CIN', age: 24.8, value: 9500, rank: 2, trend: 50 }])
    setTeamAPicks([{ label: '2025 2nd', year: 2025, round: 2 }])
    setTeamBPlayers([{ name: 'CeeDee Lamb', position: 'WR', team: 'DAL', age: 25.5, value: 8200, rank: 5, trend: -30 }])
    setTeamBPicks([])
  }

  return (
    <div className="relative rounded-3xl p-5 sm:p-6 shadow-2xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/30">
            ⚖️
          </div>
          <div>
            <div className="font-bold text-lg sm:text-xl tracking-tight" style={{ color: 'var(--text)' }}>AI Trade Calculator</div>
            <div className="text-[11px]" style={{ color: 'var(--muted2)' }}>Powered by AI + real-time values</div>
          </div>
        </div>
        {(teamAPlayers.length > 0 || teamBPlayers.length > 0) && (
          <button onClick={clearAll} className="text-[10px] px-2 py-1 rounded-md hover:opacity-80 transition-all" style={{ color: 'var(--muted2)', border: '1px solid var(--border)' }}>
            Clear All
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={loadQuickExample} className="px-3 py-1.5 text-[11px] rounded-full transition-all active:scale-95" style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
          Chase + 2nd → Lamb
        </button>
        <button
          onClick={() => {
            setTeamAPlayers([{ name: 'Justin Jefferson', position: 'WR', team: 'MIN', age: 25.3, value: 9800, rank: 1, trend: 20 }])
            setTeamAPicks([])
            setTeamBPlayers([{ name: 'Bijan Robinson', position: 'RB', team: 'ATL', age: 22.5, value: 8500, rank: 3, trend: 100 }])
            setTeamBPicks([{ label: '2026 1st', year: 2026, round: 1 }])
          }}
          className="px-3 py-1.5 text-[11px] rounded-full transition-all active:scale-95"
          style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          Jefferson → Bijan + 1st
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#ef4444' }}>Team 1 gives</div>
            <PickSelector onSelect={(p) => setTeamAPicks(prev => [...prev, p])} />
          </div>
          <PlayerSearch onSelect={(p) => setTeamAPlayers(prev => [...prev, p])} />
          <div className="space-y-1.5 min-h-[44px]">
            {teamAPlayers.map((p, i) => (
              <AssetCard key={`ap-${i}`} asset={p} type="player" onRemove={() => setTeamAPlayers(prev => prev.filter((_, j) => j !== i))} />
            ))}
            {teamAPicks.map((p, i) => (
              <AssetCard key={`apk-${i}`} asset={p} type="pick" onRemove={() => setTeamAPicks(prev => prev.filter((_, j) => j !== i))} />
            ))}
            {teamAPlayers.length === 0 && teamAPicks.length === 0 && (
              <div className="flex items-center justify-center h-[44px] rounded-lg text-[11px]" style={{ color: 'var(--muted2)', border: '1px dashed var(--border)' }}>
                Add players or picks
              </div>
            )}
          </div>
          {teamATotal > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-medium" style={{ color: 'var(--muted2)' }}>Total: </span>
              <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{teamATotal.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#22d3ee' }}>Team 2 gives</div>
            <PickSelector onSelect={(p) => setTeamBPicks(prev => [...prev, p])} />
          </div>
          <PlayerSearch onSelect={(p) => setTeamBPlayers(prev => [...prev, p])} />
          <div className="space-y-1.5 min-h-[44px]">
            {teamBPlayers.map((p, i) => (
              <AssetCard key={`bp-${i}`} asset={p} type="player" onRemove={() => setTeamBPlayers(prev => prev.filter((_, j) => j !== i))} />
            ))}
            {teamBPicks.map((p, i) => (
              <AssetCard key={`bpk-${i}`} asset={p} type="pick" onRemove={() => setTeamBPicks(prev => prev.filter((_, j) => j !== i))} />
            ))}
            {teamBPlayers.length === 0 && teamBPicks.length === 0 && (
              <div className="flex items-center justify-center h-[44px] rounded-lg text-[11px]" style={{ color: 'var(--muted2)', border: '1px dashed var(--border)' }}>
                Add players or picks
              </div>
            )}
          </div>
          {teamBTotal > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-medium" style={{ color: 'var(--muted2)' }}>Total: </span>
              <span className="text-xs font-bold font-mono" style={{ color: 'var(--text)' }}>{teamBTotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {teamATotal > 0 && teamBTotal > 0 && (
        <div className="mb-4">
          <div className="flex rounded-lg overflow-hidden h-2.5" style={{ background: 'var(--subtle-bg)' }}>
            <motion.div
              className="h-full rounded-l-lg"
              style={{ background: 'linear-gradient(to right, #ef4444, #f97316)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(teamATotal / (teamATotal + teamBTotal)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
            <motion.div
              className="h-full rounded-r-lg"
              style={{ background: 'linear-gradient(to right, #06b6d4, #22d3ee)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(teamBTotal / (teamATotal + teamBTotal)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono font-bold" style={{ color: '#ef4444' }}>{teamATotal.toLocaleString()}</span>
            <span className="text-[10px] font-mono" style={{ color: 'var(--muted2)' }}>
              {Math.abs(((teamATotal - teamBTotal) / Math.max(teamATotal, teamBTotal)) * 100).toFixed(1)}% diff
            </span>
            <span className="text-[10px] font-mono font-bold" style={{ color: '#22d3ee' }}>{teamBTotal.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--muted2)' }}>League Size</div>
          <div className="flex gap-1 flex-wrap">
            {LEAGUE_SIZES.map((n) => (
              <button
                key={n}
                onClick={() => { setLeagueSize(n); track('trade_refine_used', { league_size: n }) }}
                className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-all min-h-[28px] ${leagueSize === n ? 'bg-cyan-400 text-black' : ''}`}
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
            className="rounded-lg px-2.5 py-1 text-[11px] outline-none min-h-[28px]"
            style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="ppr">PPR</option>
            <option value="half">0.5 PPR</option>
            <option value="standard">Standard</option>
            <option value="superflex">Superflex</option>
          </select>
        </div>

        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isDynasty} onChange={(e) => setIsDynasty(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>Dynasty</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" title="Tight End Premium — boosts TE value in analysis">
            <input type="checkbox" checked={tePremium} onChange={(e) => setTePremium(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>TEP</span>
          </label>
        </div>
      </div>

      <button
        onClick={runAnalysis}
        disabled={loading || !hasAssets}
        className="w-full rounded-xl py-3.5 font-bold text-sm text-black min-h-[48px]
                   bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto]
                   shadow-[0_6px_24px_rgba(34,211,238,0.35)]
                   hover:shadow-[0_8px_32px_rgba(34,211,238,0.5)] hover:bg-right
                   active:scale-[0.985] disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center justify-center gap-3 transition-all duration-200"
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" />AI Analyzing Trade...</>
        ) : (
          <>⚡ Analyze Trade</>
        )}
      </button>

      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5 space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
            ))}
          </motion.div>
        )}

        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
            <div className={`p-4 sm:p-5 rounded-xl border text-center ${
              result.lean === 'You' ? 'border-emerald-500/30 bg-emerald-500/10' : result.lean === 'Even' ? 'border-amber-500/30 bg-amber-500/10' : 'border-red-500/30 bg-red-500/10'
            }`}>
              <div className="text-4xl mb-2">{result.lean === 'You' ? '🔥' : result.lean === 'Even' ? '⚖️' : '❌'}</div>
              <div className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>{result.verdict}</div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                  result.confidence === 'HIGH' ? 'bg-emerald-500 text-black' : result.confidence === 'MEDIUM' ? 'bg-amber-500 text-black' : 'bg-red-500 text-white'
                }`}>{result.confidence} CONFIDENCE</div>
              </div>
            </div>

            {result.values && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-red-500/5" style={{ border: '1px solid var(--border)' }}>
                  <div className="text-[10px] font-medium mb-2" style={{ color: '#ef4444', opacity: 0.8 }}>YOU GIVE</div>
                  {result.values.youGive.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                      <span className="shrink-0 font-mono" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(result.values.youGiveTotal / (result.values.youGiveTotal + result.values.youGetTotal)) * 100}%` }} className="h-full bg-red-500 rounded-full" transition={{ duration: 0.8 }} />
                  </div>
                  <div className="text-right font-bold text-xs mt-1" style={{ color: '#ef4444', opacity: 0.85 }}>{result.values.youGiveTotal.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/5" style={{ border: '1px solid var(--border)' }}>
                  <div className="text-[10px] font-medium mb-2" style={{ color: '#22d3ee', opacity: 0.8 }}>YOU GET</div>
                  {result.values.youGet.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-0.5">
                      <span className="truncate mr-1" style={{ color: 'var(--muted)' }}>{a.name}</span>
                      <span className="shrink-0 font-mono" style={{ color: 'var(--muted2)' }}>{a.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--subtle-bg)' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(result.values.youGetTotal / (result.values.youGiveTotal + result.values.youGetTotal)) * 100}%` }} className="h-full bg-cyan-400 rounded-full" transition={{ duration: 0.8 }} />
                  </div>
                  <div className="text-right font-bold text-xs mt-1" style={{ color: '#22d3ee', opacity: 0.85 }}>{result.values.youGetTotal.toLocaleString()}</div>
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
                  <span className="text-sm shrink-0" style={{ color: '#a855f7' }}>💡</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{result.sensitivity}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${result.confidence === 'HIGH' ? 'bg-emerald-400' : result.confidence === 'MEDIUM' ? 'bg-amber-400' : 'bg-red-400'}`} />
                <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>{result.confidence} confidence</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--muted2)' }}>{result.leagueSize || leagueSize}-team {scoring.toUpperCase()}{tePremium ? ' TEP' : ''} {isDynasty ? 'dynasty' : 'redraft'}</span>
            </div>

            <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
              <button onClick={copyAnalysis} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.97]" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button onClick={clearAll} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-[0.97]" style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}>
                New Trade
              </button>
            </div>

            <button
              onClick={() => { setShowImproveModal(true); track('improve_trade_opened') }}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                         bg-gradient-to-r from-cyan-500/15 to-purple-500/15
                         border border-cyan-400/30 hover:border-cyan-400/50
                         hover:from-cyan-500/25 hover:to-purple-500/25 transition-all active:scale-[0.985]"
              style={{ color: 'var(--text)' }}
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Improve This Trade
            </button>

            <Link
              href="/af-legacy"
              onClick={() => track('legacy_trade_cta_clicked')}
              className="block w-full p-4 rounded-xl transition-all group hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(34,211,238,0.15))', border: '1px solid rgba(168,85,247,0.3)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">🧠</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>Want deeper analysis?</span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
                    Try the <span className="font-semibold" style={{ color: '#a855f7' }}>AF Legacy Trade Analyzer</span> for roster context, league-specific grades, AI negotiation tools, and more.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 shrink-0 group-hover:translate-x-1 transition-transform" style={{ color: '#a855f7' }} />
              </div>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-center" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {!result && !loading && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--muted2)' }}>🔒</span>
            <span className="text-[11px]" style={{ color: 'var(--muted2)' }}>No login required · Free instant analysis</span>
          </div>
          <Link
            href="/af-legacy"
            onClick={() => track('legacy_trade_cta_clicked')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:opacity-80"
            style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}
          >
            <span className="text-xs">🧠</span>
            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
              Try <span className="font-semibold" style={{ color: '#a855f7' }}>AF Legacy</span> for in-depth trade analysis with roster context
            </span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-auto" style={{ color: '#a855f7' }} />
          </Link>
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
      />
    </div>
  )
}
