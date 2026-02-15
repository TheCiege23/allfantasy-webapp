'use client'

import React, { useState } from 'react'
import Link from 'next/link'

interface PlayerInput {
  name: string
  position: string
  team: string
  age: string
}

interface PickInput {
  year: string
  round: string
  projected_range: 'early' | 'mid' | 'late' | 'unknown'
}

interface TeamInput {
  manager_name: string
  is_af_pro: boolean
  record_or_rank: string
  gives_players: PlayerInput[]
  gives_picks: PickInput[]
  gives_faab: number
}

interface TradeInsightLabel {
  id: string
  name: string
  emoji: string
  description: string
}

interface TradeInsights {
  fairnessScore: number
  fairnessMethod: 'lineup' | 'composite'
  netDeltaPct: number
  labels: TradeInsightLabel[]
  warnings: TradeInsightLabel[]
  veto: boolean
  vetoReason: string | null
  expertWarning: string | null
}

interface EvaluationResult {
  trade_id?: string
  evaluation?: {
    fairness_score_0_to_100?: number
    fairness_score?: number
    winner?: 'sender' | 'receiver' | 'even'
    summary?: string
    explanation?: string
    key_reasons?: string[]
    risk_flags?: string[]
    league_balance_impact?: string
  }
  teams?: {
    sender?: { archetype?: string; roster_strengths?: string[]; roster_weaknesses?: string[] }
    receiver?: { archetype?: string; roster_strengths?: string[]; roster_weaknesses?: string[] }
  }
  team_fit?: { sender_fit?: string; receiver_fit?: string }
  improvements?: {
    best_counter_offer?: { sender_gives_changes?: string[]; receiver_gives_changes?: string[]; why_this_is_better?: string }
    small_tweaks?: string[]
  }
  user_message?: { to_sender?: string; to_receiver?: string }
  dynasty_idp_outlook?: { sender?: string; receiver?: string }
  end_of_season_projection?: { sender?: string; receiver?: string }
  tradeInsights?: TradeInsights
}

const defaultPlayer: PlayerInput = { name: '', position: '', team: '', age: '' }
const defaultPick: PickInput = { year: '2025', round: '1', projected_range: 'mid' }

const defaultTeam: TeamInput = {
  manager_name: '',
  is_af_pro: false,
  record_or_rank: '',
  gives_players: [{ ...defaultPlayer }],
  gives_picks: [],
  gives_faab: 0,
}

