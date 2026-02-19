'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, X, Loader2, TrendingUp, Crown } from 'lucide-react';
import { PlayerAutocomplete } from '@/components/PlayerAutocomplete';

type Player = {
  id: string;
  name: string;
  position: string;
  team: string | null;
};

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
  const [teamAPickInput, setTeamAPickInput] = useState('');
  const [teamBPickInput, setTeamBPickInput] = useState('');
  const [leagueFormat, setLeagueFormat] = useState<'dynasty' | 'keeper'>('dynasty');
  const [qbFormat, setQbFormat] = useState<'1qb' | 'sf'>('sf');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);

  function addPlayerAsset(side: 'a' | 'b', player: Player | null) {
    if (!player) return;
    const asset: TradeAsset = { id: player.id, name: `${player.name} (${player.position})`, type: 'player' };
    if (side === 'a') {
      setTeamAAssets(prev => [...prev, asset]);
    } else {
      setTeamBAssets(prev => [...prev, asset]);
    }
  }

  function addPickAsset(side: 'a' | 'b', name: string) {
    if (!name.trim()) return;
    const asset: TradeAsset = { id: `${Date.now()}-${Math.random()}`, name: name.trim(), type: 'pick' };
    if (side === 'a') {
      setTeamAAssets(prev => [...prev, asset]);
      setTeamAPickInput('');
    } else {
      setTeamBAssets(prev => [...prev, asset]);
      setTeamBPickInput('');
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
      const sideADesc = teamAAssets.map(a => a.name).join(', ');
      const sideBDesc = teamBAssets.map(a => a.name).join(', ');
      const ctx = `${leagueFormat} ${qbFormat === 'sf' ? 'Superflex' : '1QB'} PPR`;

      const res = await fetch('/api/dynasty-trade-analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sideA: sideADesc,
          sideB: sideBDesc,
          leagueContext: ctx,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Analysis failed');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.analysis) {
        const a = data.analysis;
        setResult({
          winner: a.winner || 'Even',
          winnerScore: 0,
          loserScore: 0,
          dynastyVerdict: a.valueDelta || '',
          analysis: Array.isArray(a.factors) ? a.factors.join('\n') : (a.factors || ''),
          teamAGrade: '',
          teamBGrade: '',
          vetoRisk: 'low',
          agingConcerns: [],
          recommendations: [],
          confidence: a.confidence || 70,
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
            <PlayerAutocomplete
              value={null}
              onChange={(player) => addPlayerAsset('a', player)}
              placeholder="Search players to add..."
            />
            <div className="flex gap-2">
              <Input
                placeholder="Draft pick (e.g. 2026 1st early)"
                value={teamAPickInput}
                onChange={(e) => setTeamAPickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPickAsset('a', teamAPickInput)}
                className="border-amber-600/30 bg-gray-900 focus:border-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addPickAsset('a', teamAPickInput)}
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
            <PlayerAutocomplete
              value={null}
              onChange={(player) => addPlayerAsset('b', player)}
              placeholder="Search players to add..."
            />
            <div className="flex gap-2">
              <Input
                placeholder="Draft pick (e.g. 2026 2nd mid)"
                value={teamBPickInput}
                onChange={(e) => setTeamBPickInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPickAsset('b', teamBPickInput)}
                className="border-amber-600/30 bg-gray-900 focus:border-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => addPickAsset('b', teamBPickInput)}
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
                {result.dynastyVerdict && (
                  <p className="text-gray-300 mt-2">{result.dynastyVerdict}</p>
                )}
              </div>
            </div>

            {result.analysis && (
              <div className="rounded-lg border border-cyan-900/30 bg-gray-900/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">Key Factors</span>
                </div>
                <ul className="space-y-2">
                  {result.analysis.split('\n').filter(Boolean).map((factor, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      {factor}
                    </li>
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
