'use client'

import React from 'react'

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

interface Manager {
  rosterId: number
  displayName: string
  username: string
  avatar: string | null
  wins: number
  losses: number
  ties: number
  pointsFor: string
  rosterSize: number
}

interface TradeSide {
  rosterId: number
  username: string
  avatar: string | null
  receives: { players: { id: string; name: string; pos: string; team: string }[]; picks: number }
}

interface RecentTrade {
  id: string
  created: number
  teamsInvolved: number
  sides: TradeSide[]
}

interface Storyline {
  title: string
  description: string
  type: string
}

interface TransferPreview {
  league: {
    id: string
    name: string
    sport: string
    season: string
    type: string
    status: string
    teamCount: number
    playoffTeams: number
    avatar: string | null
    settings: { ppr: number; superflex: boolean; tep: boolean }
    scoringSettings: Record<string, number>
  }
  managers: Manager[]
  stats: {
    totalSeasons: number
    totalTrades: number
    totalDraftPicks: number
    totalMatchups: number
    previousSeasons: string[]
  }
  recentTrades: RecentTrade[]
  storylines: Storyline[]
}

const STORYLINE_ICONS: Record<string, string> = {
  rivalry: '\u{2694}\uFE0F',
  redemption: '\u{1F525}',
  contender: '\u{1F3C6}',
  underdog: '\u{1F43A}',
  dynasty: '\u{1F451}',
  trade_war: '\u{1F4B0}',
  sleeper: '\u{1F4A4}',
}

const STORYLINE_COLORS: Record<string, string> = {
  rivalry: 'border-red-500/30 bg-red-500/5',
  redemption: 'border-amber-500/30 bg-amber-500/5',
  contender: 'border-emerald-500/30 bg-emerald-500/5',
  underdog: 'border-purple-500/30 bg-purple-500/5',
  dynasty: 'border-cyan-500/30 bg-cyan-500/5',
  trade_war: 'border-pink-500/30 bg-pink-500/5',
  sleeper: 'border-slate-500/30 bg-slate-500/5',
}

function deriveRivalryWeek(managers: Manager[]): { team1: string; team2: string; narrative: string } | null {
  if (managers.length < 2) return null
  const sorted = [...managers].sort((a, b) => b.wins - a.wins || parseFloat(b.pointsFor) - parseFloat(a.pointsFor))
  const t1 = sorted[0]
  const t2 = sorted[1]
  const t1Pts = parseFloat(t1.pointsFor)
  const t2Pts = parseFloat(t2.pointsFor)
  const diff = Math.abs(t1Pts - t2Pts).toFixed(1)
  return {
    team1: t1.displayName,
    team2: t2.displayName,
    narrative: `${t1.displayName} (${t1.wins}-${t1.losses}) vs ${t2.displayName} (${t2.wins}-${t2.losses}) \u2014 separated by just ${diff} points.`,
  }
}

function deriveTradeOpportunities(managers: Manager[]): { buyer: string; seller: string; reason: string }[] {
  if (managers.length < 4) return []
  const sorted = [...managers].sort((a, b) => b.wins - a.wins || parseFloat(b.pointsFor) - parseFloat(a.pointsFor))
  const contenders = sorted.slice(0, Math.ceil(sorted.length / 3))
  const rebuilders = sorted.slice(-Math.ceil(sorted.length / 3))

  const opps: { buyer: string; seller: string; reason: string }[] = []
  if (contenders[0] && rebuilders[0]) {
    opps.push({
      buyer: contenders[0].displayName,
      seller: rebuilders[0].displayName,
      reason: `${contenders[0].displayName} is contending (${contenders[0].wins}W) and could acquire depth from ${rebuilders[0].displayName} (${rebuilders[0].wins}W) who should sell for future picks.`,
    })
  }
  if (contenders.length > 1 && rebuilders.length > 1) {
    opps.push({
      buyer: contenders[1].displayName,
      seller: rebuilders[1].displayName,
      reason: `${contenders[1].displayName} needs a push for playoffs while ${rebuilders[1].displayName} could flip assets for long-term value.`,
    })
  }
  return opps
}

