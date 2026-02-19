'use client';

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TeamData {
  id: string;
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
  leagueName: string | null;
  leagueSport: string | null;
  leagueSeason: number | null;
  leagueScoring: string | null;
  leagueSize: number | null;
}

const mockRankings: TeamData[] = [
  { id: "m1", teamName: "Gridiron Gods", ownerName: "Cjabar", pointsFor: 1428.6, pointsAgainst: 1180.2, wins: 6, losses: 1, ties: 0, currentRank: 1, aiPowerScore: 92, projectedWins: 10.2, strengthNotes: "Elite RB depth", riskNotes: "QB injury prone", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m2", teamName: "Sleeper Agents", ownerName: "commissioner", pointsFor: 1389.2, pointsAgainst: 1210.5, wins: 5, losses: 2, ties: 0, currentRank: 2, aiPowerScore: 87, projectedWins: 9.1, strengthNotes: "WR corps on fire", riskNotes: "Bye week hell", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m3", teamName: "Touchdown Tyrants", ownerName: "ballerNJ", pointsFor: 1351.8, pointsAgainst: 1260.1, wins: 5, losses: 2, ties: 0, currentRank: 3, aiPowerScore: 84, projectedWins: 8.7, strengthNotes: "Streaming defense wins", riskNotes: "Low bench upside", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m4", teamName: "Jersey Jokers", ownerName: "you", pointsFor: 1297.4, pointsAgainst: 1290.0, wins: 4, losses: 3, ties: 0, currentRank: 4, aiPowerScore: 79, projectedWins: 7.5, strengthNotes: "Balanced roster", riskNotes: "Aging stars", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m5", teamName: "Draft Day Divas", ownerName: "queenB", pointsFor: 1265.1, pointsAgainst: 1275.0, wins: 3, losses: 4, ties: 0, currentRank: 5, aiPowerScore: 76, projectedWins: 6.8, strengthNotes: "TE advantage", riskNotes: "Thin at WR", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m6", teamName: "Waiver Warriors", ownerName: "pickupKing", pointsFor: 1242.7, pointsAgainst: 1310.2, wins: 3, losses: 4, ties: 0, currentRank: 6, aiPowerScore: 73, projectedWins: 6.2, strengthNotes: "Waiver wire gold", riskNotes: "No true WR1", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m7", teamName: "Dynasty Demons", ownerName: "longGame", pointsFor: 1198.3, pointsAgainst: 1340.0, wins: 2, losses: 5, ties: 0, currentRank: 7, aiPowerScore: 70, projectedWins: 5.1, strengthNotes: "Young core", riskNotes: "Not contending yet", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
  { id: "m8", teamName: "Punt City", ownerName: "tankCommander", pointsFor: 1156.9, pointsAgainst: 1380.5, wins: 1, losses: 6, ties: 0, currentRank: 8, aiPowerScore: 65, projectedWins: 3.8, strengthNotes: "2026 draft capital", riskNotes: "Worst roster now", avatarUrl: null, leagueName: null, leagueSport: null, leagueSeason: null, leagueScoring: null, leagueSize: null },
];

const aiTakes: Record<number, string> = {
  1: "Dominant roster with elite RB depth. Projected to hold #1 through Week 10 if QB stays healthy.",
  2: "WR corps is carrying this team. Watch the bye weeks in Week 9-10 \u2014 could drop 2-3 spots without smart streaming.",
  3: "Streaming defense strategy is working now but gets harder post-Week 10. Consider trading for a set-and-forget D/ST.",
};

interface RankingsClientProps {
  teams: TeamData[];
}

export default function RankingsClient({ teams }: RankingsClientProps) {
  const hasRealData = teams.length > 0;
  const displayTeams = hasRealData ? teams : mockRankings;

  const headerTitle = hasRealData
    ? `${displayTeams[0]?.leagueName || "Your League"} Power Rankings`
    : "Sample League Power Rankings";

  const headerSub = hasRealData
    ? `Season ${displayTeams[0]?.leagueSeason ?? ""} \u2022 ${displayTeams[0]?.leagueSport ?? "NFL"}${displayTeams[0]?.leagueScoring ? ` \u2022 ${displayTeams[0].leagueScoring.toUpperCase()}` : ""}${displayTeams[0]?.leagueSize ? ` \u2022 ${displayTeams[0].leagueSize}-team` : ""}`
    : "Mock data \u2013 connect Sleeper to see real leagues";

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
            <h2 className="text-2xl font-bold md:text-3xl">{headerTitle}</h2>
            <p className="text-gray-400">{headerSub}</p>
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
                      <TableHead className="text-center">Record</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead className="hidden md:table-cell text-center">AI Score</TableHead>
                      <TableHead className="hidden lg:table-cell">Strength</TableHead>
                      <TableHead className="hidden lg:table-cell">Risk</TableHead>
                      <TableHead className="w-32"></TableHead>
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
                          transition={{ delay: 0.1 * i }}
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
                              <div className="font-medium">{team.teamName}</div>
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
                          <TableCell>
                            <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40">
                              Details
                            </Button>
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
              <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm h-full">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{team.teamName}</span>
                    <Badge className="bg-purple-600 hover:bg-purple-700 text-white border-transparent">#{i + 1}</Badge>
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
      </div>
    </div>
  );
}
