'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Hammer, Scale } from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { toast } from 'sonner';

type League = { id: string; name: string; sport: string; season: number };

export default function TradeFinderClient({ initialLeagues }: { initialLeagues: League[] }) {
  const { callAI, loading } = useAI<{ suggestions: any[] }>();
  const [leagueId, setLeagueId] = useState(initialLeagues[0]?.id || '');
  const [strategy, setStrategy] = useState<'win-now' | 'rebuild' | 'balanced'>('balanced');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const findTrades = async () => {
    if (!leagueId) return toast.error('Select a league first');

    const result = await callAI('/api/trade-finder', { leagueId, strategy });

    if (result.data?.suggestions) {
      setSuggestions(result.data.suggestions);
      toast.success(`Found ${result.data.suggestions.length} trade ideas!`);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row gap-4 items-stretch bg-gradient-to-r from-purple-950/80 to-black/80 p-4 rounded-xl border border-purple-500/30 backdrop-blur-md">
        <Select value={leagueId} onValueChange={setLeagueId}>
          <SelectTrigger className="flex-1 bg-gray-950 border-cyan-800">
            <SelectValue placeholder="Select League" />
          </SelectTrigger>
          <SelectContent>
            {initialLeagues.map(l => (
              <SelectItem key={l.id} value={l.id}>
                {l.name} ({l.sport} {l.season})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-3 flex-wrap">
          <Button
            variant={strategy === 'win-now' ? 'default' : 'outline'}
            onClick={() => setStrategy('win-now')}
            className="flex-1 gap-2 border-cyan-800"
          >
            <Trophy className="h-4 w-4" /> Win Now
          </Button>
          <Button
            variant={strategy === 'rebuild' ? 'default' : 'outline'}
            onClick={() => setStrategy('rebuild')}
            className="flex-1 gap-2 border-purple-800"
          >
            <Hammer className="h-4 w-4" /> Rebuild
          </Button>
          <Button
            variant={strategy === 'balanced' ? 'default' : 'outline'}
            onClick={() => setStrategy('balanced')}
            className="flex-1 gap-2 border-pink-800"
          >
            <Scale className="h-4 w-4" /> Balanced
          </Button>
        </div>
      </div>

      <Button
        onClick={findTrades}
        disabled={loading || !leagueId}
        className="w-full h-12 text-lg bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 hover:opacity-90"
      >
        {loading ? 'Searching for trades...' : 'Find Trades'}
      </Button>

      {suggestions.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((trade, i) => (
            <Card key={i} className="border-purple-900/40 bg-black/50 backdrop-blur-sm hover:border-purple-500/60 transition-all">
              <CardHeader>
                <CardTitle className="flex justify-between text-lg">
                  <span>Trade Idea #{i + 1}</span>
                  <span className="text-cyan-400 text-sm font-normal">{trade.partner}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm">
                  <div>
                    <p className="font-medium text-cyan-300">You give</p>
                    <p>{trade.youGive}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-purple-300">You get</p>
                    <p>{trade.youGet}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-400 border-t border-gray-800 pt-3">
                  {trade.reason}
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="outline" size="sm">Propose</Button>
                  <Button size="sm">Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 border border-dashed border-gray-700 rounded-2xl">
          Select a league & strategy, then click "Find Trades" to see AI-powered suggestions
        </div>
      )}
    </div>
  );
}
