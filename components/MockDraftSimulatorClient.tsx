'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, RefreshCw, Download, RotateCcw, Users, Loader2, Link, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useAI } from '@/hooks/useAI'
import { toast } from 'sonner'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

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

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId)

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
      toast.success('Mock draft complete! AI drafted for all managers.')
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
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">Live Mock Draft Board</h2>
            <div className="flex gap-3">
              <Button onClick={exportPDF} variant="outline"><Download className="mr-2 h-4 w-4" /> PDF</Button>
              <Button onClick={copyShareLink}><Link className="mr-2 h-4 w-4" /> Share</Button>
              <Button onClick={updateWeekly} variant="outline" disabled={isSimulating || loading}><RefreshCw className="mr-2 h-4 w-4" /> Update Weekly</Button>
              <Button onClick={() => { setDraftResults([]); setCurrentDraftId(null); setIsSimulating(false) }} variant="outline" className="border-gray-600">
                <RotateCcw className="mr-2 h-4 w-4" /> Reset
              </Button>
            </div>
          </div>

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
                          <div className="text-xs text-emerald-400">Confidence: {pick.confidence}%</div>
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
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {(() => {
                    const picksThrough = draftResults.filter(p => p.round <= round + 1)
                    const managers = Array.from(new Set(draftResults.map(p => p.manager)))
                    const teamNeeds = managers.map(mgr => {
                      const drafted: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 }
                      for (const p of picksThrough) {
                        if (p.manager === mgr && drafted[p.position] !== undefined) {
                          drafted[p.position]++
                        }
                      }
                      const needs: string[] = []
                      if (drafted.QB === 0) needs.push('QB')
                      if (drafted.RB < 2) needs.push('RB')
                      if (drafted.WR < 2) needs.push('WR')
                      if (drafted.TE === 0) needs.push('TE')
                      return { manager: mgr, drafted, needs, isUser: picksThrough.some(p => p.manager === mgr && p.isUser) }
                    })
                    const teamsWithNeeds = teamNeeds.filter(t => t.needs.length > 0)
                    if (teamsWithNeeds.length === 0) return null
                    return (
                      <div className="mt-6 bg-black/40 border border-gray-800 rounded-xl p-5">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Projected Team Needs After Round {round + 1}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {teamNeeds.slice(0, 12).map(t => (
                            <div key={t.manager} className={`p-3 rounded-lg ${t.isUser ? 'bg-cyan-950/30 border border-cyan-500/20' : 'bg-gray-950/50'}`}>
                              <div className="font-medium mb-1 truncate">{t.manager} {t.isUser ? '(You)' : ''}</div>
                              <div className="text-gray-400">
                                QB: {t.drafted.QB} · RB: {t.drafted.RB} · WR: {t.drafted.WR} · TE: {t.drafted.TE}
                              </div>
                              {t.needs.length > 0 && (
                                <div className="mt-1 flex gap-1 flex-wrap">
                                  {t.needs.map(n => (
                                    <span key={n} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${POSITION_COLORS[n] || 'text-gray-400 bg-gray-800'}`}>
                                      NEED {n}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
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
