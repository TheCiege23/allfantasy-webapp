'use client'

import React, { useState } from 'react'
import type { RivalryWeekData, RivalryPair } from '@/lib/rivalry-engine'

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div className="rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center font-bold text-white/60" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-amber-400' : 'text-blue-400'
  return (
    <div className="text-center">
      <div className={cx('text-sm font-bold tabular-nums', color)}>{score}</div>
      <div className="text-[8px] text-white/30 uppercase">{label}</div>
    </div>
  )
}

function VsBlock({ pair, compact }: { pair: RivalryPair; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Avatar src={pair.team1.avatar} name={pair.team1.displayName} size={compact ? 28 : 36} />
        <div className="min-w-0">
          <div className={cx('font-semibold text-white truncate', compact ? 'text-xs' : 'text-sm')}>{pair.team1.displayName}</div>
          <div className="text-[10px] text-white/40">{pair.team1.wins}-{pair.team1.losses}</div>
        </div>
      </div>
      <div className="flex flex-col items-center px-2">
        <div className="text-[10px] font-bold text-white/20 uppercase">vs</div>
        <div className="text-[9px] text-white/30 tabular-nums">{pair.h2hRecord.wins1}-{pair.h2hRecord.wins2}</div>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <div className="min-w-0 text-right">
          <div className={cx('font-semibold text-white truncate', compact ? 'text-xs' : 'text-sm')}>{pair.team2.displayName}</div>
          <div className="text-[10px] text-white/40">{pair.team2.wins}-{pair.team2.losses}</div>
        </div>
        <Avatar src={pair.team2.avatar} name={pair.team2.displayName} size={compact ? 28 : 36} />
      </div>
    </div>
  )
}

