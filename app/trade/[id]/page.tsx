import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Crown, AlertTriangle, CheckCircle } from 'lucide-react';

interface TradeAsset {
  id: string;
  name: string;
  type: 'player' | 'pick';
}

interface TradeAnalysis {
  winner: string;
  valueDelta: string;
  factors: string[];
  confidence: number;
  dynastyVerdict?: string;
  vetoRisk?: string;
  agingConcerns?: string[];
  recommendations?: string[];
}

export default async function TradeSharePage({ params }: { params: { id: string } }) {
  const share = await (prisma as any).tradeShare.findUnique({
    where: { id: params.id },
  });

  if (!share) notFound();

  const analysis = share.analysis as TradeAnalysis;
  const teamAAssets = (share.teamAAssets || []) as TradeAsset[];
  const teamBAssets = (share.teamBAssets || []) as TradeAsset[];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] py-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-2">
            AllFantasy Trade Analysis
          </h1>
          <p className="text-gray-400 text-sm">
            {share.leagueContext} &middot; {new Date(share.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div id="trade-result" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-3 w-3 rounded-full bg-cyan-400" />
                  {share.teamAName} gives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamAAssets.map((asset: TradeAsset) => (
                    <Badge
                      key={asset.id}
                      variant="outline"
                      className={`py-1.5 px-3 ${
                        asset.type === 'player'
                          ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20'
                          : 'border-amber-500/40 text-amber-300 bg-amber-950/20'
                      }`}
                    >
                      {asset.type === 'pick' && '📋 '}{asset.name}
                    </Badge>
                  ))}
                  {teamAAssets.length === 0 && <span className="text-sm text-gray-500 italic">No assets</span>}
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-3 w-3 rounded-full bg-purple-400" />
                  {share.teamBName} gives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teamBAssets.map((asset: TradeAsset) => (
                    <Badge
                      key={asset.id}
                      variant="outline"
                      className={`py-1.5 px-3 ${
                        asset.type === 'player'
                          ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20'
                          : 'border-amber-500/40 text-amber-300 bg-amber-950/20'
                      }`}
                    >
                      {asset.type === 'pick' && '📋 '}{asset.name}
                    </Badge>
                  ))}
                  {teamBAssets.length === 0 && <span className="text-sm text-gray-500 italic">No assets</span>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-gray-700/50 bg-black/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-400" />
                Analysis Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-400">Winner:</span>
                  <span className="ml-2 font-semibold text-white">{analysis.winner}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Value Delta:</span>
                  <span className="ml-2 font-semibold text-cyan-300">{analysis.valueDelta}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Confidence:</span>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${analysis.confidence}%` }}
                  />
                </div>
                <span className="text-sm text-white">{analysis.confidence}%</span>
              </div>

              {analysis.dynastyVerdict && (
                <div className="p-3 bg-purple-950/20 border border-purple-800/30 rounded-lg">
                  <span className="text-sm font-medium text-purple-300">Dynasty Verdict:</span>
                  <p className="text-sm text-gray-300 mt-1">{analysis.dynastyVerdict}</p>
                </div>
              )}

              {analysis.vetoRisk && (
                <div className="p-3 bg-red-950/20 border border-red-800/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-sm font-medium text-red-300">Veto Risk:</span>
                    <p className="text-sm text-gray-300 mt-1">{analysis.vetoRisk}</p>
                  </div>
                </div>
              )}

              {analysis.factors?.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-300 mb-2 block">Key Factors:</span>
                  <ul className="space-y-1">
                    {analysis.factors.map((f: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <TrendingUp className="h-3.5 w-3.5 text-cyan-400 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.agingConcerns && analysis.agingConcerns.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-amber-300 mb-2 block">Aging Concerns:</span>
                  <ul className="space-y-1">
                    {analysis.agingConcerns.map((c: string, i: number) => (
                      <li key={i} className="text-sm text-gray-400">⏳ {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-green-300 mb-2 block">Recommendations:</span>
                  <ul className="space-y-1">
                    {analysis.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                        <CheckCircle className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center pt-4">
            <a
              href="/dynasty-trade-analyzer"
              className="text-sm text-cyan-400 hover:text-cyan-300 underline"
            >
              Analyze your own trade on AllFantasy &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
