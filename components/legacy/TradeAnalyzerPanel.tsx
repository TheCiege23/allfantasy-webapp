'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Download, Loader2, Clock, ArrowRightLeft } from 'lucide-react';
import TeamArchetypeBadge from './TeamArchetypeBadge';
import TradeBalanceViz from '@/components/TradeBalanceViz';
import CounterSuggestionCard from './CounterSuggestionCard';
import { Skeleton } from '@/components/ui/skeleton';

type AnalysisResult = {
  fairness: string;
  valueDelta: string;
  archetypeFit: string;
  verdict: string;
  confidence: number;
  keyRisks: string[];
  counterSuggestions: Array<{
    description: string;
    giveAdd: string[];
    getRemove: string[];
    estimatedDelta: string;
  }>;
  visualData: {
    giveValue: number;
    getValue: number;
    giveAge: number;
    getAge: number;
    givePositionalFit: number;
    getPositionalFit: number;
  };
};

type RecentAnalysis = {
  id: string;
  timestamp: string;
  give: any[];
  get: any[];
  analysis: AnalysisResult;
  archetypeData: any;
  leagueId: string;
};

export default function TradeAnalyzerPanel({
  leagueId,
  userRoster,
  futurePicksCount,
  givePlayers,
  getPlayers,
}: {
  leagueId: string;
  userRoster: any[];
  futurePicksCount: number;
  givePlayers: any[];
  getPlayers: any[];
}) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [archetypeData, setArchetypeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`tradeAnalyses_${leagueId}`);
      if (saved) setRecentAnalyses(JSON.parse(saved));
    } catch {}
  }, [leagueId]);

  const saveToLocalStorage = (newAnalysis: RecentAnalysis) => {
    const updated = [newAnalysis, ...recentAnalyses].slice(0, 8);
    setRecentAnalyses(updated);
    try {
      localStorage.setItem(`tradeAnalyses_${leagueId}`, JSON.stringify(updated));
    } catch {}
  };

  const loadRecent = (past: RecentAnalysis) => {
    setAnalysis(past.analysis);
    setArchetypeData(past.archetypeData);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/trade/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          give: givePlayers,
          get: getPlayers,
          leagueId,
          userRoster,
          futurePicksCount,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Analysis failed');
      }

      const data = await res.json();

      const result: RecentAnalysis = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        give: givePlayers,
        get: getPlayers,
        analysis: data.analysis,
        archetypeData: data.archetypeData,
        leagueId,
      };

      setAnalysis(data.analysis);
      setArchetypeData(data.archetypeData);
      saveToLocalStorage(result);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleShareImage = async () => {
    const element = document.getElementById('trade-verdict-panel');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { backgroundColor: null, scale: 2 });
      const link = document.createElement('a');
      link.download = `allfantasy-trade-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <div className="space-y-8">
      <Button
        onClick={handleAnalyze}
        disabled={loading || !givePlayers.length || !getPlayers.length}
        className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-purple-600 hover:brightness-110 text-white font-bold py-6 text-lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyzing Trade...
          </>
        ) : (
          'Run AI Trade Analysis'
        )}
      </Button>

      {recentAnalyses.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Clock className="h-4 w-4" /> Recent Analyses
          </div>
          <div className="flex gap-2 flex-wrap">
            {recentAnalyses.map((r) => (
              <Button
                key={r.id}
                variant="ghost"
                size="sm"
                onClick={() => loadRecent(r)}
                className="text-xs text-gray-300 hover:text-cyan-300 hover:bg-cyan-950/30"
              >
                {new Date(r.timestamp).toLocaleDateString()} — {r.give.length} ↔ {r.get.length}
              </Button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-700 text-red-200 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-8">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
            ))}
          </div>
        </div>
      )}

      {analysis && !loading && (
        <motion.div
          id="trade-verdict-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0f0a24] border border-cyan-900/40 rounded-2xl p-6 shadow-2xl shadow-purple-950/30"
        >
          {archetypeData && (
            <div className="mb-6">
              <TeamArchetypeBadge
                archetype={archetypeData.archetype}
                score={archetypeData.score}
                explanation={archetypeData.explanation}
              />
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-2xl font-bold text-white">{analysis.fairness.toUpperCase()}</h3>
              <Badge variant="outline" className="text-lg px-4 py-1 border-cyan-500 text-cyan-300">
                Confidence: {analysis.confidence}%
              </Badge>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                variant="secondary"
                className={`text-sm px-3 py-1 ${
                  analysis.valueDelta.startsWith('+')
                    ? 'bg-emerald-950/60 text-emerald-300'
                    : analysis.valueDelta.startsWith('-')
                    ? 'bg-red-950/60 text-red-300'
                    : 'bg-gray-800/60 text-gray-300'
                }`}
              >
                Value: {analysis.valueDelta}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-sm px-3 py-1 ${
                  analysis.archetypeFit === 'excellent' || analysis.archetypeFit === 'good'
                    ? 'bg-emerald-950/60 text-emerald-300'
                    : analysis.archetypeFit === 'poor' || analysis.archetypeFit === 'terrible'
                    ? 'bg-red-950/60 text-red-300'
                    : 'bg-amber-950/60 text-amber-300'
                }`}
              >
                Fit: {analysis.archetypeFit}
              </Badge>
            </div>

            <p className="text-gray-200 text-lg leading-relaxed">{analysis.verdict}</p>

            {analysis.keyRisks?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {analysis.keyRisks.map((risk, i) => (
                  <Badge key={i} variant="secondary" className="bg-red-950/60 text-red-300">
                    {risk}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {analysis.visualData && <TradeBalanceViz visualData={analysis.visualData} />}

          {analysis.counterSuggestions?.length > 0 && (
            <div className="mt-10">
              <h4 className="text-xl font-semibold text-amber-300 mb-4 flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Suggested Counters
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {analysis.counterSuggestions.map((sugg, i) => (
                  <CounterSuggestionCard
                    key={i}
                    suggestion={sugg}
                    leagueId={leagueId}
                    originalGive={givePlayers}
                    originalGet={getPlayers}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              variant="ghost"
              onClick={handleShareImage}
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40"
            >
              <Download className="mr-2 h-4 w-4" />
              Share as Image
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
