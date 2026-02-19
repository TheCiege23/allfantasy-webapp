'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Shield, Zap, History, Users, ChevronDown, ChevronUp, RefreshCw, Trophy, TrendingUp, BarChart3 } from 'lucide-react'

type SleeperLeague = {
  league_id: string
  name: string
  total_rosters: number
  season: string
  status: string
  settings?: { type?: number }
  scoring_settings?: { rec?: number }
  roster_positions?: string[]
  avatar?: string | null
}

type TransferStep = 'connect' | 'select' | 'transferring' | 'complete'

type TransferredLeague = {
  id: string
  name: string
  totalTeams: number
  season: string
  isDynasty: boolean
  scoringType: string
  preview?: any
}

type PreviewData = {
  league: any
  managers: any[]
  stats: { totalSeasons: number; totalTrades: number; totalDraftPicks: number; previousSeasons: string[]; champions?: { season: string; champion: string }[] }
  storylines: { title: string; description: string; type: string }[]
}

type PreviewHistory = {
  seasons: string
  managers: number
  trades: string
  history: { year: string; champ: string; emoji: string }[]
}

export default function LeagueTransferClient({ userId }: { userId: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<TransferStep>('connect')
  const [sleeperUsername, setSleeperUsername] = useState('')
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [transferResults, setTransferResults] = useState<TransferredLeague[]>([])
  const [transferProgress, setTransferProgress] = useState(0)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewHistory, setPreviewHistory] = useState<PreviewHistory | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [currentTransferName, setCurrentTransferName] = useState('')

  const selectedLeague = selectedLeagues.size === 1 ? Array.from(selectedLeagues)[0] : null

  useEffect(() => {
    if (!selectedLeague) {
      setPreviewHistory(null)
      return
    }

    let cancelled = false
    const fetchPreview = async () => {
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/legacy/preview?sleeperLeagueId=${selectedLeague}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Preview failed')
        }
        const { preview } = await res.json()
        if (cancelled) return
        setPreviewHistory({
          seasons: preview?.seasonsCount ? String(preview.seasonsCount) : 'Unknown',
          managers: preview?.managersCount || 0,
          trades: preview?.tradesCount || 'N/A in preview',
          history: preview?.history?.map((h: any) => ({
            year: h.season,
            champ: h.champion || 'Unknown',
            emoji: h.emoji || '\uD83C\uDFC6',
          })) || [],
        })
      } catch (err: any) {
        if (!cancelled) {
          setPreviewHistory(null)
          setStatus(`Preview error: ${err.message}`)
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    fetchPreview()
    return () => { cancelled = true }
  }, [selectedLeague])

  async function fetchSleeperLeagues() {
    if (!sleeperUsername.trim()) {
      setError('Please enter your Sleeper username')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${sleeperUsername.trim()}`)
      if (!userRes.ok) throw new Error('Sleeper username not found')
      const userData = await userRes.json()
      if (!userData?.user_id) throw new Error('Invalid Sleeper user')

      const leaguesRes = await fetch(`https://api.sleeper.app/v1/user/${userData.user_id}/leagues/nfl/${new Date().getFullYear()}`)
      if (!leaguesRes.ok) throw new Error('Failed to fetch leagues')
      const leaguesData: SleeperLeague[] = await leaguesRes.json()

      if (!leaguesData?.length) {
        setError('No NFL leagues found for this username')
        setLoading(false)
        return
      }

      setLeagues(leaguesData)
      setStep('select')
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Sleeper')
    } finally {
      setLoading(false)
    }
  }

  function toggleLeague(id: string) {
    setSelectedLeagues(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selectedLeagues.size === leagues.length) {
      setSelectedLeagues(new Set())
    } else {
      setSelectedLeagues(new Set(leagues.map(l => l.league_id)))
    }
  }

  function getScoringLabel(league: SleeperLeague): string {
    const rec = league.scoring_settings?.rec || 0
    let label = 'Standard'
    if (rec === 1) label = 'PPR'
    else if (rec === 0.5) label = 'Half PPR'
    if (league.roster_positions?.includes('SUPER_FLEX')) label += ' SF'
    return label
  }

  function getLeagueType(league: SleeperLeague): string {
    return league.settings?.type === 2 ? 'Dynasty' : 'Redraft'
  }

  async function startTransfer() {
    if (selectedLeagues.size === 0) return

    setStep('transferring')
    setTransferProgress(0)
    setError(null)
    setStatus(null)

    const selected = leagues.filter(l => selectedLeagues.has(l.league_id))
    const results: TransferredLeague[] = []

    for (let i = 0; i < selected.length; i++) {
      const league = selected[i]
      setCurrentTransferName(league.name)
      try {
        const res = await fetch('/api/legacy/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sleeperLeagueId: league.league_id }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Server error (${res.status})`)
        }

        const data = await res.json()

        if (i === 0 && data.preview) {
          setPreviewData(data.preview)
        }

        results.push({
          id: data.leagueId || league.league_id,
          name: league.name,
          totalTeams: league.total_rosters,
          season: league.season,
          isDynasty: league.settings?.type === 2,
          scoringType: getScoringLabel(league),
          preview: data.preview,
        })

        if (selected.length === 1) {
          confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } })
          setStatus('Migration successful! Your legacy is now in AllFantasy')
          setTimeout(() => {
            router.push(`/leagues/${data.leagueId}?welcome=legacy`)
          }, 2500)
        }
      } catch (err: any) {
        let msg = 'Migration failed. Please try again.'
        if (err.message?.includes('already claimed')) {
          msg = 'This league has already been migrated by another user.'
        } else if (err.message?.includes('not found')) {
          msg = 'Sleeper league not found or inaccessible.'
        } else if (err.message?.includes('rate limit')) {
          msg = 'Sleeper API rate limit reached. Wait a minute and retry.'
        } else if (err.message) {
          msg = err.message
        }

        results.push({
          id: league.league_id,
          name: league.name + ' (failed)',
          totalTeams: league.total_rosters,
          season: league.season,
          isDynasty: false,
          scoringType: getScoringLabel(league),
        })
        setStatus(`Error: ${msg}`)
        console.error(`Transfer failed for ${league.name}:`, msg)
      }

      setTransferProgress(Math.round(((i + 1) / selected.length) * 100))
    }

    setTransferResults(results)
    setStep('complete')

    const failedCount = results.filter(r => r.name.includes('(failed)')).length
    if (selected.length > 1) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } })
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } })
      }, 500)
    }
    if (failedCount === 0) {
      setStatus(`Migration successful! ${results.length} league${results.length !== 1 ? 's' : ''} transferred`)
    } else if (failedCount < results.length) {
      setStatus(`Error: ${failedCount} of ${results.length} leagues failed to transfer`)
    }
  }

  const selectedLeagueData = leagues.find(l => selectedLeagues.has(l.league_id))

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-cyan-400" />}
            title="Encrypted Transfer"
            description="Your league data is encrypted end-to-end during migration"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <FeatureCard
            icon={<History className="w-6 h-6 text-purple-400" />}
            title="History Preserved"
            description="Trade history, standings, and records all come with you"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-yellow-400" />}
            title="Instant AI Setup"
            description="AI analysis begins the moment your league lands"
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8"
        >
          <StepIndicator currentStep={step} />

          <AnimatePresence mode="wait">
            {step === 'connect' && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8"
              >
                <h2 className="text-2xl font-bold mb-2">Connect Your Sleeper Account</h2>
                <p className="text-gray-400 mb-6">Enter your Sleeper username to find your leagues</p>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={sleeperUsername}
                    onChange={e => setSleeperUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchSleeperLeagues()}
                    placeholder="Your Sleeper username"
                    className="flex-1 px-4 py-3 bg-[#1a1238]/80 border border-cyan-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-400 backdrop-blur-sm"
                  />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={fetchSleeperLeagues}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    {loading ? 'Searching...' : 'Find Leagues'}
                  </motion.button>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Select Leagues to Transfer</h2>
                    <p className="text-gray-400">Found {leagues.length} league{leagues.length !== 1 ? 's' : ''} for @{sleeperUsername}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={selectAll} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                      {selectedLeagues.size === leagues.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <button
                      onClick={() => { setStep('connect'); setLeagues([]); setSelectedLeagues(new Set()) }}
                      className="text-sm text-gray-400 hover:text-gray-300 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Change User
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {leagues.map((league, idx) => {
                    const selected = selectedLeagues.has(league.league_id)
                    const expanded = expandedLeague === league.league_id
                    return (
                      <motion.div
                        key={league.league_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`rounded-xl border transition-all ${selected ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10 bg-white/5'}`}
                      >
                        <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => toggleLeague(league.league_id)}>
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${selected ? 'border-cyan-400 bg-cyan-500' : 'border-white/30'}`}>
                            {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate">{league.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getLeagueType(league) === 'Dynasty' ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                {getLeagueType(league)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {league.total_rosters} teams</span>
                              <span>{getScoringLabel(league)}</span>
                              <span>{league.season}</span>
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setExpandedLeague(expanded ? null : league.league_id) }}
                            className="text-gray-500 hover:text-gray-300"
                          >
                            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                        <AnimatePresence>
                          {expanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-0 border-t border-white/5">
                                <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                  <div><span className="text-gray-500">League ID:</span> <span className="text-gray-300">{league.league_id}</span></div>
                                  <div><span className="text-gray-500">Status:</span> <span className="text-gray-300 capitalize">{league.status}</span></div>
                                  <div><span className="text-gray-500">Scoring:</span> <span className="text-gray-300">{getScoringLabel(league)}</span></div>
                                  <div><span className="text-gray-500">Type:</span> <span className="text-gray-300">{getLeagueType(league)}</span></div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <p className="text-gray-400">{selectedLeagues.size} league{selectedLeagues.size !== 1 ? 's' : ''} selected</p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={startTransfer}
                    disabled={selectedLeagues.size === 0}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl font-bold text-lg shadow-2xl shadow-purple-500/30 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    Transfer {selectedLeagues.size > 0 ? `${selectedLeagues.size} League${selectedLeagues.size !== 1 ? 's' : ''}` : 'Leagues'}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === 'transferring' && (
              <motion.div
                key="transferring"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="inline-block"
                >
                  <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Transferring Your Leagues</h2>
                <p className="text-gray-400 mb-2">Syncing rosters, history, and settings...</p>
                {currentTransferName && (
                  <p className="text-cyan-400 text-sm mb-6">Migrating: {currentTransferName}</p>
                )}
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${transferProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">{transferProgress}% complete</p>
              </motion.div>
            )}

            {step === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mt-8"
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">Migration Complete!</h2>
                  <p className="text-gray-400">Your leagues are now on AllFantasy with AI analysis ready</p>
                </div>

                {status && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mt-6 text-center text-lg font-medium ${
                      status.includes('Error') ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {status}
                  </motion.p>
                )}

                <div className="space-y-3">
                  {transferResults.map((league, idx) => (
                    <motion.div
                      key={league.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-xl border ${league.name.includes('failed') ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'}`}
                    >
                      {league.name.includes('failed') ? (
                        <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <span className="font-semibold">{league.name.replace(' (failed)', '')}</span>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>{league.totalTeams} teams</span>
                          <span>{league.scoringType}</span>
                          <span>{league.isDynasty ? 'Dynasty' : 'Redraft'}</span>
                        </div>
                      </div>
                      {league.name.includes('failed') ? (
                        <span className="text-sm text-red-400">Failed</span>
                      ) : (
                        <button
                          onClick={() => router.push(`/leagues/${league.id}`)}
                          className="text-sm text-green-400 hover:text-green-300 transition-colors"
                        >
                          View League &rarr;
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 flex justify-center gap-4">
                  <motion.a
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    href="/af-legacy"
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-xl font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20"
                  >
                    Go to AF Legacy Hub
                  </motion.a>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setStep('connect'); setLeagues([]); setSelectedLeagues(new Set()); setTransferResults([]); setPreviewData(null); setPreviewHistory(null); setStatus(null) }}
                    className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/15 transition-colors"
                  >
                    Transfer More
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="relative flex justify-center"
        >
          <div className="w-80 sm:w-96 bg-black rounded-[3rem] p-3 border-8 border-gray-900 shadow-2xl shadow-purple-500/10 sticky top-8">
            <div className="bg-gradient-to-br from-[#0f0a24] to-[#1a1238] h-[640px] rounded-[2.5rem] overflow-hidden p-6 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl" />

              <div className="mt-8">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center text-xs font-bold">AF</div>
                  <span className="text-cyan-400 text-lg font-bold">AllFantasy</span>
                </div>

                {previewData ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 space-y-4"
                  >
                    <div className="text-white font-bold text-lg truncate">{previewData.league?.name || 'Your League'}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Legacy Import Preview</div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatBox icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />} label="Seasons" value={String(previewData.stats?.totalSeasons || 1)} />
                      <StatBox icon={<Users className="w-3.5 h-3.5 text-cyan-400" />} label="Managers" value={String(previewData.managers?.length || 0)} />
                      <StatBox icon={<TrendingUp className="w-3.5 h-3.5 text-green-400" />} label="Trades" value={String(previewData.stats?.totalTrades || 0)} />
                      <StatBox icon={<BarChart3 className="w-3.5 h-3.5 text-purple-400" />} label="Draft Picks" value={String(previewData.stats?.totalDraftPicks || 0)} />
                    </div>

                    {previewData.managers && previewData.managers.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Top Managers</div>
                        <div className="space-y-1.5">
                          {previewData.managers.slice(0, 4).map((m: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                              {m.avatar ? (
                                <img src={m.avatar} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-300">
                                  {(m.displayName || '?')[0]}
                                </div>
                              )}
                              <span className="text-sm text-white truncate flex-1">{m.displayName}</span>
                              <span className="text-xs text-gray-400">{m.wins}-{m.losses}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {previewData.storylines && previewData.storylines.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">AI Storylines</div>
                        <div className="space-y-2">
                          {previewData.storylines.slice(0, 2).map((s: any, i: number) => (
                            <div key={i} className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
                              <div className="text-xs font-bold text-purple-300">{s.title}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{s.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : selectedLeagueData ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 space-y-4"
                  >
                    <div className="text-white font-bold text-lg truncate">{selectedLeagueData.name}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Selected for Transfer</div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <StatBox icon={<Users className="w-3.5 h-3.5 text-cyan-400" />} label={previewHistory ? 'Managers' : 'Teams'} value={previewHistory ? String(previewHistory.managers) : String(selectedLeagueData.total_rosters)} />
                      <StatBox icon={<Trophy className="w-3.5 h-3.5 text-amber-400" />} label="Seasons" value={previewHistory ? previewHistory.seasons : selectedLeagueData.season} />
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="bg-white/5 rounded-lg px-3 py-2 flex justify-between">
                        <span className="text-xs text-gray-400">Type</span>
                        <span className={`text-xs font-semibold ${getLeagueType(selectedLeagueData) === 'Dynasty' ? 'text-purple-300' : 'text-gray-300'}`}>
                          {getLeagueType(selectedLeagueData)}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2 flex justify-between">
                        <span className="text-xs text-gray-400">Scoring</span>
                        <span className="text-xs font-semibold text-cyan-300">{getScoringLabel(selectedLeagueData)}</span>
                      </div>
                    </div>

                    {previewLoading && (
                      <div className="flex items-center justify-center gap-2 py-3">
                        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        <span className="text-xs text-gray-400">Loading history...</span>
                      </div>
                    )}

                    {previewHistory && previewHistory.history.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Championship History</div>
                        <div className="space-y-1.5">
                          {previewHistory.history.map((h, i) => (
                            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                              <span className="text-sm">{h.emoji}</span>
                              <span className="text-xs text-gray-400 w-10">{h.year}</span>
                              <span className="text-sm text-white truncate flex-1">{h.champ}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!previewLoading && (
                      <div className="mt-4 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-xl p-3 text-center">
                        <Zap className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <div className="text-xs text-gray-300">Ready to transfer with full history</div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="mt-8 flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                      <History className="w-10 h-10 text-purple-400" />
                    </div>
                    <p className="text-gray-400 text-sm">Select a league to see the import preview</p>
                    <p className="text-gray-500 text-xs mt-2">Your league data, managers, and history will appear here</p>
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <div className="w-32 h-1 bg-white/20 rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <div className="text-white font-bold text-sm">{value}</div>
      <div className="text-gray-400 text-[10px] uppercase">{label}</div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-colors h-full">
      <div className="mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}

function StepIndicator({ currentStep }: { currentStep: TransferStep }) {
  const steps: { key: TransferStep; label: string }[] = [
    { key: 'connect', label: 'Connect' },
    { key: 'select', label: 'Select' },
    { key: 'transferring', label: 'Transfer' },
    { key: 'complete', label: 'Done' },
  ]

  const currentIdx = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => {
        const isActive = i === currentIdx
        const isComplete = i < currentIdx
        return (
          <React.Fragment key={s.key}>
            {i > 0 && (
              <motion.div
                className={`w-12 h-0.5 ${isComplete ? 'bg-cyan-500' : 'bg-white/10'}`}
                animate={{ backgroundColor: isComplete ? '#06b6d4' : 'rgba(255,255,255,0.1)' }}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isComplete ? '#06b6d4' : isActive ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.1)',
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  isComplete ? 'text-white' : isActive ? 'text-cyan-400 ring-2 ring-cyan-500/50' : 'text-gray-500'
                }`}
              >
                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </motion.div>
              <span className={`text-xs ${isActive || isComplete ? 'text-cyan-400' : 'text-gray-500'}`}>{s.label}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