function deriveWaiverPriorities(managers: Manager[]): { team: string; priority: string; reason: string }[] {
  const priorities: { team: string; priority: string; reason: string }[] = []
  const sorted = [...managers].sort((a, b) => parseFloat(a.pointsFor) - parseFloat(b.pointsFor))

  const weakest = sorted[0]
  if (weakest) {
    priorities.push({
      team: weakest.displayName,
      priority: 'High-upside RB/WR handcuff',
      reason: `Lowest scorer (${weakest.pointsFor} pts) \u2014 needs ceiling plays to close the gap.`,
    })
  }

  const middleTier = sorted[Math.floor(sorted.length / 2)]
  if (middleTier) {
    priorities.push({
      team: middleTier.displayName,
      priority: 'Streaming QB/TE',
      reason: `Mid-pack team (${middleTier.wins}-${middleTier.losses}) \u2014 matchup-based streaming could swing a playoff berth.`,
    })
  }

  const topTeam = sorted[sorted.length - 1]
  if (topTeam && topTeam !== weakest) {
    priorities.push({
      team: topTeam.displayName,
      priority: 'Depth stash',
      reason: `Top scorer (${topTeam.pointsFor} pts) \u2014 should lock in handcuffs to protect the championship run.`,
    })
  }

  return priorities
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)} months ago`
}

export default function MigrationProof({ preview }: { preview: TransferPreview }) {
  const managers = preview?.managers || []
  const league = preview?.league || { id: '', name: 'League', sport: 'NFL', season: '', type: 'Redraft', status: '', teamCount: 0, playoffTeams: 0, avatar: null, settings: { ppr: 0, superflex: false, tep: false }, scoringSettings: {} }
  const stats = preview?.stats || { totalSeasons: 0, totalTrades: 0, totalDraftPicks: 0, totalMatchups: 0, previousSeasons: [] }
  const recentTrades = preview?.recentTrades || []
  const sorted = [...managers].sort((a, b) => b.wins - a.wins || parseFloat(b.pointsFor || '0') - parseFloat(a.pointsFor || '0'))
  const rivalry = managers.length >= 2 ? deriveRivalryWeek(managers) : null
  const tradeOpps = deriveTradeOpportunities(managers)
  const waiverPriorities = deriveWaiverPriorities(managers)
  const storylines = preview?.storylines || []

  if (managers.length === 0) return null

  return (
    <div className="w-full space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg sm:text-xl font-bold text-white">Same Data, Better Intelligence</h2>
        <p className="text-xs text-white/50 max-w-lg mx-auto">
          Your Sleeper league data on the left. What AllFantasy does with it on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* LEFT: Sleeper Snapshot */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.03] flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#1a1a2e] flex items-center justify-center text-[10px] font-bold text-[#00c2ff]">S</div>
            <span className="text-xs font-semibold text-white/70">Sleeper Snapshot</span>
            <span className="ml-auto text-[9px] text-white/30 uppercase tracking-wider">Raw Data</span>
          </div>

          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {/* Settings */}
            <div>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">League Settings</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Format', value: league.type },
                  { label: 'Scoring', value: league.settings?.ppr === 1 ? 'PPR' : league.settings?.ppr === 0.5 ? 'Half PPR' : 'Standard' },
                  { label: 'Teams', value: String(league.teamCount) },
                  { label: 'Superflex', value: league.settings?.superflex ? 'Yes' : 'No' },
                  { label: 'Playoff Teams', value: String(league.playoffTeams) },
                  { label: 'Season', value: league.season },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center px-2 py-1.5 rounded bg-white/[0.04] text-[10px]">
                    <span className="text-white/40">{s.label}</span>
                    <span className="text-white/70 font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Standings */}
            <div>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Standings</div>
              <div className="space-y-1">
                {sorted.map((m, idx) => (
                  <div key={m.rosterId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04]">
                    <span className="w-4 text-[10px] font-bold text-white/30 text-center">{idx + 1}</span>
                    {m.avatar ? (
                      <img src={m.avatar} alt="" className="w-5 h-5 rounded-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[8px] font-bold text-white/50">
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-[10px] text-white/70 flex-1 truncate">{m.displayName}</span>
                    <span className="text-[10px] text-white/50 tabular-nums">{m.wins}-{m.losses}{m.ties ? `-${m.ties}` : ''}</span>
                    <span className="text-[9px] text-white/25 tabular-nums w-12 text-right">{m.pointsFor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Trades */}
            <div>
              <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
                Recent Trades ({stats.totalTrades} total)
              </div>
              {recentTrades.length === 0 ? (
                <div className="text-[10px] text-white/25 text-center py-3">No trades recorded</div>
              ) : (
                <div className="space-y-2">
                  {recentTrades.slice(0, 3).map(trade => (
                    <div key={trade.id} className="rounded-lg bg-white/[0.04] p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-white/30">{timeAgo(trade.created)}</span>
                        <span className="text-[8px] text-white/20">{trade.teamsInvolved} teams</span>
                      </div>
                      {trade.sides.map(side => (
                        <div key={side.rosterId} className="flex items-start gap-1.5">
                          <span className="text-[9px] text-white/50 shrink-0 mt-0.5">{side.username} gets:</span>
                          <div className="flex flex-wrap gap-1">
                            {side.receives.players.map(p => (
                              <span key={p.id} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">
                                {p.name} <span className="text-white/25">{p.pos}</span>
                              </span>
                            ))}
                            {side.receives.picks > 0 && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/60">
                                +{side.receives.picks} pick{side.receives.picks > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Seasons', value: String(stats.totalSeasons) },
                { label: 'Draft Picks', value: String(stats.totalDraftPicks) },
                { label: 'Matchups', value: String(stats.totalMatchups) },
              ].map(s => (
                <div key={s.label} className="text-center py-2 rounded bg-white/[0.04]">
                  <div className="text-sm font-bold text-white/50 tabular-nums">{s.value}</div>
                  <div className="text-[8px] text-white/25 uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: AF Enhanced View */}
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-purple-950/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/[0.06] to-purple-500/[0.04] flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">AF</div>
            <span className="text-xs font-semibold text-cyan-300">AllFantasy Enhanced</span>
            <span className="ml-auto text-[9px] text-cyan-400/50 uppercase tracking-wider">AI-Powered</span>
          </div>

          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {/* Rivalry Week */}
            {rivalry && (
              <div className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.06] to-orange-500/[0.04] p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{'\u{2694}\uFE0F'}</span>
                  <span className="text-[10px] font-semibold text-red-300 uppercase tracking-wider">Rivalry Matchup of the Week</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-xs font-bold text-white">{rivalry.team1}</span>
                  <span className="text-[10px] text-red-400 font-bold">VS</span>
                  <span className="text-xs font-bold text-white">{rivalry.team2}</span>
                </div>
                <p className="text-[10px] text-white/50 text-center leading-relaxed">{rivalry.narrative}</p>
              </div>
            )}

            {/* AI Storylines */}
            {storylines.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{'\u{1F4DD}'}</span>
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">AI Season Storylines</span>
                </div>
                <div className="space-y-2">
                  {storylines.slice(0, 4).map((s, i) => (
                    <div key={i} className={cx('rounded-lg border p-2.5 space-y-1', STORYLINE_COLORS[s.type] || 'border-white/10 bg-white/[0.03]')}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{STORYLINE_ICONS[s.type] || '\u{1F4A1}'}</span>
                        <span className="text-[10px] font-bold text-white">{s.title}</span>
                      </div>
                      <p className="text-[9px] text-white/50 leading-relaxed">{s.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trade Opportunities */}
            {tradeOpps.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{'\u{1F4B1}'}</span>
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Trade Opportunities</span>
                </div>
                <div className="space-y-2">
                  {tradeOpps.map((opp, i) => (
                    <div key={i} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5 space-y-1">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold">{opp.buyer}</span>
                        <span className="text-white/20">{'\u2192'}</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">{opp.seller}</span>
                      </div>
                      <p className="text-[9px] text-white/50 leading-relaxed">{opp.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waiver Priorities */}
            {waiverPriorities.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{'\u{1F3AF}'}</span>
                  <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Waiver Priorities</span>
                </div>
                <div className="space-y-1.5">
                  {waiverPriorities.map((wp, i) => (
                    <div key={i} className="rounded-lg border border-purple-500/20 bg-purple-500/[0.04] p-2.5 flex items-start gap-2">
                      <span className="text-[10px] font-bold text-purple-400 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-white">{wp.team}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">{wp.priority}</span>
                        </div>
                        <p className="text-[9px] text-white/40 leading-relaxed mt-0.5">{wp.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Power Rankings Teaser */}
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-purple-500/[0.04] p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{'\u{1F4CA}'}</span>
                <span className="text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">AI Power Rankings</span>
              </div>
              <div className="space-y-1">
                {sorted.slice(0, 5).map((m, idx) => {
                  const composite = Math.round(90 - idx * 8 + (parseFloat(m.pointsFor) % 7))
                  const tier = composite >= 85 ? 'Contender' : composite >= 70 ? 'Frisky' : composite >= 55 ? 'Mid-Pack' : 'Rebuilding'
                  const tierColor = composite >= 85 ? 'text-emerald-400 bg-emerald-500/15' : composite >= 70 ? 'text-cyan-400 bg-cyan-500/15' : composite >= 55 ? 'text-amber-400 bg-amber-500/15' : 'text-red-400 bg-red-500/15'
                  return (
                    <div key={m.rosterId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04]">
                      <span className={cx(
                        'w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold',
                        idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' :
                        idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black' :
                        idx === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-black' :
                        'bg-white/10 text-white/40',
                      )}>{idx + 1}</span>
                      <span className="text-[10px] text-white/70 flex-1 truncate">{m.displayName}</span>
                      <span className="text-[10px] font-bold text-white tabular-nums">{composite}</span>
                      <span className={cx('text-[8px] px-1.5 py-0.5 rounded-full font-semibold', tierColor)}>{tier}</span>
                    </div>
                  )
                })}
              </div>
              <div className="text-center">
                <span className="text-[8px] text-cyan-400/40">Full rankings with 5-score breakdown available after import</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
