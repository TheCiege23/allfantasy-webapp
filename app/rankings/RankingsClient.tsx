'use client';

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, Users, RefreshCw, Crown, ShieldAlert, Target, Calendar, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LineChart, Line } from "recharts";
import { toast } from "sonner";

interface PerformancePoint {
  week: number;
  points: number;
}

interface TeamData {
  id: string;
  externalId: string;
  teamName: string;
  ownerName: string;
  pointsFor: number;
  pointsAgainst: number;
  wins: number;
  losses: number;
  ties: number;
  currentRank: number;
  aiPowerScore: number | null;
  projectedWins: number | null;
  strengthNotes: string | null;
  riskNotes: string | null;
  avatarUrl: string | null;
  performances: PerformancePoint[];
}

interface LeagueData {
  id: string;
  name: string | null;
  sport: string;
  season: number | null;
  scoring: string | null;
  leagueSize: number | null;
  teams: TeamData[];
}

function generateMockPerfs(base: number, trend: 'up' | 'down' | 'steady'): PerformancePoint[] {
  return Array.from({ length: 7 }, (_, i) => ({
    week: i + 1,
    points: base + (trend === 'up' ? i * 8 : trend === 'down' ? -i * 6 : 0) + (Math.random() * 20 - 10),
  }));
}

