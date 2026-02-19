'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Hammer, Scale, ExternalLink } from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PartnerMatchView from '@/components/PartnerMatchView';

type League = { id: string; name: string; sport: string; season: number; platformLeagueId: string; platform: string; isDynasty: boolean };

export default function TradeFinderClient({ initialLeagues }: { initialLeagues: League[] }) {
  const { callAI, loading, error } = useAI<{ recommendations?: any[]; suggestions?: any[]; candidates?: any[]; success?: boolean; meta?: any }>();
  const [leagueId, setLeagueId] = useState(initialLeagues[0]?.id || '');
  const [strategy, setStrategy] = useState<'win-now' | 'rebuild' | 'balanced'>('balanced');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [tab, setTab] = useState<'find' | 'partner'>('find');

  const selectedLeague = initialLeagues.find(l => l.id === leagueId);

  const NFL_TEAM_CITIES: Record<string, string> = {
    ARI: 'Glendale', ATL: 'Atlanta', BAL: 'Baltimore', BUF: 'Buffalo',
    CAR: 'Charlotte', CHI: 'Chicago', CIN: 'Cincinnati', CLE: 'Cleveland',
    DAL: 'Arlington', DEN: 'Denver', DET: 'Detroit', GB: 'Green Bay',
    HOU: 'Houston', IND: 'Indianapolis', JAX: 'Jacksonville', KC: 'Kansas City',
    LAC: 'Inglewood', LAR: 'Inglewood', LV: 'Las Vegas', MIA: 'Miami',
    MIN: 'Minneapolis', NE: 'Foxborough', NO: 'New Orleans', NYG: 'East Rutherford',
    NYJ: 'East Rutherford', PHI: 'Philadelphia', PIT: 'Pittsburgh', SEA: 'Seattle',
    SF: 'Santa Clara', TB: 'Tampa', TEN: 'Nashville', WAS: 'Landover',
  };

  const DOME_TEAMS = new Set(['ARI', 'ATL', 'DAL', 'DET', 'HOU', 'IND', 'LAC', 'LAR', 'LV', 'MIN', 'NO']);

  const enrichWithWeather = async (suggestion: any): Promise<any> => {
    const youGet = suggestion.youGet || '';
    const hasWeatherSensitive = /\bK\b|\bDEF\b|\bDST\b/i.test(youGet);
    if (!hasWeatherSensitive) return suggestion;

    const teamMatch = youGet.match(/\b([A-Z]{2,3})\b/);
    const teamAbbr = teamMatch?.[1];
    if (!teamAbbr || DOME_TEAMS.has(teamAbbr)) return suggestion;

    const city = NFL_TEAM_CITIES[teamAbbr];
    if (!city) return suggestion;

    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
    const dateStr = nextSunday.toISOString().split('T')[0];

    try {
      const res = await fetch(`/api/weather/game?city=${encodeURIComponent(city)}&date=${dateStr}`);
      if (!res.ok) return suggestion;
      const weather = await res.json();
      if (weather.rain > 5 || weather.windSpeed > 20) {
        return {
          ...suggestion,
          reason: suggestion.reason + ` (Weather warning: ${city} forecast shows ${weather.description} — wind ${Math.round(weather.windSpeed)} mph, rain ${weather.rain}". Consider avoiding outdoor K/DEF.)`,
        };
      }
    } catch {}
    return suggestion;
  };

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
          confidence: typeof rec.confidence === 'number' ? rec.confidence : rec.confidenceScore ?? null,
          winProbDelta: rec.winProbDelta || null,
          negotiation: rec.negotiation,
        };
      });
      const enriched = await Promise.all(mapped.map(enrichWithWeather));
      setSuggestions(enriched);
      toast.success(`Found ${enriched.length} trade ideas!`);
    } else if (result.data?.suggestions?.length) {
      const enriched = await Promise.all(result.data.suggestions.map(enrichWithWeather));
      setSuggestions(enriched);
      toast.success(`Found ${enriched.length} trade ideas!`);
    } else {
      setSuggestions([]);
      toast.info(result.data?.meta?.message || 'No trade opportunities found right now.');
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex rounded-xl overflow-hidden border border-purple-900/50 mb-2">
        <button
          onClick={() => setTab('find')}
          className={cn(
            'flex-1 py-4 px-6 text-center font-medium transition-all',
            tab === 'find' ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white' : 'bg-black/40 text-gray-400 hover:text-gray-200'
          )}
        >
          Find Trades
        </button>
        <button
          onClick={() => setTab('partner')}
          className={cn(
            'flex-1 py-4 px-6 text-center font-medium transition-all',
            tab === 'partner' ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white' : 'bg-black/40 text-gray-400 hover:text-gray-200'
          )}
        >
          Partner Match
        </button>
      </div>

      {tab === 'partner' ? (
        <PartnerMatchView leagueId={selectedLeague?.platformLeagueId || ''} strategy={strategy} />
      ) : (<>
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
                {(trade.confidence != null || trade.winProbDelta) && (
                  <div className="flex justify-between text-sm mt-3 pt-3 border-t border-gray-800">
                    {trade.confidence != null && (
                      <div>
                        <span className="text-gray-400">Confidence:</span>
                        <span className={cn(
                          'ml-1 font-bold',
                          trade.confidence >= 75 ? 'text-green-400' :
                          trade.confidence >= 50 ? 'text-yellow-400' :
                          trade.confidence >= 25 ? 'text-orange-400' : 'text-gray-400'
                        )}>
                          {trade.confidence}%
                        </span>
                      </div>
                    )}
                    {trade.winProbDelta && (
                      <div>
                        <span className="text-gray-400">Win &#916;:</span>
                        <span className={cn(
                          'ml-1 font-bold',
                          trade.winProbDelta.startsWith('+') ? 'text-green-400' :
                          trade.winProbDelta.startsWith('-') ? 'text-red-400' : 'text-gray-300'
                        )}>
                          {trade.winProbDelta}
                        </span>
                      </div>
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
                    className="bg-cyan-600 hover:bg-cyan-700 border-cyan-600 text-white gap-1.5"
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
                          const deepLink = `https://sleeper.app/leagues/${selectedLeague.platformLeagueId}/trade`;
                          window.open(data.sleeperDeepLink || deepLink, '_blank');
                          toast.info('Opening Sleeper — start the trade there!');
                        } else {
                          toast.error(data.error || 'Failed to save proposal');
                        }
                      } catch {
                        toast.error('Failed to send proposal');
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Propose in Sleeper
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
      </>)}
    </div>
  );
}
