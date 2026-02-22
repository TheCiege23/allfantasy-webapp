'use client'

import { useState } from 'react'
import { ChevronDown, Brain, RefreshCw } from 'lucide-react'

interface PsychTrait {
  trait: string
  score: number
  description: string
}

interface PsychProfile {
  archetype: string
  emoji: string
  summary: string
  traits: PsychTrait[]
  tendencies: string[]
  blindSpot: string
  negotiationStyle: string
  riskProfile: 'LOW' | 'MEDIUM' | 'HIGH'
  decisionSpeed: 'IMPULSIVE' | 'DELIBERATE' | 'REACTIVE'
}

const riskColors: Record<string, string> = {
  LOW: 'bg-emerald-500/20 text-emerald-300',
  MEDIUM: 'bg-amber-500/20 text-amber-300',
  HIGH: 'bg-red-500/20 text-red-300',
}

const speedColors: Record<string, string> = {
  IMPULSIVE: 'bg-red-500/20 text-red-300',
  DELIBERATE: 'bg-cyan-500/20 text-cyan-300',
  REACTIVE: 'bg-amber-500/20 text-amber-300',
}

function TraitBar({ trait }: { trait: PsychTrait }) {
  const color = trait.score >= 70 ? 'from-emerald-500 to-emerald-400' :
    trait.score >= 40 ? 'from-cyan-500 to-cyan-400' :
    'from-amber-500 to-amber-400'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/60">{trait.trait}</span>
        <span className="text-[10px] font-bold text-white/80">{trait.score}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${trait.score}%` }}
        />
      </div>
      <p className="text-[9px] text-white/40 leading-snug">{trait.description}</p>
    </div>
  )
}

export default function ManagerPsychology({
  leagueId,
  rosterId,
  username,
  teamData,
}: {
  leagueId: string
  rosterId: number
  username?: string | null
  teamData: any
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [profile, setProfile] = useState<PsychProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    if (profile) {
      setIsOpen(!isOpen)
      return
    }
    setIsOpen(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rankings/manager-psychology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, rosterId, username, teamData }),
      })
      const data = await res.json()
      if (res.ok && data.archetype) {
        setProfile(data)
      } else if (res.status === 429) {
        setError('Too many requests — please wait a moment.')
      } else {
        setError(data?.error || 'Failed to generate profile')
      }
    } catch {
      setError('Failed to connect — please try again')
    } finally {
      setLoading(false)
    }
  }

  const regenerate = async () => {
    setProfile(null)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rankings/manager-psychology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, rosterId, username, teamData }),
      })
      const data = await res.json()
      if (res.ok && data.archetype) {
        setProfile(data)
      } else {
        setError(data?.error || 'Failed to regenerate profile')
      }
    } catch {
      setError('Failed to connect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border border-purple-500/20 rounded-xl overflow-hidden">
      <button
        onClick={fetchProfile}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-500/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-purple-400" />
          <span className="text-[11px] font-semibold text-purple-300">Manager Psychology</span>
          {profile && (
            <span className="text-[10px] text-white/50">
              {profile.emoji} {profile.archetype}
            </span>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-white/30 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-purple-500/10 pt-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6">
              <RefreshCw size={14} className="text-purple-400 animate-spin" />
              <span className="text-xs text-purple-300">Analyzing manager behavior...</span>
            </div>
          )}

          {error && !loading && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
              {error}
            </div>
          )}

          {profile && !loading && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center text-xl shrink-0">
                  {profile.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{profile.archetype}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${riskColors[profile.riskProfile] || riskColors.MEDIUM}`}>
                      {profile.riskProfile} RISK
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${speedColors[profile.decisionSpeed] || speedColors.DELIBERATE}`}>
                      {profile.decisionSpeed}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 leading-relaxed mt-1">{profile.summary}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.traits.map(t => (
                  <TraitBar key={t.trait} trait={t} />
                ))}
              </div>

              <div className="bg-white/[0.03] rounded-lg p-2.5">
                <div className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5">Key Tendencies</div>
                <div className="space-y-1">
                  {profile.tendencies.map((t, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-[10px] text-purple-400 mt-0.5">&#x2022;</span>
                      <span className="text-[10px] text-white/70 leading-relaxed">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-2.5">
                  <div className="text-[9px] text-amber-400/60 uppercase tracking-wider mb-1">Blind Spot</div>
                  <p className="text-[10px] text-amber-200/70 leading-relaxed">{profile.blindSpot}</p>
                </div>
                <div className="bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-2.5">
                  <div className="text-[9px] text-cyan-400/60 uppercase tracking-wider mb-1">Negotiation Style</div>
                  <p className="text-[10px] text-cyan-200/70 leading-relaxed">{profile.negotiationStyle}</p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={regenerate}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={10} />
                  Re-analyze
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
