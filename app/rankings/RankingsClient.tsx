'use client';

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mockRankings = [
  { rank: 1, teamName: "Gridiron Gods", owner: "Cjabar", points: 1428.6, change: 0, trend: "up" as const, strength: "Elite RB depth", risk: "QB injury prone", aiScore: 92 },
  { rank: 2, teamName: "Sleeper Agents", owner: "commissioner", points: 1389.2, change: -1, trend: "down" as const, strength: "WR corps on fire", risk: "Bye week hell", aiScore: 87 },
  { rank: 3, teamName: "Touchdown Tyrants", owner: "ballerNJ", points: 1351.8, change: 2, trend: "up" as const, strength: "Streaming defense wins", risk: "Low bench upside", aiScore: 84 },
  { rank: 4, teamName: "Jersey Jokers", owner: "you", points: 1297.4, change: -1, trend: "stable" as const, strength: "Balanced roster", risk: "Aging stars", aiScore: 79 },
  { rank: 5, teamName: "Draft Day Divas", owner: "queenB", points: 1265.1, change: 1, trend: "up" as const, strength: "TE advantage", risk: "Thin at WR", aiScore: 76 },
  { rank: 6, teamName: "Waiver Warriors", owner: "pickupKing", points: 1242.7, change: -2, trend: "down" as const, strength: "Waiver wire gold", risk: "No true WR1", aiScore: 73 },
  { rank: 7, teamName: "Dynasty Demons", owner: "longGame", points: 1198.3, change: 0, trend: "stable" as const, strength: "Young core", risk: "Not contending yet", aiScore: 70 },
  { rank: 8, teamName: "Punt City", owner: "tankCommander", points: 1156.9, change: 1, trend: "up" as const, strength: "2026 draft capital", risk: "Worst roster now", aiScore: 65 },
];

export default function RankingsClient() {
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
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">NFL Week 7 Power Rankings</h2>
            <p className="text-gray-400">Last updated 47 minutes ago &bull; 12-team PPR league</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-cyan-600/40 hover:bg-cyan-950/40">
              Export CSV
            </Button>
            <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
              Refresh AI Analysis
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Users className="h-6 w-6 text-cyan-400" />
                League Standings + AI Power
              </CardTitle>
              <CardDescription>
                Sorted by AI-adjusted power score (current performance + rest-of-season projection)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-cyan-900/50 hover:bg-transparent">
                      <TableHead className="w-16 text-center">Rank</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="text-center">Change</TableHead>
                      <TableHead className="hidden md:table-cell">AI Score</TableHead>
                      <TableHead className="hidden lg:table-cell">Strength</TableHead>
                      <TableHead className="hidden lg:table-cell">Risk</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockRankings.map((team, i) => (
                      <motion.tr
                        key={team.teamName}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                        className={cn(
                          "border-b border-cyan-900/30 transition-colors hover:bg-cyan-950/20",
                          i === 0 && "bg-gradient-to-r from-cyan-950/40 to-purple-950/20"
                        )}
                      >
                        <TableCell className="text-center font-bold text-lg">
                          {team.rank === 1 && <span className="text-amber-400">{team.rank}</span>}
                          {team.rank === 2 && <span className="text-slate-300">{team.rank}</span>}
                          {team.rank === 3 && <span className="text-orange-400">{team.rank}</span>}
                          {team.rank > 3 && team.rank}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{team.teamName}</div>
                            <div className="text-xs text-slate-500">{team.owner}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{team.points.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {team.change !== 0 && (
                              <span className={team.trend === "up" ? "text-green-400" : "text-red-400"}>
                                {team.change > 0 ? `+${team.change}` : team.change}
                              </span>
                            )}
                            {team.change === 0 && <span className="text-slate-500">&mdash;</span>}
                            {team.trend === "up" && <TrendingUp className="h-4 w-4 text-green-400" />}
                            {team.trend === "down" && <TrendingUp className="h-4 w-4 rotate-180 text-red-400" />}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center">
                          <span className={cn(
                            "font-bold",
                            team.aiScore >= 90 ? "text-cyan-300" :
                            team.aiScore >= 80 ? "text-green-300" :
                            team.aiScore >= 70 ? "text-yellow-300" :
                            "text-orange-300"
                          )}>
                            {team.aiScore}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="border-green-600/40 bg-green-950/30 text-green-300">
                            {team.strength}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="outline" className="border-orange-600/40 bg-orange-950/30 text-orange-300">
                            {team.risk}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40">
                            Details
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockRankings.slice(0, 3).map((team, i) => (
            <motion.div
              key={team.teamName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + 0.1 * i }}
            >
              <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{team.teamName}</span>
                    <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-transparent">#{team.rank}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-300">
                    <strong>AI Take:</strong>{' '}
                    {team.rank === 1 && "Dominant roster with elite RB depth. Projected to hold #1 through Week 10 if QB stays healthy."}
                    {team.rank === 2 && "WR corps is carrying this team. Watch the bye weeks in Week 9-10 \u2014 could drop 2-3 spots without smart streaming."}
                    {team.rank === 3 && "Streaming defense strategy is working now but gets harder post-Week 10. Consider trading for a set-and-forget D/ST."}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
