'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Play, RefreshCw, Download, Trophy, RotateCcw, Users, Loader2, Share2 } from 'lucide-react'
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
  const [rounds, setRounds] = useState(15)
  const [customRounds, setCustomRounds] = useState(18)
  const [customScoring, setCustomScoring] = useState('default')
  const [expandedRound, setExpandedRound] = useState<number | null>(null)

  const selectedLeague = leagues.find(l => l.id === selectedLeagueId)
  const totalRounds = draftResults.length > 0
    ? Math.max(...draftResults.map(p => p.round))
    : rounds

  const startMockDraft = async () => {
    if (!selectedLeagueId) return toast.error('Select a league first')

    setIsSimulating(true)
    setDraftResults([])
    const { data } = await callAI('/api/mock-draft/simulate', {
      leagueId: selectedLeagueId,
      rounds: customRounds,
      scoringTweak: customScoring,
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

  const userPicks = draftResults.filter(p => p.isUser)
  const positionCounts = userPicks.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const exportToPDF = async () => {
    const element = document.querySelector('.draft-board') as HTMLElement
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
      toast.success('PDF downloaded!')
    } catch (err) {
      console.error('[pdf-export]', err)
      toast.error('Failed to generate PDF')
    }
  }

  const generateShareLink = async () => {
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
      <div className="flex flex-col md:flex-row gap-4 items-end bg-black/60 border border-cyan-900/50 rounded-2xl p-6">
        <div className="flex-1 w-full">
          <label className="block text-sm text-gray-400 mb-2">League</label>
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

        <div className="w-full md:w-32">
          <label className="block text-sm text-gray-400 mb-2">Rounds</label>
          <Select value={String(rounds)} onValueChange={(v) => setRounds(Number(v))}>
            <SelectTrigger className="bg-gray-950 border-cyan-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 18, 20, 25].map(n => (
                <SelectItem key={n} value={String(n)}>{n} rounds</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={startMockDraft}
          disabled={isSimulating || loading || !selectedLeagueId}
          className="h-12 px-10 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 shrink-0"
        >
          {isSimulating || loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> AI Drafting...</>
          ) : (
            <><Play className="mr-2 h-5 w-5" /> Start Mock Draft</>
          )}
        </Button>

        {draftResults.length > 0 && (
          <>
            <Button onClick={updateWeekly} variant="outline" className="h-12 border-purple-500/50 shrink-0" disabled={isSimulating || loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Update Weekly
            </Button>
            <Button onClick={() => { setDraftResults([]); setCurrentDraftId(null); setIsSimulating(false) }} variant="outline" className="h-12 border-gray-600 shrink-0">
              <RotateCcw className="mr-2 h-4 w-4" /> Reset
            </Button>
          </>
        )}
      </div>

      {(isSimulating || loading) && draftResults.length === 0 && (
        <div className="text-center py-20">
          <div className="inline-flex items-center gap-3 glass-card rounded-2xl px-8 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <div className="text-left">
              <p className="text-lg font-semibold text-white">AI is drafting...</p>
              <p className="text-sm text-gray-400">Analyzing ADP, team needs &amp; real draft tendencies</p>
            </div>
          </div>
        </div>
      )}

      {draftResults.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-gray-400">Your picks:</span>
              <span className="font-bold text-white">{userPicks.length}</span>
            </div>
            {Object.entries(positionCounts).sort().map(([pos, count]) => (
              <Badge key={pos} className={`${POSITION_COLORS[pos] || ''} border px-3 py-1`}>
                {pos}: {count}
              </Badge>
            ))}
          </div>

          <div className="bg-black/60 border border-purple-900/50 rounded-2xl p-6">
            <h3 className="text-lg font-medium mb-4">Customize Simulation</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Rounds</label>
                <Select value={customRounds.toString()} onValueChange={v => setCustomRounds(Number(v))}>
                  <SelectTrigger className="bg-gray-950 border-purple-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 Rounds</SelectItem>
                    <SelectItem value="18">18 Rounds (Standard)</SelectItem>
                    <SelectItem value="20">20 Rounds (Deep)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Scoring Tweak</label>
                <Select value={customScoring} onValueChange={setCustomScoring}>
                  <SelectTrigger className="bg-gray-950 border-purple-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default League Settings</SelectItem>
                    <SelectItem value="sf">Superflex Boost</SelectItem>
                    <SelectItem value="tep">TE Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={startMockDraft}
                  disabled={isSimulating || loading}
                  className="w-full h-10 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                >
                  {isSimulating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Re-Simulating...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" /> Re-Run Mock Draft</>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="draft-board bg-black/80 border border-cyan-900/50 rounded-3xl p-4 sm:p-8">
            <h2 className="text-2xl font-bold mb-8 text-center bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              Mock Draft Board
            </h2>
            <div className="space-y-10">
              {Array.from({ length: totalRounds }).map((_, roundIdx) => {
                const roundPicks = draftResults.filter(p => p.round === roundIdx + 1)
                if (roundPicks.length === 0) return null
                const isExpanded = expandedRound === null || expandedRound === roundIdx + 1

                return (
                  <div key={roundIdx}>
                    <button
                      onClick={() => setExpandedRound(expandedRound === roundIdx + 1 ? null : roundIdx + 1)}
                      className="text-cyan-400 text-sm font-mono mb-3 pl-4 hover:text-cyan-300 transition-colors flex items-center gap-2"
                    >
                      ROUND {roundIdx + 1}
                      {roundIdx === 0 && (
                        <span className="text-xs bg-purple-600/50 px-2 py-1 rounded-full text-purple-200">First Round</span>
                      )}
                      <span className="text-xs text-gray-600">({roundPicks.length} picks)</span>
                    </button>
                    {isExpanded && (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <AnimatePresence>
                          {roundPicks.map((pick, i) => (
                            <motion.div
                              key={pick.overall}
                              initial={{ opacity: 0, y: 20, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              transition={{
                                duration: 0.5,
                                delay: i * 0.05,
                                type: 'spring',
                                stiffness: 200,
                                damping: 15,
                              }}
                              className={`rounded-xl p-3 sm:p-4 transition-all group relative overflow-hidden ${
                                pick.overall === 1
                                  ? 'border-2 border-yellow-500/70 bg-gradient-to-br from-yellow-950/50 to-black'
                                  : pick.isUser
                                    ? 'bg-cyan-950/30 border-2 border-cyan-500/40 hover:border-cyan-400/60'
                                    : 'bg-gray-950 border border-gray-800 hover:border-purple-500/50'
                              }`}
                            >
                              {pick.overall === 1 && (
                                <div className="absolute -top-0.5 -right-0.5 bg-yellow-500 text-black text-[9px] px-2 py-0.5 rounded-bl-xl font-bold tracking-wide">
                                  #1 PICK
                                </div>
                              )}
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-gray-500 font-mono">Pick {pick.overall}</span>
                                <Badge className={`${POSITION_COLORS[pick.position] || ''} border text-[9px] px-1.5 py-0`}>
                                  {pick.position}
                                </Badge>
                              </div>
                              <div className="font-bold text-sm sm:text-base text-white group-hover:text-purple-400 transition-colors truncate">
                                {pick.playerName}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{pick.position} &middot; {pick.team}</div>
                              <div className="mt-2 flex items-center gap-1.5 text-xs">
                                <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-700 shrink-0">
                                  <img
                                    src={pick.managerAvatar || '/default-avatar.png'}
                                    alt={pick.manager}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = '/default-avatar.png' }}
                                  />
                                </div>
                                <span className={`truncate ${pick.isUser ? 'text-cyan-400 font-semibold' : 'text-gray-600'}`}>
                                  {pick.manager}
                                </span>
                                {pick.confidence && (
                                  <span className={`font-mono shrink-0 ${
                                    pick.confidence >= 80 ? 'text-green-400' :
                                    pick.confidence >= 60 ? 'text-cyan-400' :
                                    'text-amber-400'
                                  }`}>
                                    &middot; {pick.confidence}%
                                  </span>
                                )}
                              </div>
                              {pick.notes && (
                                <p className="text-[9px] text-gray-600 mt-1 truncate">{pick.notes}</p>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-4 justify-center mt-8">
            <Button onClick={exportToPDF} variant="outline" className="gap-2 border-gray-700 hover:border-cyan-600">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
            <Button onClick={generateShareLink} className="gap-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700">
              <Share2 className="h-4 w-4" /> Share Link
            </Button>
          </div>
        </>
      )}

      {!isSimulating && !loading && draftResults.length === 0 && (
        <div className="h-64 flex items-center justify-center border border-dashed border-gray-700 rounded-2xl text-gray-500 text-center px-4">
          <div>
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-700" />
            <p className="text-lg mb-1">Select a league and start your mock draft</p>
            <p className="text-sm text-gray-600">AI will draft for all managers based on real tendencies and ADP data</p>
          </div>
        </div>
      )}
    </div>
  )
}
