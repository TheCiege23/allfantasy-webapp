'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, TrendingUp, ArrowRightLeft } from 'lucide-react';

interface League {
  id: string;
  name: string | null;
  sport: string;
  season: number | null;
}

interface TradeSuggestion {
  targetPlayer: string;
  targetPosition: string;
  sendPlayers: string[];
  reasoning: string;
  fairnessScore: number;
  improvementArea: string;
}

export default function TradeFinderClient({ initialLeagues }: { initialLeagues: League[] }) {
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [strategy, setStrategy] = useState<string>('balanced');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TradeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const strategies = [
    { value: 'balanced', label: 'Balanced', desc: 'Fair trades that improve both teams' },
    { value: 'win-now', label: 'Win Now', desc: 'Target proven producers for this season' },
    { value: 'rebuild', label: 'Rebuild', desc: 'Acquire youth and draft capital' },
    { value: 'depth', label: 'Add Depth', desc: 'Fill weak roster spots' },
  ];

  async function findTrades() {
    if (!selectedLeague) return;
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch('/api/trade-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeague, strategy }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to find trades');
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="border-gray-800 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">Configure Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Select League</label>
            <select
              value={selectedLeague}
              onChange={(e) => setSelectedLeague(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Choose a league...</option>
              {initialLeagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name || 'Unnamed League'} ({league.sport} {league.season || ''})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Strategy</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {strategies.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStrategy(s.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    strategy === s.value
                      ? 'border-cyan-500 bg-cyan-950/30 text-white'
                      : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs mt-1 opacity-70">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={findTrades}
            disabled={!selectedLeague || loading}
            className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white py-6"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding trades...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Find Trade Opportunities
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-800/40 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Trade Suggestions ({suggestions.length})
          </h2>
          {suggestions.map((suggestion, i) => (
            <Card key={i} className="border-gray-800 bg-black/40 backdrop-blur-sm hover:border-gray-700 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                      <ArrowRightLeft className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{suggestion.targetPlayer}</p>
                      <p className="text-xs text-gray-400">{suggestion.targetPosition}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${
                      suggestion.fairnessScore >= 80
                        ? 'border-green-500/40 text-green-400'
                        : suggestion.fairnessScore >= 60
                        ? 'border-yellow-500/40 text-yellow-400'
                        : 'border-red-500/40 text-red-400'
                    }`}
                  >
                    {suggestion.fairnessScore}% Fair
                  </Badge>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">You would send:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestion.sendPlayers.map((p, j) => (
                      <Badge key={j} variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-3">{suggestion.reasoning}</p>

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-400">Improves: {suggestion.improvementArea}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && suggestions.length === 0 && selectedLeague && !error && (
        <p className="text-center text-gray-500 text-sm py-8">
          Select your strategy and click Find Trade Opportunities to get started.
        </p>
      )}
    </div>
  );
}
