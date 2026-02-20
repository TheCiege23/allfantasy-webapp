'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Play, RefreshCw, Download, RotateCcw, Users, Loader2, Link, ArrowUp, ArrowDown, X, TrendingUp, TrendingDown, Minus, Star, Handshake, Check } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface ADPPlayer {
  name: string
  position: string
  team: string | null
  adp: number
  adpTrend: number | null
  value: number | null
}

interface LeagueOption {
  id: string
  name: string
  platform: string
  leagueSize: number
  isDynasty: boolean
  scoring: string | null
}

interface BoardForecast {
  overall: number
  round: number
  pick: number
  manager: string
  topTargets: Array<{ player: string; position: string; probability: number; why: string }>
}

interface AdpMover {
  name: string
  adjustedAdp: number
  delta: number
  reasons: string[]
}

interface DraftPick {
  round: number
  pick: number
  overall: number
  playerName: string
  position: string
  team: string
  manager: string
  managerAvatar?: string
  confidence: number
  isUser: boolean
  value: number
  notes: string
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400 bg-red-500/15 border-red-500/30',
  RB: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
  WR: 'text-green-400 bg-green-500/15 border-green-500/30',
  TE: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  K: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  DEF: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
}

function DnaStat({ label, value, suffix, color, sub, hideBar }: { label: string; value: number; suffix: string; color: string; sub: string; hideBar?: boolean }) {
  const colorMap: Record<string, string> = {
    red: 'bg-red-500', amber: 'bg-amber-500', green: 'bg-green-500', purple: 'bg-purple-500',
    blue: 'bg-blue-500', cyan: 'bg-cyan-500', pink: 'bg-pink-500', slate: 'bg-slate-500', orange: 'bg-orange-500',
  }
  const textMap: Record<string, string> = {
    red: 'text-red-400', amber: 'text-amber-400', green: 'text-green-400', purple: 'text-purple-400',
    blue: 'text-blue-400', cyan: 'text-cyan-400', pink: 'text-pink-400', slate: 'text-slate-400', orange: 'text-orange-400',
  }
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2 space-y-1">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</div>
      {!hideBar && (
        <>
          <div className={`text-lg font-bold tabular-nums ${textMap[color] || 'text-gray-300'}`}>{value}{suffix}</div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colorMap[color] || 'bg-gray-500'}`} style={{ width: `${Math.min(100, value)}%` }} />
          </div>
        </>
      )}
      <div className="text-[10px] text-gray-400">{sub}</div>
    </div>
  )
}

function AggBar({ label, value, color }: { label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    red: 'bg-red-500/60', cyan: 'bg-cyan-500/60', green: 'bg-green-500/60', purple: 'bg-purple-500/60',
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-gray-500 w-7">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bgMap[color] || 'bg-gray-500/60'}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[9px] text-gray-400 w-6 text-right tabular-nums">{value}</span>
    </div>
  )
}

export default function MockDraftSimulatorClient({ leagues }: { leagues: LeagueOption[] }) {
  const { callAI, loading } = useAI<{ draftResults: DraftPick[]; updatedDraft?: DraftPick[] }>()
  const [selectedLeagueId, setSelectedLeagueId] = useState('')
  const [draftResults, setDraftResults] = useState<DraftPick[]>([])
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [customRounds, setCustomRounds] = useState(18)
  const [customScoring, setCustomScoring] = useState('default')
  const [onClockPick, setOnClockPick] = useState<number | null>(null)
  const [tradeResult, setTradeResult] = useState<any>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [adpData, setAdpData] = useState<ADPPlayer[]>([])
  const [bestAvailableTop, setBestAvailableTop] = useState<ADPPlayer[]>([])
  const [tradeProposals, setTradeProposals] = useState<Record<number, any>>({})
  const [dismissedProposals, setDismissedProposals] = useState<Set<number>>(new Set())
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [comparePlayer, setComparePlayer] = useState<any>(null)
  const [selectedFilter, setSelectedFilter] = useState('All')
  const [predictingBoard, setPredictingBoard] = useState(false)
  const [forecastOpen, setForecastOpen] = useState(false)
  const [boardForecasts, setBoardForecasts] = useState<BoardForecast[]>([])
  const [forecastMeta, setForecastMeta] = useState<{ simulations: number; rounds: number } | null>(null)
  const [forecastMovers, setForecastMovers] = useState<AdpMover[]>([])
  const [pickPathOpen, setPickPathOpen] = useState(false)
  const [pickPathLoading, setPickPathLoading] = useState(false)
  const [pickPathData, setPickPathData] = useState<any[]>([])
  const [pickPathTarget, setPickPathTarget] = useState('')
  const [dnaOpen, setDnaOpen] = useState(false)
  const [dnaLoading, setDnaLoading] = useState(false)
  const [dnaCards, setDnaCards] = useState<any[]>([])
  const [dnaExpandedIdx, setDnaExpandedIdx] = useState<number | null>(null)

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId)

  const normalizeName = useCallback((name: string) => {
    return name.toLowerCase().replace(/[.\-']/g, '').replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '').trim()
  }, [])

  const adpMap = useMemo(() => {
    const map = new Map<string, ADPPlayer>()
    for (const p of adpData) {
      map.set(normalizeName(p.name), p)
    }
    return map
  }, [adpData, normalizeName])

  const perRoundRosters = useMemo(() => {
    if (draftResults.length === 0) return {}
    const maxRound = Math.max(...draftResults.map(p => p.round))
    const managers = Array.from(new Set(draftResults.map(p => p.manager)))
    const result: Record<number, { manager: string; counts: Record<string, number>; isUser: boolean }[]> = {}
    for (let r = 1; r <= maxRound; r++) {
      result[r] = managers.map(mgr => {
        const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 }
        for (const p of draftResults) {
          if (p.round <= r && p.manager === mgr && counts[p.position] !== undefined) counts[p.position]++
        }
        return { manager: mgr, counts, isUser: draftResults.some(p => p.round <= r && p.manager === mgr && p.isUser) }
      })
    }
    return result
  }, [draftResults])

  const managerAvatars = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of draftResults) {
      if (p.manager && p.managerAvatar && !map[p.manager]) {
        map[p.manager] = p.managerAvatar
      }
    }
    return map
  }, [draftResults])

  const calculateTeamNeeds = useCallback((teamData: { manager: string; counts: Record<string, number> }, round: number) => {
    const roster = teamData.counts
    return {
      QB: round < 5 && (roster.QB || 0) < 2 ? 85 : 30,
      RB: (roster.RB || 0) < 4 ? 75 : 25,
      WR: (roster.WR || 0) < 5 ? 70 : 20,
      TE: (roster.TE || 0) < 2 ? 60 : 15,
    }
  }, [])

  const calculateTeamGrade = useCallback((manager: string, picks: DraftPick[]) => {
    const drafted = picks.filter(p => p.manager === manager)
    if (drafted.length === 0) return { letter: 'N/A', color: '#6b7280', title: 'No picks', strengths: [] as string[], weaknesses: [] as string[], valueAdded: '+$0' }

    const qbCount = drafted.filter(p => p.position === 'QB').length
    const rbCount = drafted.filter(p => p.position === 'RB').length
    const wrCount = drafted.filter(p => p.position === 'WR').length
    const teCount = drafted.filter(p => p.position === 'TE').length

    let score = 75
    let totalAdpDelta = 0
    let adpHits = 0

    if (qbCount >= 2) score += 15
    if (rbCount >= 4) score += 10
    if (wrCount >= 5) score += 8
    if (teCount >= 2) score += 5

    if (qbCount === 0) score -= 10
    if (rbCount < 3) score -= 8
    if (wrCount < 3) score -= 6
    if (teCount === 0) score -= 4

    for (const pick of drafted) {
      const adp = adpMap.get(normalizeName(pick.playerName))
      if (adp) {
        const delta = adp.adp - pick.overall
        totalAdpDelta += delta
        adpHits++
        if (delta > 10) score += 3
        if (delta < -10) score -= 3
      }
      score += Math.min((pick.value || 0) / 20, 5)
    }

    score = Math.max(40, Math.min(100, score))

    const strengths: string[] = []
    const weaknesses: string[] = []

    if (qbCount >= 2) strengths.push('Solid QB depth')
    if (rbCount >= 4) strengths.push('Deep RB room')
    if (wrCount >= 5) strengths.push('Loaded at WR')
    if (adpHits > 0 && totalAdpDelta / adpHits > 5) strengths.push('Strong value picks')
    if (teCount >= 2) strengths.push('TE advantage')

    if (rbCount < 3) weaknesses.push('Thin RB room')
    if (wrCount < 3) weaknesses.push('WR depth concern')
    if (qbCount === 0) weaknesses.push('No QB drafted')
    if (teCount === 0) weaknesses.push('No TE rostered')
    if (adpHits > 0 && totalAdpDelta / adpHits < -5) weaknesses.push('Too many reaches')

    let letter: string
    let color: string
    let title: string
    if (score >= 95) { letter = 'A+'; color = '#00ff88'; title = 'Elite Draft' }
    else if (score >= 90) { letter = 'A'; color = '#22c55e'; title = 'Excellent Draft' }
    else if (score >= 85) { letter = 'A-'; color = '#4ade80'; title = 'Great Draft' }
    else if (score >= 80) { letter = 'B+'; color = '#84cc16'; title = 'Strong Class' }
    else if (score >= 75) { letter = 'B'; color = '#eab308'; title = 'Above Average' }
    else if (score >= 70) { letter = 'B-'; color = '#f59e0b'; title = 'Solid Foundation' }
    else if (score >= 65) { letter = 'C+'; color = '#f97316'; title = 'Average Draft' }
    else if (score >= 55) { letter = 'C'; color = '#ef4444'; title = 'Below Average' }
    else { letter = 'D'; color = '#dc2626'; title = 'Needs Work' }

    const totalValue = drafted.reduce((sum, p) => sum + (p.value || 0), 0)
    const valueAdded = `+$${totalValue.toLocaleString()}`

    return { letter, color, title, strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3), valueAdded }
  }, [adpMap, normalizeName])

  const [bestAvailable, setBestAvailable] = useState<ADPPlayer[]>([])

  useEffect(() => {
    if (!adpData.length || draftResults.length === 0) return

    const drafted = new Set(draftResults.map(p => p.playerName))
    let remaining = adpData.filter(p => !drafted.has(p.name))

    if (selectedFilter !== 'All') {
      remaining = remaining.filter(p => p.position === selectedFilter)
    }

    setBestAvailable(remaining.slice(0, 15))
  }, [draftResults, adpData, selectedFilter])

  const openComparison = useCallback((pick: any) => {
    const bap = adpData.find(p => !draftResults.some(d => d.playerName === p.name))
    setComparePlayer({ drafted: pick, bap })
    setComparisonOpen(true)
  }, [draftResults, adpData])

  useEffect(() => {
    if (!selectedLeagueId || !selectedLeague) return
    const fetchADP = async () => {
      try {
        const type = selectedLeague.isDynasty ? 'dynasty' : 'redraft'
        const res = await fetch(`/api/mock-draft/adp?type=${type}&limit=300`)
        if (res.ok) {
          const data = await res.json()
          setAdpData(data.entries || [])
        }
      } catch (err) {
        console.error('[adp-fetch]', err)
      }
    }
    fetchADP()
  }, [selectedLeagueId, selectedLeague])

  useEffect(() => {
    if (adpData.length > 0 || draftResults.length === 0 || !selectedLeagueId) return
    const fetchADP = async () => {
      try {
        const res = await fetch(`/api/mock-draft/adp?type=redraft&limit=300`)
        if (res.ok) {
          const data = await res.json()
          setAdpData(data.entries || [])
        }
      } catch {}
    }
    fetchADP()
  }, [draftResults, adpData.length, selectedLeagueId])

  useEffect(() => {
    if (draftResults.length === 0 || adpData.length === 0) {
      setBestAvailableTop([])
      return
    }
    const draftedNames = new Set(draftResults.map(p => normalizeName(p.playerName)))
    const remaining = adpData.filter(p => !draftedNames.has(normalizeName(p.name))).slice(0, 3)
    setBestAvailableTop(remaining)
  }, [draftResults, adpData, normalizeName])

  const startMockDraft = async () => {
    if (!selectedLeagueId) return toast.error('Select a league first')
    setIsSimulating(true)
    setDraftResults([])
    const { data } = await callAI('/api/mock-draft/simulate', {
      leagueId: selectedLeagueId,
      rounds: customRounds,
      scoringTweak: customScoring,
      useLiveADP: true,
    })
    if (data?.draftResults) {
      setDraftResults(data.draftResults)
      setCurrentDraftId((data as any).draftId || null)

      const inlineProposals = (data as any).proposals || []
      if (inlineProposals.length > 0) {
        const proposalMap: Record<number, any> = {}
        for (const p of inlineProposals) {
          proposalMap[p.pickOverall] = p
        }
        setTradeProposals(proposalMap)
        setDismissedProposals(new Set())
        toast.success(`Mock draft complete! ${inlineProposals.length} trade offer${inlineProposals.length > 1 ? 's' : ''} from other managers.`)
      } else {
        setTradeProposals({})
        toast.success('Mock draft complete! AI drafted for all managers.')
      }
    }
    setIsSimulating(false)
  }

  const updateWeekly = async () => {
    if (!selectedLeagueId) return
    setIsSimulating(true)
    const { data } = await callAI('/api/mock-draft/update-weekly', {
      leagueId: selectedLeagueId,
    })
    if (data?.draftResults) {
      setDraftResults(data.draftResults)
      toast.success('Mock draft updated with latest injuries, news & performance data!')
    }
    setIsSimulating(false)
  }

  const predictDraftBoard = async () => {
    if (!selectedLeagueId) return toast.error('Select a league first')
    setPredictingBoard(true)
    try {
      const res = await fetch('/api/mock-draft/predict-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId, rounds: 2, simulations: 300 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to predict board')
      setBoardForecasts(data.forecasts || [])
      setForecastMeta({ simulations: data.simulations || 0, rounds: data.rounds || 2 })
      setForecastMovers(data.adpAdjustments || [])
      setForecastOpen(true)
      toast.success('Predicted draft board generated.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to predict board')
    } finally {
      setPredictingBoard(false)
    }
  }

  const generatePickPath = async () => {
    if (!selectedLeagueId) return toast.error('Select a league first')
    setPickPathLoading(true)
    try {
      const target = bestAvailableTop[0]?.name || ''
      const res = await fetch('/api/mock-draft/pick-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId, rounds: 3, simulations: 200, targetPlayer: target }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to generate pick path')
      setPickPathData(data.pickPaths || [])
      setPickPathTarget(data.targetPlayer || target)
      setPickPathOpen(true)
      toast.success('Pick Path generated with contingency strategies.')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate pick path')
    } finally {
      setPickPathLoading(false)
    }
  }

  const loadManagerDNA = async () => {
    if (!selectedLeagueId) return toast.error('Select a league first')
    setDnaLoading(true)
    try {
      const res = await fetch('/api/mock-draft/manager-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load Manager DNA')
      setDnaCards(data.dnaCards || [])
      setDnaExpandedIdx(null)
      setDnaOpen(true)
      toast.success(`Scouting report ready — ${(data.dnaCards || []).length} managers profiled.`)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Manager DNA')
    } finally {
      setDnaLoading(false)
    }
  }

  const exportImage = async () => {
    const element = document.getElementById('draft-board')
    if (!element) return
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0a0a0f' })
    const link = document.createElement('a')
    link.download = `AllFantasy-Mock-Draft-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast.success('Draft board saved as image!')
  }

  const exportPDF = async () => {
    const element = document.getElementById('draft-board')
    if (!element) return
    const canvas = await html2canvas(element, { scale: 2 })
    const pdf = new jsPDF('landscape')
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, 280, 190)
    pdf.save(`AllFantasy-Mock-Draft-${new Date().toISOString().slice(0, 10)}.pdf`)
    toast.success('Draft board saved as PDF!')
  }



  const simulateTrade = async (direction: 'up' | 'down', pickNumber: number) => {
    if (draftResults.length === 0 || !selectedLeagueId) return
    setIsTrading(true)
    setTradeResult(null)
    toast.info(`Simulating ${direction === 'up' ? 'trade up' : 'trade down'}...`)

    try {
      const { data } = await callAI('/api/mock-draft/trade-simulate', {
        leagueId: selectedLeagueId,
        currentPick: pickNumber,
        direction,
        rounds: customRounds,
      })

      if (data?.updatedDraft) {
        setDraftResults(data.updatedDraft)
        setOnClockPick(null)
        setTradeResult({
          direction,
          pickNumber,
          tradeDescription: (data as any).tradeDescription,
          tradedPicks: (data as any).tradedPicks,
        })
        toast.success(`${direction === 'up' ? 'Traded up' : 'Traded down'}! New picks reflected on the board.`)
      }
    } catch (err: any) {
      console.error('[trade-simulate]', err)
      toast.error(err.message || 'Failed to simulate trade')
    }
    setIsTrading(false)
  }


  const handleTradeAction = async (pickNumber: number, action: 'accept' | 'reject') => {
    const { data } = await callAI('/api/mock-draft/trade-action', {
      leagueId: selectedLeagueId,
      pickNumber,
      action,
    })

    if (data?.updatedDraft) {
      setDraftResults(data.updatedDraft)
      toast.success(action === 'accept' ? 'Trade accepted — board updated!' : 'Trade rejected — draft continues.')
    }
  }

  const copyShareLink = async () => {
    if (draftResults.length === 0 || !selectedLeagueId) return
    try {
      const res = await fetch('/api/mock-draft/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId, results: draftResults, draftId: currentDraftId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create share link')
      const url = `${window.location.origin}/mock-draft/share/${data.shareId}`
      await navigator.clipboard.writeText(url)
      toast.success('Shareable link copied to clipboard!')
    } catch (err: any) {
      console.error('[share]', err)
      toast.error(err.message || 'Failed to generate share link')
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-black/60 border border-purple-900/50 rounded-2xl p-6">
        <h3 className="text-lg font-medium mb-4">Customize Simulation</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Rounds</label>
            <Select value={customRounds.toString()} onValueChange={(v) => setCustomRounds(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[12, 15, 18, 20].map(r => <SelectItem key={r} value={r.toString()}>{r} Rounds</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Scoring Tweak</label>
            <Select value={customScoring} onValueChange={setCustomScoring}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="sf">Superflex</SelectItem>
                <SelectItem value="tep">TE Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <Button onClick={startMockDraft} disabled={isSimulating || loading || !selectedLeagueId} className="flex-1 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
              {isSimulating || loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simulating...</>
              ) : (
                <><Play className="mr-2 h-4 w-4" /> Run Mock Draft</>
              )}
            </Button>
            <Button onClick={predictDraftBoard} disabled={predictingBoard || !selectedLeagueId} variant="outline" className="h-10 border-cyan-700/40 text-cyan-300 hover:text-cyan-200">
              {predictingBoard ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Predicting</> : 'Predict Board'}
            </Button>
            <Button onClick={generatePickPath} disabled={pickPathLoading || !selectedLeagueId} variant="outline" className="h-10 border-purple-700/40 text-purple-300 hover:text-purple-200">
              {pickPathLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mapping</> : 'Pick Path'}
            </Button>
            <Button onClick={loadManagerDNA} disabled={dnaLoading || !selectedLeagueId} variant="outline" className="h-10 border-amber-700/40 text-amber-300 hover:text-amber-200">
              {dnaLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scouting</> : <><Users className="mr-2 h-4 w-4" /> Manager DNA</>}
            </Button>
          </div>
        </div>
      </div>

      {!selectedLeagueId && (
        <div className="bg-black/60 border border-cyan-900/50 rounded-2xl p-6">
          <label className="block text-sm text-gray-400 mb-2">Select League</label>
          <Select value={selectedLeagueId} onValueChange={setSelectedLeagueId}>
            <SelectTrigger className="bg-gray-950 border-cyan-800">
              <SelectValue placeholder="Choose your league" />
            </SelectTrigger>
            <SelectContent>
              {leagues.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.platform} &middot; {l.leagueSize}-team{l.isDynasty ? ' Dynasty' : ''})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(isSimulating || loading) && draftResults.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center gap-3 glass-card rounded-2xl px-8 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <div className="text-left">
              <p className="text-lg font-semibold text-white">AI is drafting...</p>
              <p className="text-sm text-gray-400">Analyzing live ADP, team needs &amp; real draft tendencies</p>
            </div>
          </div>
        </div>
      )}

      {draftResults.length > 0 && (
        <div id="draft-board" className="bg-black/80 border border-cyan-900/50 rounded-3xl p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">Live Mock Draft Board</h2>
              {Object.keys(tradeProposals).length > 0 && (
                <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1">
                  <Handshake className="h-3 w-3" /> {Object.keys(tradeProposals).length - dismissedProposals.size} offer{Object.keys(tradeProposals).length - dismissedProposals.size !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="flex gap-1.5 border border-gray-800 rounded-lg p-1">
                <Button onClick={exportImage} variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-white"><Download className="mr-1.5 h-3.5 w-3.5" /> Image</Button>
                <Button onClick={exportPDF} variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-white"><Download className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
                <Button onClick={copyShareLink} variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-white"><Link className="mr-1.5 h-3.5 w-3.5" /> Share</Button>
              </div>
              <Button onClick={updateWeekly} variant="outline" size="sm" className="h-7 text-xs" disabled={isSimulating || loading}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Update Weekly</Button>
              <Button onClick={() => { setDraftResults([]); setCurrentDraftId(null); setIsSimulating(false); setBestAvailableTop([]); setTradeProposals({}); setDismissedProposals(new Set()) }} variant="outline" size="sm" className="h-7 text-xs border-red-900/40 text-red-400 hover:text-red-300 hover:bg-red-950/30">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {bestAvailableTop.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-gradient-to-r from-purple-950/80 to-black/80 border border-purple-500/40 rounded-2xl p-6 mb-8"
              >
                <h3 className="text-lg font-bold text-purple-300 mb-4 flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  <span>Best Available Right Now</span>
                  <span className="text-xs bg-purple-600/50 px-3 py-1 rounded-full">Live</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {bestAvailableTop.map((player, i) => {
                    const posColor = player.position === 'QB' ? 'text-red-400' : player.position === 'RB' ? 'text-cyan-400' : player.position === 'WR' ? 'text-green-400' : 'text-purple-400'
                    return (
                      <div key={player.name} className={`flex items-center gap-4 bg-black/50 p-4 rounded-xl border ${i === 0 ? 'border-yellow-500/40 ring-1 ring-yellow-500/20' : 'border-gray-800/50'}`}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'}`}>
                          {i === 0 ? <Star className="h-6 w-6" /> : `#${i + 1}`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{player.name}</p>
                          <p className="text-sm text-gray-400">
                            <span className={posColor}>{player.position}</span>
                            {' '}&middot;{' '}{player.team || 'FA'}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-cyan-400">ADP: {player.adp?.toFixed(1) || 'N/A'}</span>
                            {player.value != null && (
                              <span className="text-xs text-emerald-400">Value: {player.value.toFixed(0)}</span>
                            )}
                            {player.adpTrend != null && player.adpTrend !== 0 && (
                              <span className={`text-[10px] flex items-center gap-0.5 ${player.adpTrend < 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {player.adpTrend < 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {player.adpTrend < 0 ? 'Rising' : 'Falling'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-12">
            {Array.from({ length: Math.max(...draftResults.map(p => p.round)) }).map((_, round) => {
              const roundPicks = draftResults.filter(p => p.round === round + 1)
              if (roundPicks.length === 0) return null
              return (
                <div key={round}>
                  <div className="text-cyan-400 text-sm font-mono mb-4 pl-4">ROUND {round + 1}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-4">
                    <AnimatePresence>
                      {roundPicks.map((pick, i) => (
                        <motion.div
                          key={pick.overall}
                          initial={{ opacity: 0, y: 30, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ delay: (round * 12 + i) * 0.35, type: 'spring', stiffness: 180 }}
                          className={`rounded-2xl p-5 group transition-all relative ${
                            onClockPick === pick.overall && pick.isUser
                              ? 'border-2 border-yellow-500/70 bg-gradient-to-br from-yellow-950/30 to-black animate-pulse'
                              : pick.isUser
                                ? 'bg-cyan-950/30 border-2 border-cyan-500/40 hover:border-cyan-400/60'
                                : 'bg-gray-950 border border-gray-800 hover:border-purple-500/60'
                          }`}
                          onClick={() => {
                            if (pick.isUser && !pick.playerName) {
                              setOnClockPick(onClockPick === pick.overall ? null : pick.overall)
                            } else if (pick.playerName) {
                              openComparison(pick)
                            }
                          }}
                        >
                          {onClockPick === pick.overall && pick.isUser && (
                            <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] px-2 py-0.5 rounded-full font-bold">
                              ON THE CLOCK
                            </div>
                          )}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-700">
                              <img
                                src={pick.managerAvatar || '/default-avatar.png'}
                                alt={pick.manager}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png' }}
                              />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{pick.manager}</div>
                              <div className="text-xs text-gray-500">Pick {pick.overall}</div>
                            </div>
                          </div>

                          <div className="font-bold text-lg mb-1 group-hover:text-purple-400 transition-colors">
                            {pick.playerName}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${POSITION_COLORS[pick.position] || ''} border text-[10px] px-1.5 py-0`}>
                              {pick.position}
                            </Badge>
                            <span className="text-sm text-gray-400">{pick.team}</span>
                          </div>

                          {(() => {
                            const adpInfo = adpMap.get(normalizeName(pick.playerName))
                            if (!adpInfo) return <div className="text-xs text-emerald-400">Confidence: {pick.confidence}%</div>
                            const diff = pick.overall - adpInfo.adp
                            const isSteal = diff > 3
                            const isReach = diff < -3
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">ADP {adpInfo.adp.toFixed(1)}</span>
                                  <span className={`font-bold flex items-center gap-0.5 ${
                                    isSteal ? 'text-emerald-400' : isReach ? 'text-orange-400' : 'text-gray-400'
                                  }`}>
                                    {isSteal ? <><TrendingUp className="h-3 w-3" /> STEAL</> :
                                     isReach ? <><TrendingDown className="h-3 w-3" /> REACH</> :
                                     <><Minus className="h-3 w-3" /> FAIR</>}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isSteal ? 'bg-emerald-500' : isReach ? 'bg-orange-500' : 'bg-gray-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(10, 50 + diff * 3))}%` }}
                                  />
                                </div>
                                {adpInfo.adpTrend != null && adpInfo.adpTrend !== 0 && (
                                  <div className={`text-[9px] ${adpInfo.adpTrend < 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                    {adpInfo.adpTrend < 0 ? 'Rising' : 'Falling'} in drafts
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {pick.notes && (
                            <p className="text-[10px] text-gray-600 mt-2 line-clamp-2">{pick.notes}</p>
                          )}

                          {onClockPick === pick.overall && pick.isUser && (
                            <div className="flex gap-2 mt-4 justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); simulateTrade('up', pick.overall) }}
                                disabled={isTrading}
                                className="border-green-500/50 text-green-400 hover:bg-green-950/40 text-xs"
                              >
                                {isTrading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ArrowUp className="mr-1 h-3 w-3" />}
                                Trade Up
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); simulateTrade('down', pick.overall) }}
                                disabled={isTrading}
                                className="border-red-500/50 text-red-400 hover:bg-red-950/40 text-xs"
                              >
                                {isTrading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ArrowDown className="mr-1 h-3 w-3" />}
                                Trade Down
                              </Button>
                            </div>
                          )}

                          {pick.isUser && tradeProposals[pick.overall] && !dismissedProposals.has(pick.overall) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 p-5 bg-gradient-to-br from-purple-950/70 to-black/70 border border-purple-500/50 rounded-xl overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="text-sm font-medium text-purple-300 mb-3">
                                Trade Proposal from {tradeProposals[pick.overall].fromTeam}
                              </div>
                              <div className="text-sm text-gray-300 mb-4">
                                They offer: <span className="font-medium text-green-300">{tradeProposals[pick.overall].theyGive}</span>
                                <br />
                                For your: <span className="font-medium text-red-300">{tradeProposals[pick.overall].youGive}</span>
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleTradeAction(pick.overall, 'reject')}
                                  disabled={isTrading}
                                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-950/40"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleTradeAction(pick.overall, 'accept')}
                                  disabled={isTrading}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  Accept Trade
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="mt-6">
                    {(() => {
                      const rNum = round + 1
                      const TARGETS: Record<string, number> = { QB: 1, RB: 4, WR: 4, TE: 1, K: 1, DEF: 1 }
                      const quickNeeds = perRoundRosters[rNum] || []
                      const userTeam = quickNeeds.find(t => t.isUser)

                      return (
                        <>
                          {userTeam && (
                            <div className="bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-4 mb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-cyan-400">Your Roster After Round {rNum}</span>
                                {(() => {
                                  const needs = calculateTeamNeeds(userTeam, rNum)
                                  const vals = Object.values(needs)
                                  const avgNeed = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
                                  const topPos = Object.entries(needs).sort(([,a], [,b]) => b - a)[0]
                                  if (avgNeed <= 0) return null
                                  return (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      avgNeed >= 70 ? 'bg-red-500/20 text-red-400' :
                                      avgNeed >= 45 ? 'bg-orange-500/20 text-orange-400' :
                                      'bg-emerald-500/20 text-emerald-400'
                                    }`}>
                                      Need: {avgNeed}/100{topPos ? ` (${topPos[0]})` : ''}
                                    </span>
                                  )
                                })()}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => {
                                  const count = userTeam.counts[pos]
                                  const target = TARGETS[pos]
                                  const pct = Math.min(100, (count / target) * 100)
                                  const posColor = pos === 'QB' ? 'bg-red-500' : pos === 'RB' ? 'bg-cyan-500' : pos === 'WR' ? 'bg-green-500' : 'bg-purple-500'
                                  return (
                                    <div key={pos} className="text-center">
                                      <div className="text-[10px] text-gray-500 mb-1">{pos}</div>
                                      <div className="text-lg font-bold">{count}<span className="text-gray-600 text-xs">/{target}</span></div>
                                      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
                                        <div className={`h-full rounded-full ${posColor} transition-all`} style={{ width: `${pct}%` }} />
                                      </div>
                                      {count < (pos === 'QB' || pos === 'TE' ? 1 : 2) && (
                                        <div className="text-[9px] text-orange-400 mt-0.5 font-bold">NEED</div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {quickNeeds.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 bg-black/60 border border-gray-800 rounded-2xl p-6 overflow-hidden"
                            >
                              <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                                Team Needs After Round {rNum}
                                <span className="text-xs bg-cyan-900/50 px-2 py-1 rounded-full">Updated</span>
                              </h4>

                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                {quickNeeds.map(team => {
                                  const needs = calculateTeamNeeds(team, rNum)
                                  return (
                                    <div key={team.manager} className={`p-4 rounded-xl ${team.isUser ? 'bg-cyan-950/30 border border-cyan-500/30' : 'bg-gray-950/50'}`}>
                                      <div className="flex items-center gap-3 mb-3">
                                        <img
                                          src={managerAvatars[team.manager] || '/default-avatar.png'}
                                          alt={team.manager}
                                          className="w-10 h-10 rounded-full border border-gray-700 object-cover"
                                          onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png' }}
                                        />
                                        <span className="font-medium truncate text-sm">{team.manager}{team.isUser ? ' (You)' : ''}</span>
                                      </div>

                                      <div className="space-y-2">
                                        {(['QB', 'RB', 'WR', 'TE'] as const).map(pos => (
                                          <div key={pos} className="flex items-center gap-2">
                                            <div className="w-8 text-xs font-mono text-gray-400">{pos}</div>
                                            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                                              <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{
                                                  width: `${needs[pos] || 0}%`,
                                                  background: (needs[pos] || 0) > 70 ? '#ef4444' : (needs[pos] || 0) > 40 ? '#f59e0b' : '#10b981',
                                                }}
                                              />
                                            </div>
                                            <div className="text-xs w-10 text-right">{needs[pos] || 0}%</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tradeResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/90 border border-yellow-500/40 rounded-2xl p-6 relative"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTradeResult(null)}
            className="absolute top-3 right-3 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            {tradeResult.direction === 'up' ? (
              <><ArrowUp className="h-5 w-5 text-green-400" /> Traded Up</>
            ) : (
              <><ArrowDown className="h-5 w-5 text-red-400" /> Traded Down</>
            )}
            <span className="text-xs text-gray-500 font-normal ml-2">from Pick #{tradeResult.pickNumber}</span>
          </h3>

          {tradeResult.tradeDescription && (
            <p className="text-sm text-gray-300 bg-gray-950 rounded-xl p-4 mb-4">{tradeResult.tradeDescription}</p>
          )}

          {tradeResult.tradedPicks && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-950/20 border border-green-500/20 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">Your New Pick</div>
                <div className="text-2xl font-bold text-green-400">#{tradeResult.tradedPicks.userNewPick}</div>
              </div>
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">Traded With</div>
                <div className="text-sm font-bold text-purple-400">{tradeResult.tradedPicks.partnerManager}</div>
                <div className="text-xs text-gray-600">gets Pick #{tradeResult.tradedPicks.partnerNewPick}</div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600 mt-3 text-center">The draft board above has been updated to reflect this trade.</p>
        </motion.div>
      )}

      {!isSimulating && !loading && draftResults.length === 0 && selectedLeagueId && (
        <div className="h-64 flex items-center justify-center border border-dashed border-gray-700 rounded-2xl text-gray-500 text-center px-4">
          <div>
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-700" />
            <p className="text-lg mb-1">Ready to draft</p>
            <p className="text-sm text-gray-600">AI will draft for all managers based on live ADP data and real tendencies</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {draftResults.length > 0 && draftResults.every(p => p.round <= customRounds) && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mt-16 bg-gradient-to-br from-purple-950/80 via-black/90 to-gray-950/80 border border-purple-500/40 rounded-3xl p-10 text-center shadow-2xl shadow-purple-950/50"
          >
            <h2 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-8">
              Draft Recap & Team Grades
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {Array.from(new Set(draftResults.map(p => p.manager))).map((manager) => {
                const grade = calculateTeamGrade(manager, draftResults)
                return (
                  <motion.div
                    key={manager}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.random() * 0.3 }}
                    className="bg-black/60 border border-cyan-900/40 p-6 rounded-2xl hover:border-cyan-500/60 transition-all group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <img
                        src={managerAvatars[manager] || '/default-team.png'}
                        className="w-16 h-16 rounded-full border-2 border-purple-500/30"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/default-team.png' }}
                      />
                      <div className="text-left">
                        <h3 className="text-xl font-bold">{manager}</h3>
                        <p className="text-sm text-gray-400">{draftResults.filter(p => p.manager === manager).length} picks</p>
                      </div>
                    </div>

                    <div className="text-5xl font-extrabold mb-2" style={{ color: grade.color }}>
                      {grade.letter}
                    </div>
                    <div className="text-sm text-gray-300 mb-4">{grade.title}</div>

                    <div className="space-y-2 text-left text-sm">
                      {grade.strengths.map((s, i) => (
                        <p key={`s-${i}`} className="text-green-300 flex items-center gap-2">
                          <span className="text-green-400">&#10004;</span> {s}
                        </p>
                      ))}
                      {grade.weaknesses.map((w, i) => (
                        <p key={`w-${i}`} className="text-red-300 flex items-center gap-2">
                          <span className="text-red-400">&#10008;</span> {w}
                        </p>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-400">
                      Total value added: <span className="text-cyan-400 font-medium">{grade.valueAdded}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-12 text-gray-300 max-w-3xl mx-auto">
              <p className="text-lg italic">
                &ldquo;This mock draft saw aggressive moves early &mdash; future contenders loaded up on youth while rebuilders stockpiled picks. The 2026 class looks deep at WR and RB.&rdquo;
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {draftResults.length > 0 && adpData.length > 0 && (
        <div className="fixed top-24 right-8 w-80 bg-black/80 border border-cyan-900/50 rounded-2xl p-6 shadow-2xl shadow-cyan-950/50 z-20 hidden lg:block">
          <h3 className="text-lg font-bold text-cyan-300 mb-4 flex items-center gap-2">
            Best Available
            <span className="text-xs bg-cyan-900/50 px-2 py-1 rounded-full">Live</span>
          </h3>

          <div className="flex gap-2 mb-4 flex-wrap">
            {['All', 'QB', 'RB', 'WR', 'TE'].map(pos => (
              <Button
                key={pos}
                variant={selectedFilter === pos ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(pos)}
                className="text-xs h-7 px-2.5"
              >
                {pos}
              </Button>
            ))}
          </div>

          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <AnimatePresence>
              {bestAvailable.map((player, i) => (
                <motion.div
                  key={player.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 bg-gray-950/50 p-3 rounded-xl hover:bg-gray-900/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{player.name}</p>
                    <p className="text-xs text-gray-400">{player.position} &middot; {player.team || 'FA'}</p>
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <div className="text-cyan-400">ADP {player.adp?.toFixed(1) || 'N/A'}</div>
                    {player.value && <div className="text-purple-400">Value ${player.value}</div>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {bestAvailable.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No players available</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={forecastOpen} onOpenChange={setForecastOpen}>
        <DialogContent className="max-w-4xl bg-black/95 border-cyan-900/40">
          <DialogHeader>
            <DialogTitle>AI Predicted Draft Board ({forecastMeta?.rounds || 2} rounds · {forecastMeta?.simulations || 0} sims)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">
            {forecastMovers.length > 0 && (
              <div className="rounded-xl border border-cyan-900/40 bg-cyan-500/5 p-3">
                <div className="text-xs font-semibold text-cyan-300 mb-2">Real-time ADP Movers (rookies/news/ESPN updates)</div>
                <div className="grid gap-1">
                  {forecastMovers.slice(0, 8).map((m) => (
                    <div key={m.name} className="text-xs text-gray-300 flex items-center justify-between gap-3">
                      <span className="truncate">{m.name} · {m.delta < 0 ? 'UP' : 'DOWN'} {Math.abs(m.delta)} ({m.reasons?.[0] || 'signal update'})</span>
                      <span className="text-cyan-300">ADP {m.adjustedAdp.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {boardForecasts.slice(0, 36).map((f) => (
              <div key={`${f.overall}-${f.manager}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-gray-400 mb-1">Round {f.round} · Pick {f.pick} (#{f.overall}) · {f.manager}</div>
                <div className="space-y-1.5">
                  {f.topTargets.length === 0 ? (
                    <div className="text-sm text-gray-500">No projection available</div>
                  ) : f.topTargets.map((t, idx) => (
                    <div key={`${t.player}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <span className="font-semibold text-white">{t.player}</span>
                        <span className="text-gray-400"> · {t.position}</span>
                        <div className="text-xs text-gray-500">{t.why}</div>
                      </div>
                      <div className="text-cyan-300 font-semibold tabular-nums">{t.probability}%</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickPathOpen} onOpenChange={setPickPathOpen}>
        <DialogContent className="max-w-4xl bg-black/95 border-purple-900/40">
          <DialogHeader>
            <DialogTitle>Pick Path — Contingency Tree{pickPathTarget ? ` (targeting ${pickPathTarget})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-1">
            {pickPathData.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No pick paths available</p>}
            {pickPathData.map((pp: any) => (
              <div key={pp.overall} className="rounded-xl border border-purple-900/30 bg-purple-500/5 p-4 space-y-3">
                <div className="text-sm font-semibold text-purple-300">Round {pp.round} · Pick {pp.pick} (#{pp.overall})</div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-cyan-300">Baseline Projection</div>
                  {pp.baseline?.map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span><span className="font-medium text-white">{t.player}</span> <span className="text-gray-400">· {t.position}</span></span>
                      <span className="text-cyan-400 tabular-nums">{t.probability}%</span>
                    </div>
                  ))}
                </div>

                {pp.playerGone && (
                  <div className="space-y-2 border-t border-white/10 pt-2">
                    <div className="text-xs font-semibold text-red-400">If {pp.playerGone.removedPlayer} is gone</div>
                    {pp.playerGone.fallbacks?.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span><span className="font-medium text-white">{t.player}</span> <span className="text-gray-400">· {t.position}</span></span>
                        <span className="text-amber-400 tabular-nums">{t.probability}%</span>
                      </div>
                    ))}
                    {(!pp.playerGone.fallbacks || pp.playerGone.fallbacks.length === 0) && (
                      <div className="text-xs text-gray-500">No fallback data</div>
                    )}
                  </div>
                )}

                <div className="space-y-2 border-t border-white/10 pt-2">
                  <div className="text-xs font-semibold text-green-400">If 2+ RBs run before your pick</div>
                  <div className="text-xs text-gray-400 italic">{pp.rbRun?.narrative}</div>
                  {pp.rbRun?.pivot?.map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span><span className="font-medium text-white">{t.player}</span> <span className="text-gray-400">· {t.position}</span></span>
                      <span className="text-green-400 tabular-nums">{t.probability}%</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 border-t border-white/10 pt-2">
                  <div className="text-xs font-semibold text-yellow-400">If QB run starts</div>
                  <div className="text-xs text-gray-400 italic">{pp.qbRun?.narrative}</div>
                  {pp.qbRun?.recommendation?.map((t: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span><span className="font-medium text-white">{t.player}</span> <span className="text-gray-400">· {t.position}</span></span>
                      <span className="text-yellow-400 tabular-nums">{t.probability}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dnaOpen} onOpenChange={setDnaOpen}>
        <DialogContent className="max-w-5xl bg-black/95 border-amber-900/40">
          <DialogHeader>
            <DialogTitle className="text-amber-300">Manager DNA — League Scouting Report</DialogTitle>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto space-y-3 pr-1">
            {dnaCards.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No DNA profiles available</p>}
            {dnaCards.map((dna: any, idx: number) => {
              const expanded = dnaExpandedIdx === idx
              const archetypeColors: Record<string, string> = {
                'The Gambler': 'text-red-400 bg-red-500/10',
                'The Calculator': 'text-cyan-400 bg-cyan-500/10',
                'Dynasty Architect': 'text-purple-400 bg-purple-500/10',
                'Win-Now Commander': 'text-green-400 bg-green-500/10',
                'Stack Strategist': 'text-amber-400 bg-amber-500/10',
                'Boom-or-Bust': 'text-orange-400 bg-orange-500/10',
                'Steady Operator': 'text-blue-400 bg-blue-500/10',
                'Youth Raider': 'text-pink-400 bg-pink-500/10',
                'Rebuilder': 'text-gray-400 bg-gray-500/10',
                'Balanced Drafter': 'text-slate-300 bg-slate-500/10',
              }
              const arcColor = archetypeColors[dna.overallArchetype] || 'text-gray-300 bg-gray-500/10'
              return (
                <div key={idx} className="rounded-xl border border-amber-900/25 bg-amber-500/[0.03] overflow-hidden">
                  <button
                    onClick={() => setDnaExpandedIdx(expanded ? null : idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 font-bold text-sm">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{dna.manager}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${arcColor}`}>{dna.overallArchetype}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>Reach: <span className={dna.reachFrequency > 0.5 ? 'text-red-400' : 'text-green-400'}>{dna.reachLabel}</span></span>
                      <span>Panic: <span className={dna.panicScore > 0.5 ? 'text-red-400' : 'text-green-400'}>{dna.panicResponse}</span></span>
                      <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-amber-900/20">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3">
                        <DnaStat label="Reach Frequency" value={Math.round(dna.reachFrequency * 100)} suffix="%" color={dna.reachFrequency > 0.6 ? 'red' : dna.reachFrequency > 0.35 ? 'amber' : 'green'} sub={dna.reachLabel} />
                        <DnaStat label="Rookie Appetite" value={Math.round(dna.rookieAppetite * 100)} suffix="%" color={dna.rookieAppetite > 0.6 ? 'purple' : dna.rookieAppetite > 0.35 ? 'blue' : 'slate'} sub={dna.rookieLabel} />
                        <DnaStat label="Stack Tendency" value={Math.round(dna.stackTendency * 100)} suffix="%" color={dna.stackTendency > 0.5 ? 'amber' : 'cyan'} sub={dna.stackLabel} />
                        <DnaStat label="Panic Response" value={Math.round(dna.panicScore * 100)} suffix="%" color={dna.panicScore > 0.6 ? 'red' : dna.panicScore > 0.35 ? 'amber' : 'green'} sub={dna.panicResponse} />
                        <DnaStat label="Archetype" value={0} suffix="" color="amber" sub={dna.overallArchetype} hideBar />
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-amber-300 mb-2">Positional Aggression by Round Phase</div>
                        <div className="grid grid-cols-4 gap-2">
                          {['QB', 'RB', 'WR', 'TE'].map(pos => {
                            const agg = dna.positionalAggression?.[pos]
                            if (!agg) return null
                            const posTextColors: Record<string, string> = { QB: 'text-red-400', RB: 'text-cyan-400', WR: 'text-green-400', TE: 'text-purple-400' }
                            const posBarColors: Record<string, string> = { QB: 'red', RB: 'cyan', WR: 'green', TE: 'purple' }
                            return (
                              <div key={pos} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                                <div className={`text-xs font-bold ${posTextColors[pos] || 'text-gray-400'} mb-1`}>{pos}</div>
                                <div className="space-y-1">
                                  <AggBar label="Early" value={agg.early} color={posBarColors[pos] || 'gray'} />
                                  <AggBar label="Mid" value={agg.mid} color={posBarColors[pos] || 'gray'} />
                                  <AggBar label="Late" value={agg.late} color={posBarColors[pos] || 'gray'} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-amber-300 mb-1">Draft Tendency Weights</div>
                        <div className="flex gap-3">
                          {Object.entries(dna.tendency || {}).map(([pos, val]: [string, any]) => (
                            <div key={pos} className="text-xs">
                              <span className="text-gray-400">{pos}:</span>{' '}
                              <span className={val > 1.1 ? 'text-green-400 font-semibold' : val < 0.85 ? 'text-red-400' : 'text-gray-300'}>
                                {(val as number).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <DialogContent className="bg-black/90 border-purple-900/50 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl text-center">Pick Comparison</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-8 mt-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-green-400 mb-4">Selected</h3>
              <img
                src={comparePlayer?.drafted?.imageUrl || '/default-headshot.png'}
                alt={comparePlayer?.drafted?.playerName}
                className="w-32 h-32 rounded-full mx-auto mb-4 border-2 border-green-500/30 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/default-headshot.png' }}
              />
              <p className="text-lg font-semibold">{comparePlayer?.drafted?.playerName}</p>
              <p className="text-sm text-gray-400">{comparePlayer?.drafted?.position} &middot; {comparePlayer?.drafted?.team}</p>
              <p className="text-sm mt-2">ADP: {(() => {
                const adp = adpMap.get(normalizeName(comparePlayer?.drafted?.playerName || ''))
                return adp ? adp.adp.toFixed(1) : 'N/A'
              })()}</p>
              <p className="text-xs text-gray-500 mt-1">Pick #{comparePlayer?.drafted?.overall}</p>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold text-yellow-400 mb-4">Best Available</h3>
              {comparePlayer?.bap ? (
                <>
                  <img
                    src={comparePlayer.bap.imageUrl || '/default-headshot.png'}
                    alt={comparePlayer.bap.name}
                    className="w-32 h-32 rounded-full mx-auto mb-4 border-2 border-yellow-500/30 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/default-headshot.png' }}
                  />
                  <p className="text-lg font-semibold">{comparePlayer.bap.name}</p>
                  <p className="text-sm text-gray-400">{comparePlayer.bap.position} &middot; {comparePlayer.bap.team || 'FA'}</p>
                  <p className="text-sm mt-2">ADP: {comparePlayer.bap.adp?.toFixed(1) || 'N/A'}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500 mt-8">No ADP data available</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
