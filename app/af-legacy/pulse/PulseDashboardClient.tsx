'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, TrendingUp, AlertTriangle, Zap, Trophy, ArrowUpRight, ArrowDownRight, Users, RefreshCw } from 'lucide-react';

interface PulseData {
  leagueId: string;
  leagueName: string;
  leagueSize: number;
  scoring: string;
  isDynasty: boolean;
  tradesThisWeek: number;
  tradesLastWeek: number;
  waiverAdds: number;
  rosterMoves: number;
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
      <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-8">
        <Skeleton className="h-16 w-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 col-span-2" />
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
      >
        <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent flex items-center gap-4">
          <Zap className="h-12 w-12 text-yellow-400 animate-pulse" />
          League Pulse
        </h1>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 col-span-2 rounded-2xl" />
        </div>
      ) : pulseData ? (
        <Tabs defaultValue="overview">
          <TabsList className="bg-[#1a1238]/70 backdrop-blur-lg border border-white/10 rounded-xl mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="power">Power Rankings</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-cyan-950/30">
                <CardHeader>
                  <CardTitle className="text-2xl text-cyan-300 flex items-center gap-2">
                    <Activity className="h-6 w-6" />
                    League Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                </CardContent>
              </Card>

              <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-purple-950/50 to-cyan-950/40 border-none">
                <CardHeader>
                  <CardTitle className="text-2xl text-purple-300 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    League Pulse
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center p-4 rounded-xl bg-[#0f0a24]/60">
                      <div className="text-4xl font-bold text-cyan-400">{pulseData.tradesThisWeek}</div>
                      <p className="text-sm text-gray-400 mt-1">Trades This Week</p>
                      {tradeTrend !== 0 && (
                        <div className={`flex items-center justify-center gap-1 mt-2 text-xs ${tradeTrend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tradeTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(tradeTrend)} vs last week
                        </div>
                      )}
                    </div>
                    <div className="text-center p-4 rounded-xl bg-[#0f0a24]/60">
                      <div className="text-4xl font-bold text-amber-400">{pulseData.waiverAdds}</div>
                      <p className="text-sm text-gray-400 mt-1">Waiver Claims</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-[#0f0a24]/60">
                      <div className="text-4xl font-bold text-purple-400">{pulseData.rosterMoves}</div>
                      <p className="text-sm text-gray-400 mt-1">Roster Moves</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-[#0f0a24]/60">
                      <div className="text-4xl font-bold text-emerald-400">{pulseData.standings.length}</div>
                      <p className="text-sm text-gray-400 mt-1">Active Teams</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

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
                          key={team.id}
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
                              <p className="text-emerald-400 font-bold">{team.pointsFor.toFixed(1)}</p>
                              <p className="text-xs text-gray-500">PF</p>
                            </div>
                            <div className="text-right">
                              <p className="text-red-400 font-bold">{team.pointsAgainst.toFixed(1)}</p>
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
      ) : (
        <div className="text-center py-20 text-gray-500">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Could not load pulse data</p>
        </div>
      )}
    </div>
  );
}
