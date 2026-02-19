'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

export default function MockDraftSimulatorClient({ leagues }: { leagues: LeagueOption[] }) {
  const { callAI, loading } = useAI<{ draftResults: DraftPick[] }>()
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

  const calculateTeamNeeds = useCallback((teamData: { manager: string; counts: Record<string, number> }) => {
    const NEED_TARGETS: Record<string, number> = { QB: 2, RB: 4, WR: 4, TE: 2 }
    const needs: Record<string, number> = {}
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const count = teamData.counts[pos] || 0
      const target = NEED_TARGETS[pos]
      const filled = Math.min(count / target, 1)
      needs[pos] = Math.round((1 - filled) * 100)
    }
    return needs
  }, [])

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

  const exportPDF = async () => {
    const element = document.getElementById('draft-board')
    if (!element) return
    const leagueName = selectedLeague?.name || 'Mock Draft'
    toast.info('Generating PDF...')
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0a0a0a',
        useCORS: true,
        logging: false,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`AllFantasy-Mock-Draft-${leagueName.replace(/\s+/g, '-')}.pdf`)
      toast.success('PDF exported!')
    } catch (err) {
      console.error('[pdf-export]', err)
      toast.error('Failed to generate PDF')
    }
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
        setRoundNeeds({})
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


  const handleAcceptTrade = async (pickNumber: number) => {
    setIsTrading(true)
    toast.info('Executing trade...')

    try {
      const { data } = await callAI('/api/mock-draft/trade-action', {
        leagueId: selectedLeagueId,
        pickNumber,
        action: 'accept',
      })

      if (data?.updatedDraft) {
        setDraftResults(data.updatedDraft)
        setCurrentDraftId((data as any).draftId || null)
        setOnClockPick(null)
        setRoundNeeds({})
        setTradeProposals({})
        setDismissedProposals(new Set())
        toast.success('Trade accepted! Board updated.')
      }
    } catch (err: any) {
      console.error('[accept-trade]', err)
      toast.error(err.message || 'Failed to execute trade')
    }
    setIsTrading(false)
  }

  const handleRejectTrade = async (pickNumber: number) => {
    try {
      const { data } = await callAI('/api/mock-draft/trade-action', {
        leagueId: selectedLeagueId,
        pickNumber,
        action: 'reject',
      })

      setTradeProposals(prev => {
        const updated = { ...prev }
        delete updated[pickNumber]
        return updated
      })
      setDismissedProposals(prev => new Set([...prev, pickNumber]))

      if (data?.updatedDraft) {
        setDraftResults(data.updatedDraft)
        toast.info('Trade rejected. Continuing normal draft.')
      }
    } catch (err: any) {
      console.error('[reject-trade]', err)
      setDismissedProposals(prev => new Set([...prev, pickNumber]))
      toast.info('Trade rejected. Continuing normal draft.')
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Live Mock Draft Board</h2>
            <div className="flex gap-3 flex-wrap">
              {Object.keys(tradeProposals).length > 0 && (
                <span className="flex items-center gap-1 text-xs text-purple-400">
                  <Handshake className="h-3 w-3" /> {Object.keys(tradeProposals).length - dismissedProposals.size} offer{Object.keys(tradeProposals).length - dismissedProposals.size !== 1 ? 's' : ''}
                </span>
              )}
              <Button onClick={exportPDF} variant="outline" size="sm"><Download className="mr-2 h-4 w-4" /> PDF</Button>
              <Button onClick={copyShareLink} size="sm"><Link className="mr-2 h-4 w-4" /> Share</Button>
              <Button onClick={updateWeekly} variant="outline" size="sm" disabled={isSimulating || loading}><RefreshCw className="mr-2 h-4 w-4" /> Update Weekly</Button>
              <Button onClick={() => { setDraftResults([]); setCurrentDraftId(null); setIsSimulating(false); setBestAvailableTop([]); setTradeProposals({}); setDismissedProposals(new Set()) }} variant="outline" size="sm" className="border-gray-600">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
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
                          onClick={() => pick.isUser && setOnClockPick(onClockPick === pick.overall ? null : pick.overall)}
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
                            <div className="mt-4 p-4 bg-gradient-to-br from-purple-950/60 to-black/60 border border-purple-500/40 rounded-xl" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2 mb-2">
                                <Handshake className="h-4 w-4 text-purple-400" />
                                <span className="text-sm font-medium text-purple-300">
                                  Trade from {tradeProposals[pick.overall].fromTeam}
                                </span>
                              </div>
                              <div className="text-xs text-gray-300 mb-2 space-y-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-emerald-400 font-medium">You get:</span>
                                  <span>{tradeProposals[pick.overall].theyGive}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-red-400 font-medium">You give:</span>
                                  <span>{tradeProposals[pick.overall].youGive}</span>
                                </div>
                              </div>
                              {tradeProposals[pick.overall].reason && (
                                <p className="text-[10px] text-gray-500 mb-3 italic">{tradeProposals[pick.overall].reason}</p>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectTrade(pick.overall)}
                                  disabled={isTrading}
                                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-950/40 text-xs h-8"
                                >
                                  <X className="mr-1 h-3 w-3" /> Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleAcceptTrade(pick.overall)}
                                  disabled={isTrading}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-xs h-8"
                                >
                                  {isTrading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />}
                                  Accept
                                </Button>
                              </div>
                            </div>
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
                                  const needs = calculateTeamNeeds(userTeam)
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
                                  const needs = calculateTeamNeeds(team)
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
    </div>
  )
}
