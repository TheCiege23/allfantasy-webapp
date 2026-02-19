'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, AlertTriangle, Zap, Trophy, ArrowUpRight, ArrowDownRight, Users, RefreshCw } from 'lucide-react';
import TeamArchetypeBadge from '@/components/legacy/TeamArchetypeBadge';

interface PulseData {
  leagueId: string;
  leagueName: string;
  leagueSize: number;
  scoring: string;
  isDynasty: boolean;
  week: number;
  season: string;
  tradesThisWeek: number;
  tradesLastWeek: number;
  waiverAdds: number;
  rosterMoves: number;
  mostActiveManagers: { managerId: string; name: string; count: number }[];
  activitySpikePercent: string;
  hotPlayers: { playerId: string; name: string; position: string; points: number; rosterId: number; vsProj: string; insight: string }[];
  coldPlayers: { playerId: string; name: string; position: string; points: number; rosterId: number; vsProj: string; insight: string }[];
  userTeamPulse: { projectedThisWeek: number | null; actualThisWeek: number; starterCount: number } | null;
  recentTrades: any[];
  standings: any[];
  avgPointsPerTeam: number;
  alerts: { type: string; message: string; severity: string }[];
  lastSyncedAt: string | null;
}

export default function PulseDashboardClient({ userId }: { userId: string }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [pulseData, setPulseData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulseLoading, setPulseLoading] = useState(false);

  useEffect(() => {
    fetch('/api/leagues')
      .then(r => r.json())
      .then(data => {
        const leagueList = data.leagues || [];
        setLeagues(leagueList);
        if (leagueList.length > 0) {
          setSelectedLeagueId(leagueList[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLeagueId) return;
    setPulseLoading(true);
    fetch(`/api/pulse?leagueId=${selectedLeagueId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setPulseData(data);
        setPulseLoading(false);
      })
      .catch(() => setPulseLoading(false));
  }, [selectedLeagueId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-6 md:p-10">
        <Skeleton className="h-16 w-64 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="h-64 lg:col-span-5 rounded-2xl" />
          <Skeleton className="h-64 lg:col-span-7 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-8 flex items-center justify-center">
        <div className="text-center">
          <Zap className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl text-gray-400 mb-2">No Leagues Found</h2>
          <p className="text-gray-500">Import a league from Sleeper or ESPN to see your League Pulse</p>
        </div>
      </div>
    );
  }

  const tradeTrend = pulseData
    ? pulseData.tradesThisWeek - pulseData.tradesLastWeek
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-6 md:p-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-6xl font-bold tracking-tighter bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent flex items-center gap-5">
            <Zap className="h-14 w-14 text-yellow-400 animate-pulse" /> League Pulse
          </h1>
          {pulseData && (
            <p className="text-xl text-gray-400 mt-3">Live heartbeat of your league &middot; Week {pulseData.week} &middot; {pulseData.season}</p>
          )}
        </div>

        <select
          value={selectedLeagueId}
          onChange={e => setSelectedLeagueId(e.target.value)}
          className="bg-[#1a1238] border border-cyan-800/50 rounded-xl px-4 py-2.5 text-white max-w-xs"
        >
          {leagues.map((l: any) => (
            <option key={l.id} value={l.id}>{l.name || l.platformLeagueId}</option>
          ))}
        </select>
      </motion.div>

      {pulseLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <Skeleton className="h-72 lg:col-span-5 rounded-2xl" />
          <Skeleton className="h-72 lg:col-span-7 rounded-2xl" />
          <Skeleton className="h-64 lg:col-span-6 rounded-2xl" />
          <Skeleton className="h-64 lg:col-span-6 rounded-2xl" />
        </div>
      ) : pulseData ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <Card className="lg:col-span-5 bg-[#0f0a24]/90 border-cyan-900/40 backdrop-blur-xl shadow-2xl">
              <CardHeader>
                <CardTitle className="text-3xl text-cyan-300 flex items-center gap-3">
                  <Activity className="h-7 w-7" /> Your Team Pulse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {pulseData.userTeamPulse ? (
                  <>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-5xl font-bold text-emerald-400">{pulseData.userTeamPulse.actualThisWeek?.toFixed(1) || '—'}</div>
                        <p className="text-sm text-gray-400 mt-1">Points This Week</p>
                      </div>
                      <div>
                        <div className="text-5xl font-bold text-purple-400">{pulseData.userTeamPulse.starterCount}</div>
                        <p className="text-sm text-gray-400 mt-1">Active Starters</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">Team pulse data not available yet</p>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">League</span>
                    <span className="text-white font-medium">{pulseData.leagueName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Size</span>
                    <span className="text-white">{pulseData.leagueSize} teams</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Scoring</span>
                    <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                      {pulseData.scoring || 'Standard'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Type</span>
                    <Badge className={pulseData.isDynasty ? 'bg-amber-600/80' : 'bg-cyan-600/80'}>
                      {pulseData.isDynasty ? 'Dynasty' : 'Redraft'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Points</span>
                    <span className="text-emerald-400 font-bold">{pulseData.avgPointsPerTeam}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-gradient-to-br from-purple-950/60 to-cyan-950/40 border-none">
              <CardHeader>
                <CardTitle className="text-3xl text-purple-300 flex items-center gap-3">
                  <TrendingUp className="h-7 w-7" /> League Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                  <div>
                    <div className="text-6xl font-bold text-cyan-400">{pulseData.tradesThisWeek}</div>
                    <p className="text-gray-400 mt-2">Trades This Week</p>
                    {tradeTrend !== 0 && (
                      <div className={`flex items-center justify-center gap-1 mt-2 text-xs ${tradeTrend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tradeTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(tradeTrend)} vs last week
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-6xl font-bold text-amber-400">{pulseData.waiverAdds}</div>
                    <p className="text-gray-400 mt-2">Waiver Claims</p>
                  </div>
                  <div>
                    <div className="text-6xl font-bold text-emerald-400">{pulseData.activitySpikePercent}</div>
                    <p className="text-gray-400 mt-2">Activity Spike</p>
                  </div>
                  <div>
                    <div className="text-6xl font-bold text-purple-400">{pulseData.standings.length}</div>
                    <p className="text-gray-400 mt-2">Active Teams</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
            <Card className="bg-[#0f0a24]/90 border-emerald-900/40">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-2xl flex items-center gap-3">
                  <ArrowUpRight className="h-6 w-6" /> Hot This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pulseData.hotPlayers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No matchup data available yet</p>
                ) : (
                  pulseData.hotPlayers.map((p, i) => (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex justify-between items-center border-b border-emerald-900/30 pb-4 last:border-none"
                    >
                      <div>
                        <div className="font-semibold text-lg text-white">{p.name}</div>
                        <div className="text-sm text-emerald-300">
                          <Badge variant="outline" className="border-emerald-700/50 text-emerald-300 text-xs mr-2">{p.position}</Badge>
                          {p.insight}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-400">{p.points}</div>
                        <div className="text-xs text-emerald-500">{p.vsProj}</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#0f0a24]/90 border-rose-900/40">
              <CardHeader>
                <CardTitle className="text-rose-400 text-2xl flex items-center gap-3">
                  <ArrowDownRight className="h-6 w-6" /> Cold This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pulseData.coldPlayers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No matchup data available yet</p>
                ) : (
                  pulseData.coldPlayers.map((p, i) => (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex justify-between items-center border-b border-rose-900/30 pb-4 last:border-none"
                    >
                      <div>
                        <div className="font-semibold text-lg text-white">{p.name}</div>
                        <div className="text-sm text-rose-300">
                          <Badge variant="outline" className="border-rose-700/50 text-rose-300 text-xs mr-2">{p.position}</Badge>
                          {p.insight}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-rose-400">{p.points}</div>
                        <div className="text-xs text-rose-500">{p.vsProj}</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-10 bg-[#0f0a24]/90 border-purple-900/40">
            <CardHeader>
              <CardTitle className="text-purple-300 text-2xl flex items-center gap-3">
                <Users className="h-6 w-6" /> Most Active Managers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pulseData.mostActiveManagers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No transaction activity this week</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {pulseData.mostActiveManagers.map((m, i) => (
                    <motion.div
                      key={m.managerId}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className="text-center bg-[#1a1238] rounded-xl p-5 border border-purple-900/30"
                    >
                      <div className="text-3xl font-bold text-purple-300">{m.count}</div>
                      <div className="text-sm text-gray-400 mt-1">{m.name}</div>
                      {i === 0 && <Badge className="bg-amber-600/80 mt-2 text-xs">Most Active</Badge>}
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="activity" className="mt-10">
            <TabsList className="bg-[#1a1238]/70 backdrop-blur-lg border border-white/10 rounded-xl mb-8">
              <TabsTrigger value="activity">Recent Trades</TabsTrigger>
              <TabsTrigger value="power">Power Rankings</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <Card className="bg-[#0f0a24]/80 border-cyan-900/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-cyan-300 flex items-center gap-2">
                    <RefreshCw className="h-6 w-6" />
                    Recent Trades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pulseData.recentTrades.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">No recent trades in this league</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pulseData.recentTrades.map((trade, idx) => (
                        <motion.div
                          key={trade.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-4 rounded-xl bg-[#1a1238]/60 border border-cyan-900/30 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="border-cyan-500/50 text-cyan-300">
                              Trade #{idx + 1}
                            </Badge>
                            <div>
                              <p className="text-white text-sm">
                                Team {trade.team1Id.slice(0, 6)} ↔ Team {trade.team2Id.slice(0, 6)}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(trade.executedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={trade.status === 'completed' ? 'bg-emerald-600/80' : 'bg-amber-600/80'}>
                            {trade.status}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="power">
              <Card className="bg-[#0f0a24]/80 border-cyan-900/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-cyan-300 flex items-center gap-2">
                    <Trophy className="h-6 w-6" />
                    Power Rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pulseData.standings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">No standings data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pulseData.standings.map((team, idx) => {
                        const isTop3 = idx < 3;
                        const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
                        return (
                          <motion.div
                            key={team.rosterId || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className={`p-4 rounded-xl flex items-center justify-between ${
                              isTop3
                                ? 'bg-gradient-to-r from-[#1a1238]/80 to-cyan-950/30 border border-cyan-800/40'
                                : 'bg-[#1a1238]/40 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <span className={`text-2xl font-bold w-8 ${isTop3 ? medalColors[idx] : 'text-gray-500'}`}>
                                {team.rank}
                              </span>
                              <div>
                                <p className="text-white font-medium">{team.teamName}</p>
                                <p className="text-xs text-gray-500">{team.ownerName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-white font-bold">{team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}</p>
                                <p className="text-xs text-gray-500">Record</p>
                              </div>
                              <div className="text-right">
                                <p className="text-emerald-400 font-bold">{typeof team.pointsFor === 'number' ? team.pointsFor.toFixed(1) : team.pointsFor}</p>
                                <p className="text-xs text-gray-500">PF</p>
                              </div>
                              <div className="text-right">
                                <p className="text-red-400 font-bold">{typeof team.pointsAgainst === 'number' ? team.pointsAgainst.toFixed(1) : team.pointsAgainst}</p>
                                <p className="text-xs text-gray-500">PA</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alerts">
              <Card className="bg-[#0f0a24]/80 border-cyan-900/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6" />
                    League Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pulseData.alerts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-lg">No alerts right now</p>
                      <p className="text-sm mt-1">Your league is running smoothly</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {pulseData.alerts.map((alert, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`p-4 rounded-xl border flex items-start gap-3 ${
                            alert.severity === 'warning'
                              ? 'bg-amber-950/30 border-amber-800/40'
                              : alert.severity === 'error'
                              ? 'bg-red-950/30 border-red-800/40'
                              : 'bg-cyan-950/30 border-cyan-800/40'
                          }`}
                        >
                          <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                            alert.severity === 'warning' ? 'text-amber-400'
                              : alert.severity === 'error' ? 'text-red-400'
                              : 'text-cyan-400'
                          }`} />
                          <div>
                            <p className="text-white text-sm">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-1 capitalize">{alert.type.replace(/_/g, ' ')}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <div className="text-center py-20 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Could not load pulse data</p>
        </div>
      )}
    </div>
  );
}
