'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Hammer, Scale } from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { toast } from 'sonner';

type League = { id: string; name: string; sport: string; season: number; platformLeagueId: string; platform: string; isDynasty: boolean };

export default function TradeFinderClient({ initialLeagues }: { initialLeagues: League[] }) {
  const { callAI, loading, error } = useAI<{ recommendations?: any[]; suggestions?: any[]; candidates?: any[]; success?: boolean; meta?: any }>();
  const [leagueId, setLeagueId] = useState(initialLeagues[0]?.id || '');
  const [strategy, setStrategy] = useState<'win-now' | 'rebuild' | 'balanced'>('balanced');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const selectedLeague = initialLeagues.find(l => l.id === leagueId);

  const objectiveMap: Record<string, string> = {
    'win-now': 'WIN_NOW',
    'rebuild': 'REBUILD',
    'balanced': 'BALANCED',
  };

  const findTrades = async () => {
    if (!leagueId || !selectedLeague) return toast.error('Select a league first');
    setHasSearched(true);

    const result = await callAI('/api/trade-finder', {
      league_id: selectedLeague.platformLeagueId,
      user_roster_id: 1,
      objective: objectiveMap[strategy] || 'BALANCED',
      mode: 'FAST',
    });

    if (result.data?.recommendations?.length) {
      const candidates = result.data.candidates || [];
      const mapped = result.data.recommendations.map((rec: any) => {
        const candidate = candidates.find((c: any) => c.tradeId === rec.tradeId);
        return {
          partner: `Team ${rec.tradeId?.split('-')[1] || '?'}`,
          partnerRosterId: candidate?.teamB?.teamId ? Number(candidate.teamB.teamId) : null,
          youGive: rec.teamA?.gives?.map((a: any) => a.name).join(' + ') || rec.summary || '',
          youGet: rec.teamA?.receives?.map((a: any) => a.name).join(' + ') || '',
          givesIds: rec.teamA?.gives?.map((a: any) => a.assetId) || [],
          receivesIds: rec.teamA?.receives?.map((a: any) => a.assetId) || [],
          reason: rec.whyItHelpsYou || rec.summary || rec.negotiationTip || '',
          confidence: rec.confidence,
          confidenceScore: rec.confidenceScore,
          negotiation: rec.negotiation,
        };
      });
      setSuggestions(mapped);
      toast.success(`Found ${mapped.length} trade ideas!`);
    } else if (result.data?.suggestions?.length) {
      setSuggestions(result.data.suggestions);
      toast.success(`Found ${result.data.suggestions.length} trade ideas!`);
    } else {
      setSuggestions([]);
      toast.info(result.data?.meta?.message || 'No trade opportunities found right now.');
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

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="border-purple-900/20 bg-black/30 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="h-6 w-3/4 bg-gray-700 rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-32 bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-48 bg-gray-700 rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-20 bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-gray-700 rounded animate-pulse" />
                <div className="flex gap-3 justify-end">
                  <div className="h-9 w-20 bg-gray-700 rounded animate-pulse" />
                  <div className="h-9 w-24 bg-gray-700 rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 border border-red-900/40 rounded-2xl bg-red-950/30">
          <p>{error}</p>
          <Button variant="outline" className="mt-6 border-red-800 text-red-300 hover:bg-red-950/50" onClick={findTrades}>
            Try Again
          </Button>
        </div>
      ) : suggestions.length > 0 ? (
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
                {trade.confidence && (
                  <div className="text-xs">
                    <span className={`font-medium ${
                      trade.confidence === 'HIGH' ? 'text-green-400' :
                      trade.confidence === 'MEDIUM' ? 'text-yellow-400' : 'text-gray-400'
                    }`}>
                      {trade.confidence} confidence
                    </span>
                    {trade.confidenceScore != null && (
                      <span className="text-gray-500 ml-2">({trade.confidenceScore}/100)</span>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-400 border-t border-gray-800 pt-3">
                  {trade.reason}
                </div>
                {trade.negotiation?.dmMessages?.[0] && (
                  <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                    <p className="text-xs text-gray-500 mb-1">Suggested DM:</p>
                    <p className="text-xs text-gray-300 italic">&ldquo;{trade.negotiation.dmMessages[0].message}&rdquo;</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700 border-cyan-600 text-white"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!selectedLeague) return;
                      try {
                        const res = await fetch('/api/trade/propose', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            leagueId: selectedLeague.platformLeagueId,
                            offerFrom: 1,
                            offerTo: trade.partnerRosterId || 0,
                            adds: trade.receivesIds || trade.youGet.split(' + '),
                            drops: trade.givesIds || trade.youGive.split(' + '),
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          toast.success('Trade saved! Open Sleeper to send it.');
                          if (data.sleeperDeepLink) {
                            window.open(data.sleeperDeepLink, '_blank');
                          }
                        } else {
                          toast.error(data.error || 'Failed to save proposal');
                        }
                      } catch {
                        toast.error('Failed to send proposal');
                      }
                    }}
                  >
                    Propose
                  </Button>
                  <Button size="sm">Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 border border-dashed border-gray-700 rounded-2xl">
          {hasSearched
            ? 'No trade opportunities found. Try a different strategy.'
            : 'Select a league & strategy, then click "Find Trades" to see AI-powered suggestions'}
        </div>
      )}
    </div>
  );
}
