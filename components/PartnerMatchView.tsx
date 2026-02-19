'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

export default function PartnerMatchView({ leagueId }: { leagueId: string }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    const fetchMatches = async () => {
      try {
        const res = await fetch(`/api/trade-partner-match?leagueId=${encodeURIComponent(leagueId)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load matches');

        setMatches(data.matches || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-cyan-900/20 bg-black/30">
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-red-400 border border-red-900/40 rounded-2xl bg-red-950/20">
        {error}
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        No strong partner matches found in this league yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {matches.map((match) => (
        <Card key={match.teamId || match.teamName} className="border-cyan-900/40 bg-black/50 backdrop-blur-sm hover:border-cyan-500/60 transition-colors">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-3">{match.teamName}</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Current roster needs:</p>
              <div className="flex flex-wrap gap-2">
                {(match.needs || []).map((need: string) => (
                  <span
                    key={need}
                    className="px-3 py-1 text-xs rounded-full bg-purple-950/60 border border-purple-700/50 text-purple-300"
                  >
                    {need}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">You could offer:</p>
              <p className="text-sm text-green-300">{match.yourOffer}</p>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Match strength:</span>
              <span className="font-bold text-cyan-400">{match.matchScore}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
