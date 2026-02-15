'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import WaiverSuggestionCard from '@/app/components/WaiverSuggestionCard'
import type { WaiverResult } from '@/lib/types/WaiverResult'

interface Player {
  name: string
  position: string
  team: string
  age?: number
  status?: string
  projected_points?: number
}

type RateLimitState = {
  remaining: number | null
  retryAfterSec: number | null
  limit?: number | null
  resetAt?: string | null
}

const defaultPlayer: Player = { name: '', position: '', team: '' }

function clampNonNeg(n: number) {
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

function formatMMSS(totalSec: number) {
  const s = clampNonNeg(Math.floor(totalSec))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

export default function WaiverAI() {
  const [leagueId, setLeagueId] = useState('my-league')
  const [teamId, setTeamId] = useState('my-team')
  const [format, setFormat] = useState<'redraft' | 'dynasty' | 'keeper'>('redraft')
  const [sport, setSport] = useState('NFL')
  const [waiverType, setWaiverType] = useState<'FAAB' | 'ROLLING' | 'PRIORITY'>('FAAB')
  const [currentWeek, setCurrentWeek] = useState(8)
  const [totalFaab, setTotalFaab] = useState(100)
  const [faabRemaining, setFaabRemaining] = useState(75)
  const [avgFaabRemaining, setAvgFaabRemaining] = useState(60)
  const [waiverPriority, setWaiverPriority] = useState(5)

  const [roster, setRoster] = useState<Player[]>([
    { name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
    { name: 'Saquon Barkley', position: 'RB', team: 'PHI' },
  ])
  const [bench, setBench] = useState<Player[]>([{ name: 'Jaylen Waddle', position: 'WR', team: 'MIA' }])
  const [waiverPool, setWaiverPool] = useState<Player[]>([
    { name: 'Tank Dell', position: 'WR', team: 'HOU', projected_points: 12.5 },
    { name: 'Bucky Irving', position: 'RB', team: 'TB', projected_points: 11.2 },
    { name: 'Jonnu Smith', position: 'TE', team: 'MIA', projected_points: 9.8 },
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<WaiverResult | null>(null)

  const [rateLimit, setRateLimit] = useState<RateLimitState>({
    remaining: null,
    retryAfterSec: null,
    limit: null,
    resetAt: null,
  })

  useEffect(() => {
    if (!rateLimit.retryAfterSec || rateLimit.retryAfterSec <= 0) return
    const t = window.setInterval(() => {
      setRateLimit((prev) => {
        const next = (prev.retryAfterSec ?? 0) - 1
        return { ...prev, retryAfterSec: next <= 0 ? 0 : next }
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [rateLimit.retryAfterSec])

  const isCoolingDown = useMemo(() => (rateLimit.retryAfterSec ?? 0) > 0, [rateLimit.retryAfterSec])

  const addPlayer = (list: 'roster' | 'bench' | 'waiver') => {
    if (list === 'roster') setRoster([...roster, { ...defaultPlayer }])
    else if (list === 'bench') setBench([...bench, { ...defaultPlayer }])
    else setWaiverPool([...waiverPool, { ...defaultPlayer }])
  }

  const removePlayer = (list: 'roster' | 'bench' | 'waiver', index: number) => {
    if (list === 'roster') setRoster(roster.filter((_, i) => i !== index))
    else if (list === 'bench') setBench(bench.filter((_, i) => i !== index))
    else setWaiverPool(waiverPool.filter((_, i) => i !== index))
  }

  const updatePlayer = (
    list: 'roster' | 'bench' | 'waiver',
    index: number,
    field: keyof Player,
    value: string | number,
  ) => {
    const update = (arr: Player[]) => {
      const copy = [...arr]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    }
    if (list === 'roster') setRoster(update(roster))
    else if (list === 'bench') setBench(update(bench))
    else setWaiverPool(update(waiverPool))
  }

  const ingestRateLimit = (data: any, response?: Response) => {
    const bodyRL = data?.rate_limit
    const remainingFromBody =
      typeof bodyRL?.remaining === 'number' ? bodyRL.remaining : typeof data?.remaining === 'number' ? data.remaining : null
    const retryAfterFromBody =
      typeof bodyRL?.retryAfterSec === 'number'
        ? bodyRL.retryAfterSec
        : typeof data?.retryAfterSec === 'number'
          ? data.retryAfterSec
          : null

    const hdrRemaining = response ? Number(response.headers.get('x-ratelimit-remaining')) : NaN
    const hdrRetryAfter = response ? Number(response.headers.get('retry-after')) : NaN

    const nextRemaining = Number.isFinite(remainingFromBody as number)
      ? (remainingFromBody as number)
      : Number.isFinite(hdrRemaining)
        ? hdrRemaining
        : null

    const nextRetry = Number.isFinite(retryAfterFromBody as number)
      ? (retryAfterFromBody as number)
      : Number.isFinite(hdrRetryAfter)
        ? hdrRetryAfter
        : null

    if (nextRemaining !== null || nextRetry !== null || bodyRL?.limit != null || bodyRL?.resetAt != null) {
      setRateLimit((prev) => ({
        ...prev,
        remaining: nextRemaining ?? prev.remaining,
        retryAfterSec: nextRetry ?? prev.retryAfterSec,
        limit: typeof bodyRL?.limit === 'number' ? bodyRL.limit : prev.limit ?? null,
        resetAt: typeof bodyRL?.resetAt === 'string' ? bodyRL.resetAt : prev.resetAt ?? null,
      }))
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/waiver-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league: {
            league_id: leagueId,
            format,
            sport,
            waiver_type: waiverType,
            current_week: currentWeek,
            total_faab: waiverType === 'FAAB' ? totalFaab : undefined,
            average_faab_remaining: waiverType === 'FAAB' ? avgFaabRemaining : undefined,
          },
          team: {
            team_id: teamId,
            roster: roster.filter((p) => p.name),
            bench: bench.filter((p) => p.name),
            faab_remaining: waiverType === 'FAAB' ? faabRemaining : undefined,
            waiver_priority: waiverType !== 'FAAB' ? waiverPriority : undefined,
          },
          waiver_pool: waiverPool.filter((p) => p.name),
        }),
      })

      const data = await response.json().catch(() => ({} as any))

      ingestRateLimit(data, response)

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to analyze waivers')
      }

      setResult(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const PlayerRow = ({
    player,
    list,
    index,
  }: {
    player: Player
    list: 'roster' | 'bench' | 'waiver'
    index: number
  }) => (
    <div className="flex gap-2 items-center mb-2">
      <input
        type="text"
        placeholder="Name"
        value={player.name}
        onChange={(e) => updatePlayer(list, index, 'name', e.target.value)}
        className="flex-1 px-3 py-2 bg-black/30 border border-cyan-500/30 rounded text-white text-sm"
      />
      <input
        type="text"
        placeholder="Pos"
        value={player.position}
        onChange={(e) => updatePlayer(list, index, 'position', e.target.value)}
        className="w-16 px-3 py-2 bg-black/30 border border-cyan-500/30 rounded text-white text-sm"
      />
      <input
        type="text"
        placeholder="Team"
        value={player.team}
        onChange={(e) => updatePlayer(list, index, 'team', e.target.value)}
        className="w-16 px-3 py-2 bg-black/30 border border-cyan-500/30 rounded text-white text-sm"
      />
      {list === 'waiver' && (
        <input
          type="number"
          placeholder="Pts"
          value={player.projected_points || ''}
          onChange={(e) => updatePlayer(list, index, 'projected_points', parseFloat(e.target.value) || 0)}
          className="w-16 px-3 py-2 bg-black/30 border border-cyan-500/30 rounded text-white text-sm"
        />
      )}
      <button onClick={() => removePlayer(list, index)} className="px-2 py-1 text-red-400 hover:text-red-300">
        X
      </button>
    </div>
  )

  const CooldownPill = () => {
    const remaining = rateLimit.remaining
    const retry = rateLimit.retryAfterSec

    if (remaining === null && (retry === null || retry <= 0)) return null

    const cooling = (retry ?? 0) > 0
    return (
      <div
        className={[
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs border',
          'bg-black/30 backdrop-blur',
          cooling ? 'border-amber-400/40 text-amber-200' : 'border-cyan-500/30 text-cyan-200',
        ].join(' ')}
        title={
          cooling
            ? 'Rate limit cooldown active'
            : remaining !== null
              ? 'Requests remaining in current window'
              : 'Rate limit status'
        }
      >
        <span className="font-semibold">{cooling ? 'Cooldown' : 'Rate Limit'}</span>
        {remaining !== null && (
          <span className={cooling ? 'text-amber-200/90' : 'text-cyan-200/90'}>Remaining: {remaining}</span>
        )}
        {cooling && retry !== null && <span className="font-mono">⏳ {formatMMSS(retry)}</span>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 inline-block">
            &larr; Back to Home
          </Link>

          <CooldownPill />
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-2">
          Waiver AI
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">AI-powered waiver wire analysis and recommendations</p>

        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-cyan-400 mb-3 sm:mb-4">League Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Format</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as 'redraft' | 'dynasty' | 'keeper')}
                    className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                  >
                    <option value="redraft">Redraft</option>
                    <option value="dynasty">Dynasty</option>
                    <option value="keeper">Keeper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Sport</label>
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                  >
                    <option value="NFL">NFL</option>
                    <option value="NBA">NBA</option>
                    <option value="MLB">MLB</option>
                    <option value="NHL">NHL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Waiver Type</label>
                  <select
                    value={waiverType}
                    onChange={(e) => setWaiverType(e.target.value as 'FAAB' | 'ROLLING' | 'PRIORITY')}
                    className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                  >
                    <option value="FAAB">FAAB</option>
                    <option value="ROLLING">Rolling</option>
                    <option value="PRIORITY">Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-1">Current Week</label>
                  <input
                    type="number"
                    value={currentWeek}
                    onChange={(e) => setCurrentWeek(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                  />
                </div>

                {waiverType === 'FAAB' && (
                  <>
                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Total FAAB</label>
                      <input
                        type="number"
                        value={totalFaab}
                        onChange={(e) => setTotalFaab(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-sm mb-1">Avg FAAB Remaining</label>
                      <input
                        type="number"
                        value={avgFaabRemaining}
                        onChange={(e) => setAvgFaabRemaining(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                      />
                    </div>
                  </>
                )}

                {waiverType !== 'FAAB' && (
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Waiver Priority</label>
                    <input
                      type="number"
                      value={waiverPriority}
                      onChange={(e) => setWaiverPriority(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-4">Your Team</h2>

              {waiverType === 'FAAB' && (
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-1">FAAB Remaining</label>
                  <input
                    type="number"
                    value={faabRemaining}
                    onChange={(e) => setFaabRemaining(parseInt(e.target.value) || 0)}
                    className="w-32 px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-white"
                  />
                </div>
              )}

              <h3 className="text-sm font-semibold text-purple-400 mb-2">Roster</h3>
              {roster.map((player, index) => (
                <PlayerRow key={index} player={player} list="roster" index={index} />
              ))}
              <button onClick={() => addPlayer('roster')} className="text-cyan-400 hover:text-cyan-300 text-sm">
                + Add Starter
              </button>

              <h3 className="text-sm font-semibold text-purple-400 mt-4 mb-2">Bench</h3>
              {bench.map((player, index) => (
                <PlayerRow key={index} player={player} list="bench" index={index} />
              ))}
              <button onClick={() => addPlayer('bench')} className="text-cyan-400 hover:text-cyan-300 text-sm">
                + Add Bench Player
              </button>
            </div>

            <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-4">Waiver Pool</h2>
              <p className="text-gray-400 text-sm mb-4">Available players to analyze</p>

              {waiverPool.map((player, index) => (
                <PlayerRow key={index} player={player} list="waiver" index={index} />
              ))}

              <button onClick={() => addPlayer('waiver')} className="text-cyan-400 hover:text-cyan-300 text-sm">
                + Add Available Player
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || isCoolingDown}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white font-bold rounded-xl transition disabled:opacity-50"
              title={isCoolingDown ? `Cooldown active (${formatMMSS(rateLimit.retryAfterSec ?? 0)})` : undefined}
            >
              {loading ? 'Analyzing...' : isCoolingDown ? `Cooldown (${formatMMSS(rateLimit.retryAfterSec ?? 0)})` : 'Analyze Waivers'}
            </button>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300">
                {error}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {result ? (
              <>
                <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-cyan-400 mb-2">Analysis Summary</h2>
                  <p className="text-gray-300">{result.summary}</p>
                </div>

                <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-cyan-400 mb-4">Top Adds</h2>
                  <div className="space-y-3">
                    {result.top_adds.map((add, index) => (
                      <div key={`${add.player_id ?? add.player_name}-${index}`}>
                        <WaiverSuggestionCard
                          suggestion={{
                            player_name: add.player_name,
                            tier: add.tier ?? "Top Add",
                            priority: add.priority_rank,
                            reasoning: add.reasoning ?? "",
                            team: add.team ?? undefined,
                            pos: add.position,
                            player_id: add.player_id,
                            ai: add.ai,
                          }}
                        />

                        {add.faab_bid_recommendation !== null && (
                          <div className="mt-2 ml-4 text-green-400 text-sm">
                            Recommended FAAB: ${add.faab_bid_recommendation}
                          </div>
                        )}

                        {add.drop_candidate && (
                          <div className="mt-1 ml-4 text-red-400 text-sm">
                            Drop: {add.drop_candidate}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
                  <h2 className="text-xl font-bold text-cyan-400 mb-4">Strategy Notes</h2>

                  {result.strategy_notes.faab_strategy && (
                    <div className="mb-3">
                      <h3 className="text-purple-400 font-semibold text-sm">FAAB Strategy</h3>
                      <p className="text-gray-300 text-sm">{result.strategy_notes.faab_strategy}</p>
                    </div>
                  )}

                  {result.strategy_notes.priority_strategy && (
                    <div className="mb-3">
                      <h3 className="text-purple-400 font-semibold text-sm">Priority Strategy</h3>
                      <p className="text-gray-300 text-sm">{result.strategy_notes.priority_strategy}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="text-purple-400 font-semibold text-sm">Timing</h3>
                    <p className="text-gray-300 text-sm">{result.strategy_notes.timing_notes}</p>
                  </div>
                </div>

                {result.bench_optimization_tips.length > 0 && (
                  <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-cyan-400 mb-4">Bench Optimization</h2>
                    <ul className="space-y-2">
                      {result.bench_optimization_tips.map((tip, index) => (
                        <li key={index} className="text-gray-300 text-sm flex items-start">
                          <span className="text-cyan-400 mr-2">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.risk_flags.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-400 mb-4">Risk Flags</h2>
                    <ul className="space-y-2">
                      {result.risk_flags.map((flag, index) => (
                        <li key={index} className="text-red-300 text-sm flex items-start">
                          <span className="text-red-400 mr-2">⚠</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🔮</div>
                <h2 className="text-xl font-bold text-gray-400 mb-2">No Analysis Yet</h2>
                <p className="text-gray-500">Enter your team and waiver pool details, then click Analyze Waivers</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
