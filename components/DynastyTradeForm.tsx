'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, X, Loader2, TrendingUp, TrendingDown, ShieldAlert, Target, Crown } from 'lucide-react';

interface TradeAsset {
  id: string;
  name: string;
  type: 'player' | 'pick';
}

interface TradeResult {
  winner: string;
  winnerScore: number;
  loserScore: number;
  dynastyVerdict: string;
  analysis: string;
  teamAGrade: string;
  teamBGrade: string;
  vetoRisk: string;
  agingConcerns: string[];
  recommendations: string[];
  confidence: number;
}

export default function DynastyTradeForm() {
  const [teamAName, setTeamAName] = useState('Team A');
  const [teamBName, setTeamBName] = useState('Team B');
  const [teamAAssets, setTeamAAssets] = useState<TradeAsset[]>([]);
  const [teamBAssets, setTeamBAssets] = useState<TradeAsset[]>([]);
  const [teamAInput, setTeamAInput] = useState('');
  const [teamBInput, setTeamBInput] = useState('');
  const [teamAPickInput, setTeamAPickInput] = useState('');
  const [teamBPickInput, setTeamBPickInput] = useState('');
  const [leagueFormat, setLeagueFormat] = useState<'dynasty' | 'keeper'>('dynasty');
  const [qbFormat, setQbFormat] = useState<'1qb' | 'sf'>('sf');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);

  function addAsset(side: 'a' | 'b', name: string, type: 'player' | 'pick') {
    if (!name.trim()) return;
    const asset: TradeAsset = { id: `${Date.now()}-${Math.random()}`, name: name.trim(), type };
    if (side === 'a') {
      setTeamAAssets(prev => [...prev, asset]);
      type === 'player' ? setTeamAInput('') : setTeamAPickInput('');
    } else {
      setTeamBAssets(prev => [...prev, asset]);
      type === 'player' ? setTeamBInput('') : setTeamBPickInput('');
    }
  }

  function removeAsset(side: 'a' | 'b', id: string) {
    if (side === 'a') setTeamAAssets(prev => prev.filter(a => a.id !== id));
    else setTeamBAssets(prev => prev.filter(a => a.id !== id));
  }

  async function handleAnalyze() {
    if (teamAAssets.length === 0 || teamBAssets.length === 0) {
      toast.error('Both sides need at least one asset');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/dynasty-outlook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeMode: true,
          teamA: {
            name: teamAName,
            gives: teamAAssets.map(a => ({ name: a.name, type: a.type })),
          },
          teamB: {
            name: teamBName,
            gives: teamBAssets.map(a => ({ name: a.name, type: a.type })),
          },
          format: leagueFormat,
          qbFormat,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Analysis failed');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success && data.analysis) {
        setResult({
          winner: data.analysis.winner || 'Even',
          winnerScore: data.analysis.winnerScore || 50,
          loserScore: data.analysis.loserScore || 50,
          dynastyVerdict: data.analysis.dynastyVerdict || data.analysis.overallOutlook || '',
          analysis: data.analysis.analysis || data.analysis.keyRecommendation || '',
          teamAGrade: data.analysis.teamAGrade || 'B',
          teamBGrade: data.analysis.teamBGrade || 'B',
          vetoRisk: data.analysis.vetoRisk || 'low',
          agingConcerns: data.analysis.agingConcerns || [],
          recommendations: data.analysis.keyRecommendations || data.analysis.recommendations || [],
          confidence: data.analysis.confidence || data.analysis.confidenceScore || 70,
        });
      }
    } catch {
      toast.error('Failed to analyze trade');
    } finally {
      setLoading(false);
    }
  }

  function AssetList({ side, assets }: { side: 'a' | 'b'; assets: TradeAsset[] }) {
    return (
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {assets.length === 0 && (
          <span className="text-sm text-gray-500 italic">No assets added yet</span>
        )}
        {assets.map(asset => (
          <Badge
            key={asset.id}
            variant="outline"
            className={`gap-1.5 py-1.5 px-3 ${
              asset.type === 'player'
                ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/20'
                : 'border-amber-500/40 text-amber-300 bg-amber-950/20'
            }`}
          >
            {asset.type === 'pick' && '📋 '}
            {asset.name}
            <button onClick={() => removeAsset(side, asset.id)} className="ml-1 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  }

  function gradeColor(grade: string) {
    if (grade.startsWith('A')) return 'text-green-400 border-green-500/40 bg-green-950/20';
    if (grade.startsWith('B')) return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20';
    if (grade.startsWith('C')) return 'text-yellow-400 border-yellow-500/40 bg-yellow-950/20';
    if (grade.startsWith('D')) return 'text-orange-400 border-orange-500/40 bg-orange-950/20';
    return 'text-red-400 border-red-500/40 bg-red-950/20';
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>League Format</Label>
          <select
            value={leagueFormat}
            onChange={(e) => setLeagueFormat(e.target.value as 'dynasty' | 'keeper')}
            className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="dynasty">Dynasty</option>
            <option value="keeper">Keeper</option>
          </select>
        </div>
        <div>
          <Label>QB Format</Label>
          <select
            value={qbFormat}
            onChange={(e) => setQbFormat(e.target.value as '1qb' | 'sf')}
            className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="sf">Superflex (2QB)</option>
            <option value="1qb">1QB</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full bg-cyan-400" />
              <Input
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                className="border-none bg-transparent p-0 text-lg font-bold focus:ring-0 h-auto"
                placeholder="Team A"
              />
              <span className="text-sm text-gray-500 font-normal">gives</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssetList side="a" assets={teamAAssets} />
            <div className="flex gap-2">
              <Input
                placeholder="Player name"
                value={teamAInput}
                onChange={(e) => setTeamAInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAsset('a', teamAInput, 'player')}
                className="border-cyan-600/30 bg-gray-900 focus:border-cyan-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addAsset('a', teamAInput, 'player')}
                className="border-cyan-600/40 text-cyan-400 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Draft pick (e.g. 2026 1st early)"
                value={teamAPickInput}
                onChange={(e) => setTeamAPickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAsset('a', teamAPickInput, 'pick')}
                className="border-amber-600/30 bg-gray-900 focus:border-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addAsset('a', teamAPickInput, 'pick')}
                className="border-amber-600/40 text-amber-400 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="h-3 w-3 rounded-full bg-purple-400" />
              <Input
                value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)}
                className="border-none bg-transparent p-0 text-lg font-bold focus:ring-0 h-auto"
                placeholder="Team B"
              />
              <span className="text-sm text-gray-500 font-normal">gives</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssetList side="b" assets={teamBAssets} />
            <div className="flex gap-2">
              <Input
                placeholder="Player name"
                value={teamBInput}
                onChange={(e) => setTeamBInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAsset('b', teamBInput, 'player')}
                className="border-purple-600/30 bg-gray-900 focus:border-purple-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addAsset('b', teamBInput, 'player')}
                className="border-purple-600/40 text-purple-400 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Draft pick (e.g. 2026 2nd mid)"
                value={teamBPickInput}
                onChange={(e) => setTeamBPickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAsset('b', teamBPickInput, 'pick')}
                className="border-amber-600/30 bg-gray-900 focus:border-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addAsset('b', teamBPickInput, 'pick')}
                className="border-amber-600/40 text-amber-400 shrink-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleAnalyze}
          disabled={loading || teamAAssets.length === 0 || teamBAssets.length === 0}
          size="lg"
          className="bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 hover:from-cyan-600 hover:via-purple-700 hover:to-pink-700 px-12"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing Dynasty Value...</>
          ) : (
            <><ArrowLeftRight className="mr-2 h-5 w-5" /> Analyze Trade</>
          )}
        </Button>
      </div>

      {result && (
        <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Crown className="h-6 w-6 text-yellow-400" />
              Dynasty Trade Verdict
            </CardTitle>
            <CardDescription>
              Confidence: {result.confidence}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 to-cyan-950/40 p-6">
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-1">Winner</p>
                <p className="text-3xl font-bold text-white mb-2">{result.winner}</p>
                <p className="text-gray-300">{result.dynastyVerdict}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-gray-900/60 p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">{teamAName} Grade</p>
                <Badge className={`text-2xl px-4 py-1 ${gradeColor(result.teamAGrade)}`}>
                  {result.teamAGrade}
                </Badge>
              </div>
              <div className="rounded-lg border border-white/10 bg-gray-900/60 p-4 text-center">
                <p className="text-sm text-gray-400 mb-2">{teamBName} Grade</p>
                <Badge className={`text-2xl px-4 py-1 ${gradeColor(result.teamBGrade)}`}>
                  {result.teamBGrade}
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-gray-900/60 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 text-yellow-400" />
                <span className="text-sm font-semibold text-yellow-400">Veto Risk</span>
              </div>
              <Badge variant="outline" className={`${
                result.vetoRisk === 'high' ? 'border-red-500 text-red-400' :
                result.vetoRisk === 'medium' ? 'border-yellow-500 text-yellow-400' :
                'border-green-500 text-green-400'
              }`}>
                {result.vetoRisk.charAt(0).toUpperCase() + result.vetoRisk.slice(1)}
              </Badge>
            </div>

            {result.analysis && (
              <div className="rounded-lg border border-cyan-900/30 bg-gray-900/60 p-4">
                <p className="text-sm font-semibold text-cyan-400 mb-2">Analysis</p>
                <p className="text-gray-300">{result.analysis}</p>
              </div>
            )}

            {result.agingConcerns.length > 0 && (
              <div className="rounded-lg border border-orange-900/30 bg-gray-900/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">Aging Concerns</span>
                </div>
                <ul className="space-y-1">
                  {result.agingConcerns.map((c, i) => (
                    <li key={i} className="text-sm text-gray-400">- {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="rounded-lg border border-green-900/30 bg-gray-900/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Recommendations</span>
                </div>
                <ul className="space-y-1">
                  {result.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-300">- {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
