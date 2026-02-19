'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, TrendingUp, Clock } from 'lucide-react';

interface TradeAsset {
  id: string;
  name: string;
  type: 'player' | 'pick';
}

interface TradeAnalysis {
  winner: string;
  valueDelta: string;
  confidence: number;
  teamAName?: string;
  teamBName?: string;
  leagueContext?: string;
}

interface TradeShareRecord {
  id: string;
  sideA: TradeAsset[];
  sideB: TradeAsset[];
  analysis: TradeAnalysis;
  createdAt: string;
}

export default function TradeHistoryFeed({ trades }: { trades: TradeShareRecord[] }) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-20">
        <TrendingUp className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No trade analyses yet.</p>
        <Link href="/dynasty-trade-analyzer" className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block">
          Analyze your first trade &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {trades.map((trade) => {
        const analysis = trade.analysis as TradeAnalysis;
        const sideA = (trade.sideA || []) as TradeAsset[];
        const sideB = (trade.sideB || []) as TradeAsset[];
        const teamA = analysis.teamAName || 'Team A';
        const teamB = analysis.teamBName || 'Team B';

        return (
          <Link key={trade.id} href={`/trade/${trade.id}`}>
            <Card className="border-gray-800 bg-black/40 hover:bg-black/60 transition-colors cursor-pointer mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white">{analysis.winner}</span>
                    <Badge variant="outline" className="text-xs border-cyan-800 text-cyan-400">
                      {analysis.valueDelta}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {new Date(trade.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{teamA} gives</p>
                    <div className="flex flex-wrap gap-1">
                      {sideA.slice(0, 3).map((asset) => (
                        <Badge
                          key={asset.id}
                          variant="outline"
                          className={`text-xs ${
                            asset.type === 'player'
                              ? 'border-cyan-500/30 text-cyan-300'
                              : 'border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {asset.name}
                        </Badge>
                      ))}
                      {sideA.length > 3 && (
                        <span className="text-xs text-gray-500">+{sideA.length - 3}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{teamB} gives</p>
                    <div className="flex flex-wrap gap-1">
                      {sideB.slice(0, 3).map((asset) => (
                        <Badge
                          key={asset.id}
                          variant="outline"
                          className={`text-xs ${
                            asset.type === 'player'
                              ? 'border-cyan-500/30 text-cyan-300'
                              : 'border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {asset.name}
                        </Badge>
                      ))}
                      {sideB.length > 3 && (
                        <span className="text-xs text-gray-500">+{sideB.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>

                {analysis.leagueContext && (
                  <p className="text-xs text-gray-600 mt-2">{analysis.leagueContext}</p>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
