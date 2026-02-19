'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, TrendingUp, ArrowRightLeft } from 'lucide-react';

type Match = {
  teamName: string;
  needs: string[];
  yourOffer: string;
  theirOffer: string;
  matchScore: number;
  record: string;
};

export default function PartnerMatchView({ leagueId, strategy }: { leagueId: string; strategy: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trade-partner-match?leagueId=${encodeURIComponent(leagueId)}&strategy=${strategy}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to find trade partners.');
        return;
      }
      setMatches(data.matches || []);
    } catch {
      setError('Failed to find trade partners.');
    } finally {
      setLoading(false);
    }
  }, [leagueId, strategy]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-purple-900/20 bg-black/30 backdrop-blur-sm">
            <CardContent className="p-6 space-y-3">
              <div className="h-6 w-3/4 bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-700 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400 text-center py-12">{error}</div>;
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 border border-dashed border-gray-700 rounded-2xl">
        No strong trade partners found right now. Try a different league or strategy.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match, i) => (
        <Card key={i} className="border-cyan-900/40 bg-black/50 backdrop-blur-sm hover:border-teal-500/60 transition-all">
          <CardContent className="p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                {match.teamName}
              </h3>
              <span className={`text-sm font-bold ${scoreColor(match.matchScore)}`}>
                {match.matchScore}/100
              </span>
            </div>
            {match.record && (
              <p className="text-xs text-gray-500">{match.record}</p>
            )}
            <p className="text-sm text-gray-300">
              <span className="text-gray-500">Needs:</span> {match.needs.length > 0 ? match.needs.join(', ') : 'No clear needs'}
            </p>
            <div className="flex items-start gap-1.5 text-sm text-green-300">
              <TrendingUp className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>You could offer: {match.yourOffer}</span>
            </div>
            <div className="flex items-start gap-1.5 text-sm text-purple-300 border-t border-gray-800 pt-2">
              <ArrowRightLeft className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>They could offer: {match.theirOffer}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