export default function TradeEvaluator() {
  const [sender, setSender] = useState<TeamInput>({ ...defaultTeam, manager_name: 'Sender Team' })
  const [receiver, setReceiver] = useState<TeamInput>({ ...defaultTeam, manager_name: 'Receiver Team' })
  const [leagueFormat, setLeagueFormat] = useState<'dynasty' | 'keeper' | 'redraft'>('dynasty')
  const [sport, setSport] = useState('NFL')
  const [scoring, setScoring] = useState('PPR')
  const [qbFormat, setQbFormat] = useState<'1qb' | 'sf'>('sf')
  const [asOfDate, setAsOfDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<EvaluationResult | null>(null)

  const addPlayer = (team: 'sender' | 'receiver') => {
    if (team === 'sender') {
      setSender({ ...sender, gives_players: [...sender.gives_players, { ...defaultPlayer }] })
    } else {
      setReceiver({ ...receiver, gives_players: [...receiver.gives_players, { ...defaultPlayer }] })
    }
  }

  const removePlayer = (team: 'sender' | 'receiver', index: number) => {
    if (team === 'sender') {
      setSender({ ...sender, gives_players: sender.gives_players.filter((_, i) => i !== index) })
    } else {
      setReceiver({ ...receiver, gives_players: receiver.gives_players.filter((_, i) => i !== index) })
    }
  }

  const updatePlayer = (team: 'sender' | 'receiver', index: number, field: keyof PlayerInput, value: string) => {
    if (team === 'sender') {
      const players = [...sender.gives_players]
      players[index] = { ...players[index], [field]: value }
      setSender({ ...sender, gives_players: players })
    } else {
      const players = [...receiver.gives_players]
      players[index] = { ...players[index], [field]: value }
      setReceiver({ ...receiver, gives_players: players })
    }
  }

  const addPick = (team: 'sender' | 'receiver') => {
    if (team === 'sender') {
      setSender({ ...sender, gives_picks: [...sender.gives_picks, { ...defaultPick }] })
    } else {
      setReceiver({ ...receiver, gives_picks: [...receiver.gives_picks, { ...defaultPick }] })
    }
  }

  const removePick = (team: 'sender' | 'receiver', index: number) => {
    if (team === 'sender') {
      setSender({ ...sender, gives_picks: sender.gives_picks.filter((_, i) => i !== index) })
    } else {
      setReceiver({ ...receiver, gives_picks: receiver.gives_picks.filter((_, i) => i !== index) })
    }
  }

  const updatePick = (team: 'sender' | 'receiver', index: number, field: keyof PickInput, value: string) => {
    if (team === 'sender') {
      const picks = [...sender.gives_picks]
      picks[index] = { ...picks[index], [field]: value } as PickInput
      setSender({ ...sender, gives_picks: picks })
    } else {
      const picks = [...receiver.gives_picks]
      picks[index] = { ...picks[index], [field]: value } as PickInput
      setReceiver({ ...receiver, gives_picks: picks })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setResult(null)

    const formatPlayers = (players: PlayerInput[]) =>
      players.filter(p => p.name.trim()).map(p => ({
        name: p.name,
        position: p.position || undefined,
        team: p.team || undefined,
        age: p.age ? parseInt(p.age) : undefined,
      }))

    const formatPicks = (picks: PickInput[]) =>
      picks.map(p => ({
        year: parseInt(p.year),
        round: parseInt(p.round),
        projected_range: p.projected_range,
      }))

    try {
      const res = await fetch('/api/trade-evaluator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: `trade_${Date.now()}`,
          sender: {
            manager_name: sender.manager_name,
            is_af_pro: sender.is_af_pro,
            record_or_rank: sender.record_or_rank || undefined,
            gives_players: formatPlayers(sender.gives_players),
            gives_picks: formatPicks(sender.gives_picks),
            gives_faab: sender.gives_faab,
          },
          receiver: {
            manager_name: receiver.manager_name,
            is_af_pro: receiver.is_af_pro,
            record_or_rank: receiver.record_or_rank || undefined,
            gives_players: formatPlayers(receiver.gives_players),
            gives_picks: formatPicks(receiver.gives_picks),
            gives_faab: receiver.gives_faab,
          },
          league: {
            format: leagueFormat,
            sport,
            scoring_summary: scoring,
            qb_format: qbFormat,
          },
          asOfDate: asOfDate || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'Failed to evaluate trade')
        return
      }

      setResult({
        evaluation: data.evaluation,
        tradeInsights: data.tradeInsights
      })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getFairnessScore = (r: EvaluationResult): number => {
    return r.evaluation?.fairness_score_0_to_100 ?? r.evaluation?.fairness_score ?? 50
  }

  const getFairnessColor = (score: number) => {
    if (score >= 45 && score <= 55) return 'text-emerald-400'
    if (score >= 35 && score <= 65) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getWinnerLabel = (winner?: string) => {
    if (winner === 'sender') return sender.manager_name || 'Sender'
    if (winner === 'receiver') return receiver.manager_name || 'Receiver'
    return 'Even Trade'
  }

  const renderTeamForm = (team: TeamInput, setTeam: (t: TeamInput) => void, label: string, teamKey: 'sender' | 'receiver') => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 backdrop-blur">
      <h3 className="text-base sm:text-lg font-medium text-white/90 mb-3 sm:mb-4">{label}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Manager/Team Name</label>
          <input
            type="text"
            value={team.manager_name}
            onChange={(e) => setTeam({ ...team, manager_name: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
            placeholder="e.g., Dynasty Destroyers"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Record/Rank <span className="text-white/40">(optional)</span></label>
          <input
            type="text"
            value={team.record_or_rank}
            onChange={(e) => setTeam({ ...team, record_or_rank: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
            placeholder="e.g., 3rd place, 8-4"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white/60">Players Giving</label>
            <button
              type="button"
              onClick={() => addPlayer(teamKey)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Add Player
            </button>
          </div>
          {team.gives_players.map((player, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 mb-2">
              <input
                type="text"
                value={player.name}
                onChange={(e) => updatePlayer(teamKey, i, 'name', e.target.value)}
                className="col-span-2 sm:col-span-5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:py-2 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
                placeholder="Player name"
              />
              <input
                type="text"
                value={player.position}
                onChange={(e) => updatePlayer(teamKey, i, 'position', e.target.value)}
                className="col-span-1 sm:col-span-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:py-2 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
                placeholder="Pos"
              />
              <input
                type="text"
                value={player.team}
                onChange={(e) => updatePlayer(teamKey, i, 'team', e.target.value)}
                className="col-span-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
                placeholder="Team"
              />
              <input
                type="text"
                value={player.age}
                onChange={(e) => updatePlayer(teamKey, i, 'age', e.target.value)}
                className="col-span-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
                placeholder="Age"
              />
              <button
                type="button"
                onClick={() => removePlayer(teamKey, i)}
                className="col-span-1 text-red-400/60 hover:text-red-400 text-lg"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-white/60">Draft Picks Giving</label>
            <button
              type="button"
              onClick={() => addPick(teamKey)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Add Pick
            </button>
          </div>
          {team.gives_picks.map((pick, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 mb-2">
              <input
                type="text"
                value={pick.year}
                onChange={(e) => updatePick(teamKey, i, 'year', e.target.value)}
                className="col-span-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
                placeholder="Year"
              />
              <select
                value={pick.round}
                onChange={(e) => updatePick(teamKey, i, 'round', e.target.value)}
                className="col-span-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>Round {r}</option>)}
              </select>
              <select
                value={pick.projected_range}
                onChange={(e) => updatePick(teamKey, i, 'projected_range', e.target.value)}
                className="col-span-5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none"
              >
                <option value="early">Early</option>
                <option value="mid">Mid</option>
                <option value="late">Late</option>
                <option value="unknown">Unknown</option>
              </select>
              <button
                type="button"
                onClick={() => removePick(teamKey, i)}
                className="col-span-1 text-red-400/60 hover:text-red-400 text-lg"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">FAAB Giving</label>
          <input
            type="number"
            value={team.gives_faab}
            onChange={(e) => setTeam({ ...team, gives_faab: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white placeholder-white/40 focus:border-cyan-400/50 focus:outline-none"
            placeholder="$0"
            min={0}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={team.is_af_pro}
            onChange={(e) => setTeam({ ...team, is_af_pro: e.target.checked })}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-400"
          />
          <span className="text-sm text-white/70">AF Pro Member</span>
        </label>
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#05060a] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[160px]" />
        <div className="absolute top-52 -left-56 h-[520px] w-[520px] rounded-full bg-fuchsia-500/7 blur-[180px]" />
        <div className="absolute -bottom-64 right-0 h-[560px] w-[560px] rounded-full bg-indigo-500/9 blur-[190px]" />
      </div>

      <div className="pointer-events-none absolute inset-0 noise-overlay" />
      <div className="pointer-events-none absolute inset-0 scanline-overlay" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors mb-8">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-10">
          <div className="mx-auto w-fit rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-white/75 backdrop-blur mb-4">
            AI-Powered Analysis v2
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
            <span className="bg-gradient-to-b from-white via-white/85 to-white/55 bg-clip-text text-transparent">
              AF Trade Analyzer
            </span>
          </h1>
          <p className="mt-3 text-white/65 max-w-xl mx-auto">
            Get comprehensive AI analysis of your fantasy trade with sender/receiver breakdown.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            {renderTeamForm(sender, setSender, 'Sender (Proposing)', 'sender')}
            {renderTeamForm(receiver, setReceiver, 'Receiver (Responding)', 'receiver')}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
            <h3 className="text-lg font-medium text-white/90 mb-4">League Settings</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Format</label>
                <select
                  value={leagueFormat}
                  onChange={(e) => setLeagueFormat(e.target.value as 'dynasty' | 'keeper' | 'redraft')}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white focus:border-cyan-400/50 focus:outline-none"
                >
                  <option value="dynasty">Dynasty</option>
                  <option value="keeper">Keeper</option>
                  <option value="redraft">Redraft</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">QB Format</label>
                <select
                  value={qbFormat}
                  onChange={(e) => setQbFormat(e.target.value as '1qb' | 'sf')}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white focus:border-cyan-400/50 focus:outline-none"
                >
                  <option value="sf">Superflex (2QB)</option>
                  <option value="1qb">1QB</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Sport</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white focus:border-cyan-400/50 focus:outline-none"
                >
                  <option value="NFL">NFL</option>
                  <option value="NBA">NBA</option>
                  <option value="MLB">MLB</option>
                  <option value="NHL">NHL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Scoring</label>
                <select
                  value={scoring}
                  onChange={(e) => setScoring(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white focus:border-cyan-400/50 focus:outline-none"
                >
                  <option value="PPR">PPR</option>
                  <option value="Half PPR">Half PPR</option>
                  <option value="Standard">Standard</option>
                  <option value="TE Premium">TE Premium</option>
                  <option value="Superflex">Superflex</option>
                  <option value="Points">Points (NBA/NHL)</option>
                  <option value="Categories">Categories (NBA)</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-sm text-white/60 mb-1.5">
                  As Of Date <span className="text-white/40">(optional - for historical analysis)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    min="2020-04-01"
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-white focus:border-cyan-400/50 focus:outline-none [color-scheme:dark]"
                    placeholder="Leave empty for today's values"
                  />
                  {asOfDate && (
                    <button
                      type="button"
                      onClick={() => setAsOfDate('')}
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {asOfDate && (
                  <p className="text-xs text-cyan-400/80 mt-1.5">
                    Using historical market values from {new Date(asOfDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 px-6 py-4 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing Trade...
              </span>
            ) : (
              'Evaluate Trade'
            )}
          </button>
        </form>

        {result && (
          <div className="mt-10 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur text-center">
              <div className="mb-4">
                <span className="text-sm text-white/50 uppercase tracking-wider">Fairness Score</span>
                <div className={`text-6xl font-bold mt-2 ${getFairnessColor(getFairnessScore(result))}`}>
                  {getFairnessScore(result)}
                </div>
                <div className="text-white/40 text-sm mt-1">out of 100 (50 = perfectly fair)</div>
              </div>

              <div className="inline-block rounded-full px-4 py-2 bg-white/[0.06] border border-white/10">
                <span className="text-white/60">Winner: </span>
                <span className="text-white font-medium">{getWinnerLabel(result.evaluation?.winner)}</span>
              </div>

              <p className="mt-6 text-white/70 max-w-2xl mx-auto">
                {result.evaluation?.summary || result.evaluation?.explanation}
              </p>
            </div>

            {/* Trade Insights - Labels, Warnings, Veto */}
            {result.tradeInsights && (
              <div className="space-y-4">
                {/* Veto Alert */}
                {result.tradeInsights.veto && (
                  <div className="rounded-2xl border-2 border-red-500/50 bg-red-500/10 p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">🚫</span>
                      <h3 className="text-lg font-bold text-red-400">Trade Not Recommended</h3>
                    </div>
                    <p className="text-red-300">{result.tradeInsights.vetoReason}</p>
                  </div>
                )}

                {/* Expert Warning */}
                {result.tradeInsights.expertWarning && !result.tradeInsights.veto && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">⚠️</span>
                      <span className="text-amber-300 font-medium">Expert Warning:</span>
                      <span className="text-amber-200/80">{result.tradeInsights.expertWarning}</span>
                    </div>
                  </div>
                )}

                {/* Positive Labels */}
                {result.tradeInsights.labels.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {result.tradeInsights.labels.map((label) => (
                      <div 
                        key={label.id}
                        className="group relative rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 cursor-help"
                      >
                        <span className="text-emerald-400 font-medium">{label.emoji} {label.name}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white shadow-xl whitespace-nowrap max-w-xs">
                            {label.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Warning Labels */}
                {result.tradeInsights.warnings.length > 0 && (
                  <div className="flex flex-wrap gap-3 justify-center">
                    {result.tradeInsights.warnings.map((warning) => (
                      <div 
                        key={warning.id}
                        className="group relative rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 cursor-help"
                      >
                        <span className="text-orange-400 font-medium">{warning.emoji} {warning.name}</span>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white shadow-xl whitespace-nowrap max-w-xs">
                            {warning.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fairness Score Display */}
                <div className="text-center text-sm text-white/50">
                  Fairness Score: <span className={result.tradeInsights.fairnessScore >= 45 && result.tradeInsights.fairnessScore <= 55 ? 'text-emerald-400' : result.tradeInsights.fairnessScore >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                    {result.tradeInsights.fairnessScore}/100
                  </span>
                  <span className="ml-2 text-xs text-white/30">
                    ({result.tradeInsights.fairnessMethod === 'lineup' ? 'lineup-based' : 'value-based'})
                  </span>
                </div>
              </div>
            )}

            {result.user_message && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
                  <h3 className="text-lg font-medium text-cyan-400 mb-3">Message for {sender.manager_name || 'Sender'}</h3>
                  <p className="text-white/70 text-sm">{result.user_message.to_sender}</p>
                </div>
                <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-6">
                  <h3 className="text-lg font-medium text-fuchsia-400 mb-3">Message for {receiver.manager_name || 'Receiver'}</h3>
                  <p className="text-white/70 text-sm">{result.user_message.to_receiver}</p>
                </div>
              </div>
            )}

            {result.evaluation?.risk_flags && result.evaluation.risk_flags.length > 0 && (
              <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
                <h3 className="text-lg font-medium text-yellow-400 mb-3">Risk Flags</h3>
                <ul className="space-y-2">
                  {result.evaluation.risk_flags.map((flag, i) => (
                    <li key={i} className="flex gap-2 text-white/70 text-sm">
                      <span className="text-yellow-400">!</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.improvements?.best_counter_offer && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
                <h3 className="text-lg font-medium text-cyan-400 mb-3">Suggested Counter-Offer</h3>
                <p className="text-white/70 text-sm mb-4">{result.improvements.best_counter_offer.why_this_is_better}</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {result.improvements.best_counter_offer.sender_gives_changes?.length ? (
                    <div>
                      <h4 className="text-sm text-white/60 mb-2">Sender adjustments:</h4>
                      <ul className="space-y-1">
                        {result.improvements.best_counter_offer.sender_gives_changes.map((adj, i) => (
                          <li key={i} className="text-white/70 text-sm">→ {adj}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.improvements.best_counter_offer.receiver_gives_changes?.length ? (
                    <div>
                      <h4 className="text-sm text-white/60 mb-2">Receiver adjustments:</h4>
                      <ul className="space-y-1">
                        {result.improvements.best_counter_offer.receiver_gives_changes.map((adj, i) => (
                          <li key={i} className="text-white/70 text-sm">→ {adj}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {(result.dynasty_idp_outlook || result.end_of_season_projection) && (
              <div className="grid md:grid-cols-2 gap-6">
                {result.dynasty_idp_outlook && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <h3 className="text-lg font-medium text-white/90 mb-3">Dynasty Outlook</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-white/50">{sender.manager_name || 'Sender'}: </span>
                        <span className="text-white/70">{result.dynasty_idp_outlook.sender}</span>
                      </div>
                      <div>
                        <span className="text-white/50">{receiver.manager_name || 'Receiver'}: </span>
                        <span className="text-white/70">{result.dynasty_idp_outlook.receiver}</span>
                      </div>
                    </div>
                  </div>
                )}
                {result.end_of_season_projection && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <h3 className="text-lg font-medium text-white/90 mb-3">End of Season Projection</h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-white/50">{sender.manager_name || 'Sender'}: </span>
                        <span className="text-white/70">{result.end_of_season_projection.sender}</span>
                      </div>
                      <div>
                        <span className="text-white/50">{receiver.manager_name || 'Receiver'}: </span>
                        <span className="text-white/70">{result.end_of_season_projection.receiver}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
