'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle2, AlertCircle, Loader2, Shield, Zap, History, Users, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

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
}

export default function LeagueTransferClient({ userId }: { userId: string }) {
  const [step, setStep] = useState<TransferStep>('connect')
  const [sleeperUsername, setSleeperUsername] = useState('')
  const [leagues, setLeagues] = useState<SleeperLeague[]>([])
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferResults, setTransferResults] = useState<TransferredLeague[]>([])
  const [transferProgress, setTransferProgress] = useState(0)
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null)

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

    const selected = leagues.filter(l => selectedLeagues.has(l.league_id))
    const results: TransferredLeague[] = []

    for (let i = 0; i < selected.length; i++) {
      const league = selected[i]
      try {
        const res = await fetch('/api/league/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'sleeper',
            platformLeagueId: league.league_id,
          }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to sync ${league.name}`)
        }

        const data = await res.json()
        results.push({
          id: data.leagueId || league.league_id,
          name: league.name,
          totalTeams: league.total_rosters,
          season: league.season,
          isDynasty: league.settings?.type === 2,
          scoringType: getScoringLabel(league),
        })
      } catch (err: any) {
        results.push({
          id: league.league_id,
          name: league.name + ' (failed)',
          totalTeams: league.total_rosters,
          season: league.season,
          isDynasty: false,
          scoringType: getScoringLabel(league),
        })
      }

      setTransferProgress(Math.round(((i + 1) / selected.length) * 100))
    }

    setTransferResults(results)
    setStep('complete')
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <FeatureCard
          icon={<Shield className="w-6 h-6 text-cyan-400" />}
          title="Encrypted Transfer"
          description="Your league data is encrypted end-to-end during migration"
        />
        <FeatureCard
          icon={<History className="w-6 h-6 text-purple-400" />}
          title="History Preserved"
          description="Trade history, standings, and records all come with you"
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6 text-yellow-400" />}
          title="Instant AI Setup"
          description="AI analysis begins the moment your league lands"
        />
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8">
        <StepIndicator currentStep={step} />

        {step === 'connect' && (
          <div className="mt-8 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-2">Connect Your Sleeper Account</h2>
            <p className="text-gray-400 mb-6">Enter your Sleeper username to find your leagues</p>

            <div className="flex gap-3">
              <input
                type="text"
                value={sleeperUsername}
                onChange={e => setSleeperUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchSleeperLeagues()}
                placeholder="Your Sleeper username"
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              />
              <button
                onClick={fetchSleeperLeagues}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? 'Searching...' : 'Find Leagues'}
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {step === 'select' && (
          <div className="mt-8">
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

            <div className="space-y-3">
              {leagues.map(league => {
                const selected = selectedLeagues.has(league.league_id)
                const expanded = expandedLeague === league.league_id
                return (
                  <div key={league.league_id} className={`rounded-xl border transition-all ${selected ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/10 bg-white/5'}`}>
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
                    {expanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                          <div><span className="text-gray-500">League ID:</span> <span className="text-gray-300">{league.league_id}</span></div>
                          <div><span className="text-gray-500">Status:</span> <span className="text-gray-300 capitalize">{league.status}</span></div>
                          <div><span className="text-gray-500">Scoring:</span> <span className="text-gray-300">{getScoringLabel(league)}</span></div>
                          <div><span className="text-gray-500">Type:</span> <span className="text-gray-300">{getLeagueType(league)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="text-gray-400">{selectedLeagues.size} league{selectedLeagues.size !== 1 ? 's' : ''} selected</p>
              <button
                onClick={startTransfer}
                disabled={selectedLeagues.size === 0}
                className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Transfer {selectedLeagues.size > 0 ? `${selectedLeagues.size} League${selectedLeagues.size !== 1 ? 's' : ''}` : 'Leagues'}
              </button>
            </div>
          </div>
        )}

        {step === 'transferring' && (
          <div className="mt-8 max-w-lg mx-auto text-center">
            <Loader2 className="w-16 h-16 animate-spin text-cyan-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Transferring Your Leagues</h2>
            <p className="text-gray-400 mb-6">Syncing rosters, history, and settings...</p>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full transition-all duration-500"
                style={{ width: `${transferProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">{transferProgress}% complete</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="mt-8">
            <div className="text-center mb-8">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Transfer Complete!</h2>
              <p className="text-gray-400">Your leagues are now on AllFantasy with AI analysis ready</p>
            </div>

            <div className="space-y-3 max-w-2xl mx-auto">
              {transferResults.map(league => (
                <div key={league.id} className={`flex items-center gap-4 p-4 rounded-xl border ${league.name.includes('failed') ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
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
                    <span className="text-sm text-green-400">Synced</span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center gap-4">
              <a
                href="/af-legacy"
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                Go to AF Legacy Hub
              </a>
              <button
                onClick={() => { setStep('connect'); setLeagues([]); setSelectedLeagues(new Set()); setTransferResults([]) }}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl font-semibold hover:bg-white/15 transition-colors"
              >
                Transfer More
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6 hover:border-white/20 transition-colors">
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
              <div className={`w-12 h-0.5 ${isComplete ? 'bg-cyan-500' : 'bg-white/10'}`} />
            )}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                isComplete ? 'bg-cyan-500 text-white' : isActive ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-500/50' : 'bg-white/10 text-gray-500'
              }`}>
                {isComplete ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs ${isActive || isComplete ? 'text-cyan-400' : 'text-gray-500'}`}>{s.label}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