function RivalryOfTheWeekCard({ pair, narrative }: { pair: RivalryPair; narrative?: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-orange-500/[0.04] overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔥</span>
            <span className="text-xs font-bold text-amber-400/80 uppercase tracking-wider">Rivalry of the Week</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-400 tabular-nums">
              Score: {pair.totalScore}
            </div>
            <svg className={cx('w-3.5 h-3.5 text-white/30 transition-transform', expanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
        <VsBlock pair={pair} />
        {narrative && (
          <p className="text-[11px] text-white/50 leading-relaxed italic">{narrative}</p>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
          <div className="grid grid-cols-3 gap-3 pt-3">
            <ScoreBadge score={pair.matchupImpact} label="Matchup Impact" />
            <ScoreBadge score={pair.recordProximity} label="Record Proximity" />
            <ScoreBadge score={Math.min(pair.tradeFriction * 20, 100)} label="Trade Friction" />
          </div>
          {pair.lastMatchup && (
            <div className="rounded-lg bg-white/[0.04] p-2.5">
              <div className="text-[9px] text-white/30 uppercase mb-1">Last Meeting (Week {pair.lastMatchup.week})</div>
              <div className="flex items-center justify-between text-xs">
                <span className={pair.lastMatchup.winner === pair.team1.rosterId ? 'text-emerald-400 font-semibold' : 'text-white/50'}>
                  {pair.lastMatchup.pts1.toFixed(1)} pts
                </span>
                <span className="text-[9px] text-white/20">—</span>
                <span className={pair.lastMatchup.winner === pair.team2.rosterId ? 'text-emerald-400 font-semibold' : 'text-white/50'}>
                  {pair.lastMatchup.pts2.toFixed(1)} pts
                </span>
              </div>
            </div>
          )}
          {pair.streakHolder && (
            <div className="text-[10px] text-amber-400/60 text-center">
              🔥 {pair.streakHolder.rosterId === pair.team1.rosterId ? pair.team1.displayName : pair.team2.displayName} on a {pair.streakHolder.streak}-game win streak
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RevengeGameCard({ pair, narrative }: { pair: RivalryPair; narrative?: string }) {
  if (pair.recentLoser === null || !pair.lastMatchup || pair.lastMatchup.winner === 0) return null
  const loser = pair.recentLoser === pair.team1.rosterId ? pair.team1 : pair.team2
  const winner = pair.recentLoser === pair.team1.rosterId ? pair.team2 : pair.team1

  return (
    <div className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.06] to-rose-500/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚔️</span>
        <span className="text-xs font-bold text-red-400/80 uppercase tracking-wider">Revenge Game</span>
      </div>
      <div className="flex items-center gap-3">
        <Avatar src={loser.avatar} name={loser.displayName} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{loser.displayName}</div>
          <div className="text-[10px] text-red-400/60">seeking revenge vs {winner.displayName}</div>
        </div>
      </div>
      {pair.lastMatchup && (
        <div className="rounded-lg bg-white/[0.04] p-2.5 text-[10px]">
          <span className="text-white/30">Lost Week {pair.lastMatchup.week}: </span>
          <span className="text-red-400/70 font-medium tabular-nums">
            {pair.lastMatchup.winner === pair.team1.rosterId ? pair.lastMatchup.pts2.toFixed(1) : pair.lastMatchup.pts1.toFixed(1)}
          </span>
          <span className="text-white/20"> — </span>
          <span className="text-emerald-400/70 font-medium tabular-nums">
            {pair.lastMatchup.winner === pair.team1.rosterId ? pair.lastMatchup.pts1.toFixed(1) : pair.lastMatchup.pts2.toFixed(1)}
          </span>
        </div>
      )}
      {pair.streakHolder && pair.streakHolder.rosterId !== loser.rosterId && (
        <div className="text-[10px] text-red-400/50 text-center">
          {winner.displayName} has won {pair.streakHolder.streak} straight meetings
        </div>
      )}
      {narrative && (
        <p className="text-[11px] text-white/45 leading-relaxed italic">{narrative}</p>
      )}
    </div>
  )
}

function TradeTensionCard({ data, narrative }: { data: NonNullable<RivalryWeekData['tradeTensionIndex']>; narrative?: string }) {
  const { pair, tensionScore, tradeCount } = data
  const barWidth = Math.max(tensionScore, 5)
  const barColor = tensionScore >= 70 ? 'bg-red-500' : tensionScore >= 40 ? 'bg-amber-500' : 'bg-blue-500'
  const label = tensionScore >= 70 ? 'Volatile' : tensionScore >= 40 ? 'Heating Up' : 'Simmering'

  return (
    <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.06] to-violet-500/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="text-xs font-bold text-purple-400/80 uppercase tracking-wider">Trade Tension Index</span>
        </div>
        <span className={cx('text-[10px] font-bold px-2 py-0.5 rounded-full',
          tensionScore >= 70 ? 'bg-red-500/10 text-red-400'
          : tensionScore >= 40 ? 'bg-amber-500/10 text-amber-400'
          : 'bg-blue-500/10 text-blue-400'
        )}>{label}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/40">Tension Level</span>
          <span className="text-white/60 font-bold tabular-nums">{tensionScore}/100</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={cx('h-full rounded-full transition-all', barColor)} style={{ width: `${barWidth}%` }} />
        </div>
      </div>

      <VsBlock pair={pair} compact />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.04] p-2 text-center">
          <div className="text-sm font-bold text-purple-400 tabular-nums">{tradeCount}</div>
          <div className="text-[8px] text-white/25 uppercase">Trades Between</div>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2 text-center">
          <div className="text-sm font-bold text-purple-400 tabular-nums">{pair.h2hRecord.wins1 + pair.h2hRecord.wins2}</div>
          <div className="text-[8px] text-white/25 uppercase">H2H Meetings</div>
        </div>
      </div>
      {narrative && (
        <p className="text-[11px] text-white/45 leading-relaxed italic">{narrative}</p>
      )}
    </div>
  )
}

interface RivalryNarratives {
  rivalryOfTheWeek?: string
  revengeGame?: string
  tradeTension?: string
}

export default function RivalryWeekCards({ data, narratives }: { data: RivalryWeekData; narratives?: RivalryNarratives }) {
  if (!data.rivalryOfTheWeek && !data.revengeGame && !data.tradeTensionIndex) return null

  return (
    <div className="w-full space-y-4">
      <div className="text-center space-y-1">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center justify-center gap-2">
          <span>🏆</span> Rivalry Week Mode
        </h3>
        <p className="text-[10px] text-white/40">AI-generated weekly narrative cards from your league data</p>
      </div>

      <div className="grid gap-4">
        {data.rivalryOfTheWeek && (
          <RivalryOfTheWeekCard pair={data.rivalryOfTheWeek} narrative={narratives?.rivalryOfTheWeek} />
        )}

        <div className={cx('grid gap-4', data.revengeGame && data.tradeTensionIndex ? 'sm:grid-cols-2' : '')}>
          {data.revengeGame && (
            <RevengeGameCard pair={data.revengeGame} narrative={narratives?.revengeGame} />
          )}
          {data.tradeTensionIndex && (
            <TradeTensionCard data={data.tradeTensionIndex} narrative={narratives?.tradeTension} />
          )}
        </div>
      </div>

      {data.topRivalries.length > 1 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
          <div className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Top Rivalries Ranked</div>
          {data.topRivalries.map((r, i) => (
            <div key={`${r.team1.rosterId}-${r.team2.rosterId}`} className="flex items-center gap-3 py-1.5">
              <span className={cx('text-xs font-bold w-5 text-center tabular-nums',
                i === 0 ? 'text-amber-400' : i === 1 ? 'text-white/40' : 'text-white/25'
              )}>#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Avatar src={r.team1.avatar} name={r.team1.displayName} size={20} />
                  <span className="text-[10px] text-white/50 truncate">{r.team1.displayName}</span>
                  <span className="text-[8px] text-white/20">vs</span>
                  <span className="text-[10px] text-white/50 truncate">{r.team2.displayName}</span>
                  <Avatar src={r.team2.avatar} name={r.team2.displayName} size={20} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/25 tabular-nums">{r.h2hRecord.wins1}-{r.h2hRecord.wins2}</span>
                <span className={cx('text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded',
                  i === 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/[0.04] text-white/40'
                )}>{r.totalScore}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
