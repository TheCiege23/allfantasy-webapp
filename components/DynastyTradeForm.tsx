'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeftRight, Plus, X, Loader2, TrendingUp, Crown, Trash2 } from 'lucide-react';
import { PlayerAutocomplete } from '@/components/PlayerAutocomplete';
import { useAI } from '@/hooks/useAI';

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
  valueDelta: string;
  factors: string[];
  confidence: number;
  dynastyVerdict?: string;
  vetoRisk?: string;
  agingConcerns?: string[];
  recommendations?: string[];
}

export default function DynastyTradeForm() {
  const { callAI, loading } = useAI<{ analysis: TradeResult }>();

  const [teamAName, setTeamAName] = useState('Team A');
  const [teamBName, setTeamBName] = useState('Team B');
  const [teamAAssets, setTeamAAssets] = useState<TradeAsset[]>([]);
  const [teamBAssets, setTeamBAssets] = useState<TradeAsset[]>([]);
  const [teamAPickInput, setTeamAPickInput] = useState('');
  const [teamBPickInput, setTeamBPickInput] = useState('');
  const [leagueContext, setLeagueContext] = useState('12-team SF PPR dynasty');
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

    const sideADesc = teamAAssets.map(a => a.name).join(' + ');
    const sideBDesc = teamBAssets.map(a => a.name).join(' + ');

    const { data } = await callAI(
      '/api/dynasty-trade-analyzer',
      {
        sideA: sideADesc,
        sideB: sideBDesc,
        leagueContext,
      },
      { successMessage: 'Trade analyzed!' }
    );

    if (data?.analysis) {
      const a = data.analysis;
      setResult({
        winner: a.winner || 'Even',
        valueDelta: a.valueDelta || '',
        factors: Array.isArray(a.factors) ? a.factors : [],
        confidence: a.confidence || 70,
        dynastyVerdict: a.dynastyVerdict,
        vetoRisk: a.vetoRisk,
        agingConcerns: a.agingConcerns,
        recommendations: a.recommendations,
      });
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
            {asset.type === 'pick' && <span>📋 </span>}
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
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-300">League Context</label>
        <Textarea
          value={leagueContext}
          onChange={(e) => setLeagueContext(e.target.value)}
          placeholder="e.g. 12-team Superflex PPR dynasty, TE-premium, 1QB"
          className="bg-gray-950 border-gray-700 min-h-[60px]"
        />
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
                {result.valueDelta && (
                  <p className="text-gray-300 mt-2">{result.valueDelta}</p>
                )}
              </div>
            </div>

            {result.factors.length > 0 && (
              <div className="rounded-lg border border-cyan-900/30 bg-gray-900/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-semibold text-cyan-400">Key Factors</span>
                </div>
                <ul className="space-y-2">
                  {result.factors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.agingConcerns && result.agingConcerns.length > 0 && (
              <div className="rounded-lg border border-amber-900/30 bg-gray-900/60 p-4">
                <span className="text-sm font-semibold text-amber-400 mb-2 block">Aging Concerns</span>
                <ul className="space-y-1">
                  {result.agingConcerns.map((concern, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <div className="rounded-lg border border-green-900/30 bg-gray-900/60 p-4">
                <span className="text-sm font-semibold text-green-400 mb-2 block">Recommendations</span>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                      {rec}
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
