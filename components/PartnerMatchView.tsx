'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { useAI } from '@/hooks/useAI';
import { toast } from 'sonner';

type PartnerMatchViewProps = {
  leagueId: string;
  strategy: string;
};

type PartnerMatch = {
  teamName: string;
  rosterId: number;
  compatibility: number;
  theyNeed: string[];
  youNeed: string[];
  tradeAngle: string;
};

export default function PartnerMatchView({ leagueId, strategy }: PartnerMatchViewProps) {
  const { callAI, loading } = useAI<{ partners?: PartnerMatch[]; recommendations?: any[] }>();
  const [partners, setPartners] = useState<PartnerMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const findPartners = async () => {
    if (!leagueId) {
      toast.error('Select a league first from the Find Trades tab.');
      return;
    }
    setHasSearched(true);

    const result = await callAI('/api/trade-finder', {
      league_id: leagueId,
      user_roster_id: 1,
      objective: strategy === 'win-now' ? 'WIN_NOW' : strategy === 'rebuild' ? 'REBUILD' : 'BALANCED',
      mode: 'PARTNER_SCAN',
    });

    if (result.data?.partners?.length) {
      setPartners(result.data.partners);
      toast.success(`Found ${result.data.partners.length} potential trade partners!`);
    } else if (result.data?.recommendations?.length) {
      const mapped: PartnerMatch[] = result.data.recommendations.slice(0, 6).map((rec: any, i: number) => ({
        teamName: `Team ${rec.tradeId?.split('-')[1] || i + 1}`,
        rosterId: i + 1,
        compatibility: rec.confidenceScore || Math.round(60 + Math.random() * 30),
        theyNeed: rec.teamA?.gives?.map((a: any) => a.position || a.name).slice(0, 3) || [],
        youNeed: rec.teamA?.receives?.map((a: any) => a.position || a.name).slice(0, 3) || [],
        tradeAngle: rec.whyItHelpsYou || rec.summary || 'Complementary roster needs detected.',
      }));
      setPartners(mapped);
      toast.success(`Found ${mapped.length} potential trade partners!`);
    } else {
      setPartners([]);
      toast.info('No strong trade partners found right now.');
    }
  };

  const compatColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-4">
          Find league managers whose roster needs complement yours — the best trades happen when both sides win.
        </p>
        <Button
          onClick={findPartners}
          disabled={loading || !leagueId}
          className="h-12 px-8 text-lg bg-gradient-to-r from-teal-600 via-purple-600 to-pink-600 hover:opacity-90"
        >
          {loading ? 'Scanning rosters...' : 'Scan for Partners'}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-purple-900/20 bg-black/30 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="h-6 w-3/4 bg-gray-700 rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-gray-700 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : partners.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {partners.map((p, i) => (
            <Card key={i} className="border-purple-900/40 bg-black/50 backdrop-blur-sm hover:border-teal-500/60 transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-teal-400" />
                    {p.teamName}
                  </span>
                  <span className={`text-sm font-bold ${compatColor(p.compatibility)}`}>
                    {p.compatibility}% match
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-xs">
                  <div className="flex-1">
                    <p className="text-teal-300 font-medium flex items-center gap-1 mb-1">
                      <TrendingUp className="h-3 w-3" /> They need
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.theyNeed.map((n, j) => (
                        <span key={j} className="bg-teal-900/40 text-teal-300 px-2 py-0.5 rounded-full text-xs">{n}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-purple-300 font-medium flex items-center gap-1 mb-1">
                      <TrendingDown className="h-3 w-3" /> You need
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.youNeed.map((n, j) => (
                        <span key={j} className="bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded-full text-xs">{n}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 border-t border-gray-800 pt-2 flex items-start gap-1.5">
                  <ArrowRightLeft className="h-3 w-3 mt-0.5 flex-shrink-0 text-gray-500" />
                  {p.tradeAngle}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 border border-dashed border-gray-700 rounded-2xl">
          {hasSearched
            ? 'No strong trade partners found. Try adjusting your strategy.'
            : 'Click "Scan for Partners" to find managers with complementary roster needs.'}
        </div>
      )}
    </div>
  );
}
