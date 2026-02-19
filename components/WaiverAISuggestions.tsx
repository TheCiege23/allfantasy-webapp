'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { PlayerAutocomplete } from '@/components/PlayerAutocomplete';
import { useAI } from '@/hooks/useAI';
import { Loader2, Plus, X, TrendingUp, AlertTriangle, Lightbulb, DollarSign } from 'lucide-react';

type Player = {
  id: string;
  name: string;
  position: string;
  team: string | null;
};

type WaiverAdd = {
  player_name: string;
  position: string;
  team?: string;
  tier?: string;
  priority_rank: number;
  reasoning?: string;
  faab_bid_recommendation?: number | null;
  drop_candidate?: string;
  player_id?: string;
  ai?: any;
};

type WaiverResult = {
  summary: string;
  top_adds: WaiverAdd[];
  strategy_notes: {
    faab_strategy?: string;
    priority_strategy?: string;
    timing_notes: string;
  };
  bench_optimization_tips: string[];
  risk_flags: string[];
};

export default function WaiverAISuggestions() {
  const [format, setFormat] = useState<'redraft' | 'dynasty' | 'keeper'>('redraft');
  const [waiverType, setWaiverType] = useState<'FAAB' | 'ROLLING' | 'PRIORITY'>('FAAB');
  const [currentWeek, setCurrentWeek] = useState(8);
  const [totalFaab, setTotalFaab] = useState(100);
  const [faabRemaining, setFaabRemaining] = useState(75);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  const [benchPlayers, setBenchPlayers] = useState<Player[]>([]);
  const [waiverPool, setWaiverPool] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WaiverResult | null>(null);

  function addPlayer(side: 'roster' | 'bench' | 'waiver', player: Player | null) {
    if (!player) return;
    if (side === 'roster') setRosterPlayers(prev => [...prev, player]);
    else if (side === 'bench') setBenchPlayers(prev => [...prev, player]);
    else setWaiverPool(prev => [...prev, player]);
  }

  function removePlayer(side: 'roster' | 'bench' | 'waiver', id: string) {
    if (side === 'roster') setRosterPlayers(prev => prev.filter(p => p.id !== id));
    else if (side === 'bench') setBenchPlayers(prev => prev.filter(p => p.id !== id));
    else setWaiverPool(prev => prev.filter(p => p.id !== id));
  }

  function PlayerBadges({ side, players }: { side: 'roster' | 'bench' | 'waiver'; players: Player[] }) {
    return (
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {players.length === 0 && (
          <span className="text-xs text-gray-500 italic">None added</span>
        )}
        {players.map(p => (
          <Badge
            key={p.id}
            variant="outline"
            className="gap-1.5 py-1 px-2.5 border-cyan-500/40 text-cyan-300 bg-cyan-950/20 text-xs"
          >
            {p.name} ({p.position})
            <button onClick={() => removePlayer(side, p.id)} className="ml-1 hover:text-red-400">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    );
  }

  async function handleAnalyze() {
    if (rosterPlayers.length === 0) {
      toast.error('Add at least one roster player');
      return;
    }
    if (waiverPool.length === 0) {
      toast.error('Add at least one waiver pool player to analyze');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/waiver-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          league: {
            league_id: 'manual-entry',
            format,
            sport: 'NFL',
            waiver_type: waiverType,
            current_week: currentWeek,
            total_faab: waiverType === 'FAAB' ? totalFaab : undefined,
          },
          team: {
            team_id: 'my-team',
            roster: rosterPlayers.map(p => ({ name: p.name, position: p.position, team: p.team || '' })),
            bench: benchPlayers.map(p => ({ name: p.name, position: p.position, team: p.team || '' })),
            faab_remaining: waiverType === 'FAAB' ? faabRemaining : undefined,
          },
          waiver_pool: waiverPool.map(p => ({ name: p.name, position: p.position, team: p.team || '' })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Analysis failed');
        return;
      }

      setResult(data.data);
      toast.success('Waiver analysis complete!');
    } catch {
      toast.error('Failed to analyze waivers');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Format</Label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="redraft">Redraft</option>
            <option value="dynasty">Dynasty</option>
            <option value="keeper">Keeper</option>
          </select>
        </div>
        <div>
          <Label>Waiver Type</Label>
          <select
            value={waiverType}
            onChange={(e) => setWaiverType(e.target.value as any)}
            className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none"
          >
            <option value="FAAB">FAAB</option>
            <option value="ROLLING">Rolling</option>
            <option value="PRIORITY">Priority</option>
          </select>
        </div>
        <div>
          <Label>Current Week</Label>
          <Input
            type="number"
            value={currentWeek}
            onChange={(e) => setCurrentWeek(parseInt(e.target.value) || 1)}
            className="border-purple-600/40 bg-gray-900 focus:border-purple-500"
          />
        </div>
      </div>

      {waiverType === 'FAAB' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Total FAAB Budget</Label>
            <Input
              type="number"
              value={totalFaab}
              onChange={(e) => setTotalFaab(parseInt(e.target.value) || 0)}
              className="border-purple-600/40 bg-gray-900"
            />
          </div>
          <div>
            <Label>Your FAAB Remaining</Label>
            <Input
              type="number"
              value={faabRemaining}
              onChange={(e) => setFaabRemaining(parseInt(e.target.value) || 0)}
              className="border-purple-600/40 bg-gray-900"
            />
          </div>
        </div>
      )}

      <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-cyan-400">Your Roster</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlayerBadges side="roster" players={rosterPlayers} />
          <PlayerAutocomplete
            value={null}
            onChange={(p) => addPlayer('roster', p)}
            placeholder="Search starter to add..."
          />
        </CardContent>
      </Card>

      <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-purple-400">Your Bench</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlayerBadges side="bench" players={benchPlayers} />
          <PlayerAutocomplete
            value={null}
            onChange={(p) => addPlayer('bench', p)}
            placeholder="Search bench player to add..."
          />
        </CardContent>
      </Card>

      <Card className="border-amber-900/30 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-amber-400">Waiver Pool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PlayerBadges side="waiver" players={waiverPool} />
          <PlayerAutocomplete
            value={null}
            onChange={(p) => addPlayer('waiver', p)}
            placeholder="Search available player to evaluate..."
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleAnalyze}
        disabled={loading || rosterPlayers.length === 0 || waiverPool.length === 0}
        size="lg"
        className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
      >
        {loading ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Analyzing Waivers...</>
        ) : (
          'Analyze Waivers'
        )}
      </Button>

      {result && (
        <div className="space-y-6">
          <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-cyan-400">
                <TrendingUp className="h-5 w-5" />
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{result.summary}</p>
            </CardContent>
          </Card>

          {result.top_adds.length > 0 && (
            <Card className="border-green-900/30 bg-black/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-green-400">Top Adds</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.top_adds.map((add, i) => (
                  <div
                    key={`${add.player_name}-${i}`}
                    className="rounded-lg border border-white/10 bg-gray-900/60 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-600/20 text-green-400 border-green-500/30">
                          #{add.priority_rank}
                        </Badge>
                        <span className="font-semibold text-white">{add.player_name}</span>
                        <span className="text-xs text-gray-400">{add.position}{add.team ? ` - ${add.team}` : ''}</span>
                      </div>
                      {add.tier && (
                        <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-300">
                          {add.tier}
                        </Badge>
                      )}
                    </div>
                    {add.reasoning && (
                      <p className="text-sm text-gray-400 mb-2">{add.reasoning}</p>
                    )}
                    <div className="flex gap-4 text-sm">
                      {add.faab_bid_recommendation != null && (
                        <span className="flex items-center gap-1 text-green-400">
                          <DollarSign className="h-3.5 w-3.5" />
                          FAAB: ${add.faab_bid_recommendation}
                        </span>
                      )}
                      {add.drop_candidate && (
                        <span className="text-red-400">Drop: {add.drop_candidate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-purple-400">
                <Lightbulb className="h-5 w-5" />
                Strategy Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.strategy_notes.faab_strategy && (
                <div>
                  <p className="text-xs font-semibold text-purple-300 mb-1">FAAB Strategy</p>
                  <p className="text-sm text-gray-300">{result.strategy_notes.faab_strategy}</p>
                </div>
              )}
              {result.strategy_notes.priority_strategy && (
                <div>
                  <p className="text-xs font-semibold text-purple-300 mb-1">Priority Strategy</p>
                  <p className="text-sm text-gray-300">{result.strategy_notes.priority_strategy}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-purple-300 mb-1">Timing</p>
                <p className="text-sm text-gray-300">{result.strategy_notes.timing_notes}</p>
              </div>
            </CardContent>
          </Card>

          {result.bench_optimization_tips.length > 0 && (
            <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg text-cyan-400">Bench Optimization</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.bench_optimization_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.risk_flags.length > 0 && (
            <Card className="border-red-900/30 bg-black/40 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.risk_flags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-300">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