function getTrend(perfs: PerformancePoint[]): 'up' | 'down' | 'steady' {
  if (perfs.length < 3) return 'steady';
  const recent = perfs.slice(-3);
  const earlier = perfs.slice(-6, -3);
  if (earlier.length === 0) return 'steady';
  const recentAvg = recent.reduce((s, p) => s + p.points, 0) / recent.length;
  const earlierAvg = earlier.reduce((s, p) => s + p.points, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'steady';
}

const mockLeague: LeagueData = {
  id: "mock",
  name: "Sample Dynasty League",
  sport: "NFL",
  season: 2025,
  scoring: "ppr",
  leagueSize: 12,
  teams: [
    { id: "m1", externalId: "m1", teamName: "Gridiron Gods", ownerName: "Cjabar", pointsFor: 1428.6, pointsAgainst: 1180.2, wins: 6, losses: 1, ties: 0, currentRank: 1, aiPowerScore: 92, projectedWins: 10.2, strengthNotes: "Elite RB depth", riskNotes: "QB injury prone", avatarUrl: null, performances: generateMockPerfs(140, 'up') },
    { id: "m2", externalId: "m2", teamName: "Sleeper Agents", ownerName: "commissioner", pointsFor: 1389.2, pointsAgainst: 1210.5, wins: 5, losses: 2, ties: 0, currentRank: 2, aiPowerScore: 87, projectedWins: 9.1, strengthNotes: "WR corps on fire", riskNotes: "Bye week hell", avatarUrl: null, performances: generateMockPerfs(135, 'steady') },
    { id: "m3", externalId: "m3", teamName: "Touchdown Tyrants", ownerName: "ballerNJ", pointsFor: 1351.8, pointsAgainst: 1260.1, wins: 5, losses: 2, ties: 0, currentRank: 3, aiPowerScore: 84, projectedWins: 8.7, strengthNotes: "Streaming defense wins", riskNotes: "Low bench upside", avatarUrl: null, performances: generateMockPerfs(130, 'up') },
    { id: "m4", externalId: "m4", teamName: "Jersey Jokers", ownerName: "you", pointsFor: 1297.4, pointsAgainst: 1290.0, wins: 4, losses: 3, ties: 0, currentRank: 4, aiPowerScore: 79, projectedWins: 7.5, strengthNotes: "Balanced roster", riskNotes: "Aging stars", avatarUrl: null, performances: generateMockPerfs(125, 'steady') },
    { id: "m5", externalId: "m5", teamName: "Draft Day Divas", ownerName: "queenB", pointsFor: 1265.1, pointsAgainst: 1275.0, wins: 3, losses: 4, ties: 0, currentRank: 5, aiPowerScore: 76, projectedWins: 6.8, strengthNotes: "TE advantage", riskNotes: "Thin at WR", avatarUrl: null, performances: generateMockPerfs(120, 'down') },
    { id: "m6", externalId: "m6", teamName: "Waiver Warriors", ownerName: "pickupKing", pointsFor: 1242.7, pointsAgainst: 1310.2, wins: 3, losses: 4, ties: 0, currentRank: 6, aiPowerScore: 73, projectedWins: 6.2, strengthNotes: "Waiver wire gold", riskNotes: "No true WR1", avatarUrl: null, performances: generateMockPerfs(115, 'steady') },
    { id: "m7", externalId: "m7", teamName: "Dynasty Demons", ownerName: "longGame", pointsFor: 1198.3, pointsAgainst: 1340.0, wins: 2, losses: 5, ties: 0, currentRank: 7, aiPowerScore: 70, projectedWins: 5.1, strengthNotes: "Young core", riskNotes: "Not contending yet", avatarUrl: null, performances: generateMockPerfs(110, 'up') },
    { id: "m8", externalId: "m8", teamName: "Punt City", ownerName: "tankCommander", pointsFor: 1156.9, pointsAgainst: 1380.5, wins: 1, losses: 6, ties: 0, currentRank: 8, aiPowerScore: 65, projectedWins: 3.8, strengthNotes: "2026 draft capital", riskNotes: "Worst roster now", avatarUrl: null, performances: generateMockPerfs(100, 'down') },
  ],
};

const aiTakes: Record<number, string> = {
  1: "Dominant roster with elite RB depth. Projected to hold #1 through Week 10 if QB stays healthy.",
  2: "WR corps is carrying this team. Watch the bye weeks in Week 9-10 \u2014 could drop 2-3 spots without smart streaming.",
  3: "Streaming defense strategy is working now but gets harder post-Week 10. Consider trading for a set-and-forget D/ST.",
};

interface RankingsClientProps {
  leagues: LeagueData[];
  isSignedIn: boolean;
}

export default function RankingsClient({ leagues, isSignedIn }: RankingsClientProps) {
  const hasRealData = leagues.length > 0;
  const allLeagues = hasRealData ? leagues : [mockLeague];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dynastyLoading, setDynastyLoading] = useState(false);
  const [dynastyData, setDynastyData] = useState<any>(null);
  const [dynastyTeamId, setDynastyTeamId] = useState<string | null>(null);

  const league = allLeagues[selectedIdx] || allLeagues[0];
  const displayTeams = league.teams;

  const headerTitle = hasRealData
    ? `${league.name || "Your League"} Power Rankings`
    : "Sample League Power Rankings";

  const headerSub = hasRealData
    ? `Season ${league.season ?? ""} \u2022 ${league.sport}${league.scoring ? ` \u2022 ${league.scoring.toUpperCase()}` : ""}${league.leagueSize ? ` \u2022 ${league.leagueSize}-team` : ""}`
    : "Mock data \u2013 connect Sleeper to see real leagues";

  async function handleDynastyOutlook(teamExternalId?: string) {
    if (!hasRealData) return;
    setDynastyLoading(true);
    setDynastyTeamId(teamExternalId || null);
    try {
      const res = await fetch('/api/dynasty-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: league.id,
          ...(teamExternalId ? { teamId: teamExternalId } : {}),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDynastyData(data.analysis);
      }
    } catch (err) {
      console.error('Dynasty outlook error:', err);
    } finally {
      setDynastyLoading(false);
    }
  }

  async function handleRefresh() {
    if (!hasRealData || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id }),
      });
      if (res.ok) {
        toast.success("AI rankings refreshed! Reloading...");
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to refresh rankings");
        setRefreshing(false);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] pb-20">
      <div className="relative overflow-hidden border-b border-cyan-900/30 bg-black/40 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.03)_0%,transparent_70%)]" />
        <div className="container relative mx-auto px-4 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-sm font-medium text-cyan-400">
              <Trophy className="h-4 w-4" /> AI Power Rankings
            </div>
            <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-6xl">
              Your League Right Now
            </h1>
            <p className="mt-6 text-lg text-gray-400 md:text-xl">
              Real-time power rankings &bull; AI insights &bull; Projected movers
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {!isSignedIn && !hasRealData && (
          <div className="mb-8 rounded-lg border border-cyan-800/40 bg-cyan-950/20 p-4 text-center text-gray-300">
            Sign in and connect your Sleeper account to see your real league rankings.
          </div>
        )}

        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">{headerTitle}</h2>
            <p className="text-gray-400">{headerSub}</p>
          </div>
          <div className="flex items-center gap-3">
            {allLeagues.length > 1 && (
              <Select
                value={selectedIdx.toString()}
                onValueChange={(val) => setSelectedIdx(Number(val))}
              >
                <SelectTrigger className="w-[280px] border-cyan-600/40 bg-gray-900 text-white">
                  <SelectValue placeholder="Select League" />
                </SelectTrigger>
                <SelectContent className="border-cyan-900/50 bg-gray-900">
                  {allLeagues.map((l, i) => (
                    <SelectItem key={l.id} value={i.toString()}>
                      {l.name || "League"} ({l.sport} {l.season})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={handleRefresh}
              disabled={!hasRealData || refreshing}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 disabled:opacity-50"
            >
              {refreshing ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Refreshing…</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Refresh AI Analysis</>
              )}
            </Button>
          </div>
        </div>

        {displayTeams.length > 0 && (() => {
          const totalPoints = displayTeams.reduce((sum, t) => sum + (t.pointsFor || 0), 0);
          const barColors = [
            'linear-gradient(90deg, #a855f7, #c084fc)',
            'linear-gradient(90deg, #ec4899, #f472b6)',
            'linear-gradient(90deg, #f97316, #fb923c)',
            'linear-gradient(90deg, #06b6d4, #22d3ee)',
            'linear-gradient(90deg, #10b981, #34d399)',
            'linear-gradient(90deg, #eab308, #facc15)',
            'linear-gradient(90deg, #6366f1, #818cf8)',
            'linear-gradient(90deg, #ef4444, #f87171)',
            'linear-gradient(90deg, #8b5cf6, #a78bfa)',
            'linear-gradient(90deg, #14b8a6, #2dd4bf)',
            'linear-gradient(90deg, #f59e0b, #fbbf24)',
            'linear-gradient(90deg, #3b82f6, #60a5fa)',
            'linear-gradient(90deg, #d946ef, #e879f9)',
            'linear-gradient(90deg, #84cc16, #a3e635)',
          ];
          return totalPoints > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8 glass-card rounded-3xl p-6 sm:p-8"
            >
              <h3 className="text-base sm:text-xl mb-4 sm:mb-6 flex items-center gap-3 text-white/80">
                League Power Breakdown <span className="text-xs text-cyan-400">(by total points scored)</span>
              </h3>
              <div className="h-7 sm:h-8 bg-gray-900 rounded-2xl overflow-hidden flex shadow-inner">
                {displayTeams.map((team, i) => {
                  const pct = (team.pointsFor / totalPoints) * 100;
                  return pct > 0 ? (
                    <motion.div
                      key={team.id}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease: 'easeOut' }}
                      className="h-full flex items-center justify-center text-[10px] sm:text-xs font-mono text-white/90 relative group cursor-default transition-all hover:brightness-125"
                      style={{ background: barColors[i % barColors.length] }}
                      title={`${team.teamName} — ${team.pointsFor.toFixed(1)} pts (${pct.toFixed(1)}%)`}
                    >
                      {pct > 4 && <span className="group-hover:scale-125 transition-transform">#{i + 1}</span>}
                    </motion.div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 sm:mt-4">
                {displayTeams.slice(0, 8).map((team, i) => (
                  <div key={team.id} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/50">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: barColors[i % barColors.length].replace('linear-gradient(90deg, ', '').split(',')[0] }}
                    />
                    <span>{team.teamName}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null;
        })()}

        <motion.div
          key={league.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card border-cyan-900/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Users className="h-6 w-6 text-cyan-400" />
                League Standings + AI Power
              </CardTitle>
              <CardDescription>
                Sorted by AI-adjusted power score (current performance + rest-of-season projection)
                {" • "}Last updated {new Date().toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-cyan-900/50 hover:bg-transparent">
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-center">Record</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="hidden md:table-cell text-center">AI Score</TableHead>
                      <TableHead className="hidden md:table-cell text-center w-28">Trend</TableHead>
                      <TableHead className="hidden lg:table-cell">Strength</TableHead>
                      <TableHead className="hidden lg:table-cell">Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayTeams.map((team, i) => {
                      const rank = i + 1;
                      const score = team.aiPowerScore;

                      return (
                        <motion.tr
                          key={team.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className={cn(
                            "border-b border-cyan-900/30 transition-colors hover:bg-cyan-950/20",
                            i === 0 && "bg-gradient-to-r from-cyan-950/40 to-purple-950/20"
                          )}
                        >
                          <TableCell className="text-center font-bold text-lg">
                            {rank === 1 && <span className="text-amber-400">{rank}</span>}
                            {rank === 2 && <span className="text-slate-300">{rank}</span>}
                            {rank === 3 && <span className="text-orange-400">{rank}</span>}
                            {rank > 3 && rank}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{team.teamName}</span>
                                <span className={cn(
                                  'text-[8px] px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline-block',
                                  score !== null && score > 90 ? 'tier-contender' :
                                  score !== null && score > 80 ? 'tier-frisky' :
                                  score !== null && score > 65 ? 'tier-midpack' :
                                  'tier-rebuild',
                                )}>
                                  {score !== null && score > 90 ? 'Contender' : score !== null && score > 80 ? 'Frisky' : score !== null && score > 65 ? 'Mid-Pack' : 'Rebuilding'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">{team.ownerName}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-sm">
                            <span className="text-green-400">{team.wins}</span>
                            <span className="text-slate-500">-</span>
                            <span className="text-red-400">{team.losses}</span>
                            {team.ties > 0 && (
                              <>
                                <span className="text-slate-500">-</span>
                                <span className="text-yellow-400">{team.ties}</span>
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {team.pointsFor.toFixed(1)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center">
                            <span className={cn(
                              "font-bold",
                              score !== null && score >= 90 ? "text-cyan-300" :
                              score !== null && score >= 80 ? "text-green-300" :
                              score !== null && score >= 70 ? "text-yellow-300" :
                              "text-orange-300"
                            )}>
                              {score !== null ? score.toFixed(0) : "\u2014"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              {team.performances.length > 1 ? (
                                <LineChart width={80} height={36} data={team.performances}>
                                  <Line
                                    type="natural"
                                    dataKey="points"
                                    stroke={
                                      getTrend(team.performances) === 'up' ? '#22d3ee' :
                                      getTrend(team.performances) === 'down' ? '#f87171' :
                                      '#a78bfa'
                                    }
                                    strokeWidth={2.5}
                                    dot={false}
                                  />
                                </LineChart>
                              ) : (
                                <span className="text-xs text-gray-600">No data</span>
                              )}
                              {team.performances.length >= 3 && (
                                <span className="flex-shrink-0">
                                  {getTrend(team.performances) === 'up' && <TrendingUp className="h-4 w-4 text-cyan-400" />}
                                  {getTrend(team.performances) === 'down' && <TrendingDown className="h-4 w-4 text-red-400" />}
                                  {getTrend(team.performances) === 'steady' && <Minus className="h-4 w-4 text-purple-400" />}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline" className="border-green-600/40 bg-green-950/30 text-green-300">
                              {team.strengthNotes || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline" className="border-orange-600/40 bg-orange-950/30 text-orange-300">
                              {team.riskNotes || "N/A"}
                            </Badge>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {displayTeams.slice(0, 3).map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + 0.1 * i }}
            >
              <Card className="glass-card h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{team.teamName}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        'border-transparent px-3 py-1 text-[10px]',
                        (team.aiPowerScore ?? 0) > 90 ? 'tier-contender' :
                        (team.aiPowerScore ?? 0) > 80 ? 'tier-frisky' :
                        (team.aiPowerScore ?? 0) > 65 ? 'tier-midpack' :
                        'tier-rebuild',
                      )}>
                        {(team.aiPowerScore ?? 0) > 90 ? 'CONTENDER' : (team.aiPowerScore ?? 0) > 80 ? 'FRISKY' : (team.aiPowerScore ?? 0) > 65 ? 'MID-PACK' : 'REBUILDING'}
                      </Badge>
                      <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-transparent">#{i + 1}</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ""}</span>
                      <span>{team.pointsFor.toFixed(1)} PF</span>
                      {team.projectedWins !== null && (
                        <span className="text-cyan-400">Proj: {team.projectedWins.toFixed(1)}W</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">
                      <strong>AI Take:</strong>{" "}
                      {aiTakes[i + 1] || `${team.strengthNotes || "Solid roster"} but watch out for ${team.riskNotes?.toLowerCase() || "potential risks"}.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-12"
        >
          <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl">
                    <Crown className="h-6 w-6 text-yellow-400" />
                    Dynasty Outlook
                  </CardTitle>
                  <CardDescription>
                    AI-powered long-term projections, aging analysis, and dynasty asset evaluation
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleDynastyOutlook()}
                    disabled={!hasRealData || dynastyLoading}
                    variant="outline"
                    className="border-yellow-600/40 text-yellow-400 hover:bg-yellow-950/30"
                  >
                    {dynastyLoading && !dynastyTeamId ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                    ) : (
                      <>League Overview</>
                    )}
                  </Button>
                  {hasRealData && (
                    <Select
                      value=""
                      onValueChange={(val) => handleDynastyOutlook(val)}
                    >
                      <SelectTrigger className="w-[200px] border-yellow-600/40 bg-gray-900 text-white">
                        <SelectValue placeholder="Analyze a team..." />
                      </SelectTrigger>
                      <SelectContent className="border-yellow-900/50 bg-gray-900">
                        {displayTeams.map((t) => (
                          <SelectItem key={t.externalId} value={t.externalId}>
                            {t.teamName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {dynastyLoading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-gray-400"
                  >
                    <Loader2 className="mb-4 h-8 w-8 animate-spin text-yellow-400" />
                    <p>Running dynasty analysis...</p>
                    <p className="text-sm text-gray-500">Evaluating rosters, aging curves, and long-term value</p>
                  </motion.div>
                )}
                {!dynastyLoading && !dynastyData && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 text-gray-500"
                  >
                    <Crown className="mb-4 h-12 w-12 opacity-30" />
                    <p>Select a team or run a league overview to see dynasty projections</p>
                  </motion.div>
                )}
                {!dynastyLoading && dynastyData && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="rounded-lg border border-cyan-900/30 bg-gray-900/60 p-4">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-cyan-400">Overall Outlook</h4>
                      <p className="text-gray-200">{dynastyData.overallOutlook}</p>
                      {dynastyData.contenderOrRebuilder && (
                        <Badge className={`mt-2 border-transparent ${
                          dynastyData.contenderOrRebuilder === 'contender'
                            ? 'bg-green-600/80 text-green-100'
                            : dynastyData.contenderOrRebuilder === 'rebuilder'
                              ? 'bg-red-600/80 text-red-100'
                              : 'bg-yellow-600/80 text-yellow-100'
                        }`}>
                          {dynastyData.contenderOrRebuilder === 'contender' ? 'Contender' : dynastyData.contenderOrRebuilder === 'rebuilder' ? 'Rebuilder' : 'Fringe'}
                        </Badge>
                      )}
                      {dynastyData.confidence != null && (
                        <span className="ml-3 text-sm text-gray-500">Confidence: {dynastyData.confidence}%</span>
                      )}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="rounded-lg border border-green-900/30 bg-gray-900/60 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-400">
                          <Target className="h-4 w-4" /> Top Dynasty Assets
                        </h4>
                        <div className="space-y-3">
                          {(dynastyData.topAssets || []).map((asset: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge variant="outline" className={`mt-0.5 shrink-0 text-xs ${
                                asset.dynastyTier === 'elite' ? 'border-yellow-500 text-yellow-400'
                                  : asset.dynastyTier === 'strong' ? 'border-green-500 text-green-400'
                                    : asset.dynastyTier === 'rising' ? 'border-cyan-500 text-cyan-400'
                                      : 'border-gray-500 text-gray-400'
                              }`}>
                                {asset.dynastyTier || 'hold'}
                              </Badge>
                              <div>
                                <span className="font-medium text-white">{asset.name}</span>
                                <p className="text-sm text-gray-400">{asset.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border border-red-900/30 bg-gray-900/60 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-red-400">
                          <ShieldAlert className="h-4 w-4" /> Biggest Risks
                        </h4>
                        <div className="space-y-3">
                          {(dynastyData.biggestRisks || []).map((risk: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge variant="outline" className={`mt-0.5 shrink-0 text-xs ${
                                risk.severity === 'critical' ? 'border-red-500 text-red-400'
                                  : risk.severity === 'moderate' ? 'border-yellow-500 text-yellow-400'
                                    : 'border-gray-500 text-gray-400'
                              }`}>
                                {risk.severity || 'minor'}
                              </Badge>
                              <div>
                                <span className="font-medium text-white">{risk.name}</span>
                                <p className="text-sm text-gray-400">{risk.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {dynastyData.projectedRankNext3Years && (
                      <div className="rounded-lg border border-purple-900/30 bg-gray-900/60 p-4">
                        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-purple-400">
                          <Calendar className="h-4 w-4" /> 3-Year Projection
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-3">
                          {(['year1', 'year2', 'year3'] as const).map((yr, i) => {
                            const proj = dynastyData.projectedRankNext3Years[yr];
                            if (!proj) return null;
                            return (
                              <div key={yr} className="text-center">
                                <div className="mb-1 text-xs text-gray-500">Year {i + 1}</div>
                                <div className="text-3xl font-bold text-white">#{proj.rank}</div>
                                <p className="mt-1 text-xs text-gray-400">{proj.reasoning}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {dynastyData.keyRecommendation && (
                      <div className="rounded-lg border border-cyan-900/30 bg-gradient-to-r from-cyan-950/40 to-purple-950/40 p-4">
                        <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider text-cyan-400">Key Recommendation</h4>
                        <p className="text-gray-200">{dynastyData.keyRecommendation}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {displayTeams.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-10 flex justify-center gap-6 sm:gap-10 text-center"
          >
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-amber-400">
                {displayTeams.filter(t => (t.aiPowerScore ?? 0) > 90).length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mt-1">Contenders</div>
            </div>
            <div className="w-px bg-gray-800" />
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-orange-400">
                {displayTeams.filter(t => { const s = t.aiPowerScore ?? 0; return s > 80 && s <= 90; }).length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mt-1">Frisky</div>
            </div>
            <div className="w-px bg-gray-800" />
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-sky-400">
                {displayTeams.filter(t => { const s = t.aiPowerScore ?? 0; return s > 65 && s <= 80; }).length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mt-1">Mid-Pack</div>
            </div>
            <div className="w-px bg-gray-800" />
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-red-400">
                {displayTeams.filter(t => (t.aiPowerScore ?? 0) <= 65).length}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mt-1">Rebuilding</div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
