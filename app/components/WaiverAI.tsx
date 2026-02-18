'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { gtagEvent } from '@/lib/gtag';

type WaiverSuggestion = {
  playerName: string;
  rank: number;
  score: number;
  reason: string[];
  projectedPoints: number;
  faabBidRecommendation: number | null;
  sensitivityNote: string | null;
};

export default function WaiverAI() {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WaiverSuggestion[]>([]);
  const [error, setError] = useState('');

  const [userRoster, setUserRoster] = useState('');
  const [userContention, setUserContention] = useState<'win-now' | 'contender' | 'rebuild' | 'unknown'>('unknown');
  const [userFAAB, setUserFAAB] = useState(100);
  const [useRealTimeNews, setUseRealTimeNews] = useState(true);

  const generateWaiverSuggestions = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);

    try {
      const res = await fetch('/api/waiver-ai/grok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRoster,
          userContention,
          userFAAB,
          useRealTimeNews,
          leagueSize: 12,
          scoring: 'ppr',
          isDynasty: true,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch suggestions');

      const parsed = await res.json();
      setSuggestions(parsed.suggestions || []);
      toast.success('Waiver gems found!');
      gtagEvent('waiver_ai_suggestions_generated', { count: parsed.suggestions?.length || 0 });
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      toast.error('Failed to load waiver suggestions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-indigo-500/30 p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-cyan-400" />
          <h2 className="text-2xl font-bold">Waiver Wire AI</h2>
        </div>
        <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-300">League-Aware</span>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <label className="block text-sm font-medium mb-2">Your Roster (paste or key players)</label>
          <textarea
            value={userRoster}
            onChange={(e) => setUserRoster(e.target.value)}
            placeholder="QB: Josh Allen&#10;RB: Bijan Robinson, Breece Hall...&#10;FAAB: 87%"
            className="w-full h-32 rounded-2xl bg-slate-800 border border-slate-700 p-4 text-sm resize-y focus:border-cyan-400 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Contention Window</label>
            <select
              value={userContention}
              onChange={(e) => setUserContention(e.target.value as any)}
              className="w-full rounded-2xl bg-slate-800 border border-slate-700 p-4 text-sm focus:border-cyan-400 outline-none"
            >
              <option value="unknown">Not sure</option>
              <option value="win-now">Win-Now</option>
              <option value="contender">Building Contender</option>
              <option value="rebuild">Rebuild</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">FAAB Remaining</label>
            <input
              type="number"
              value={userFAAB}
              onChange={(e) => setUserFAAB(parseInt(e.target.value) || 100)}
              className="w-full rounded-2xl bg-slate-800 border border-slate-700 p-4 text-sm focus:border-cyan-400 outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useRealTimeNews}
            onChange={(e) => setUseRealTimeNews(e.target.checked)}
            className="w-5 h-5 accent-cyan-400"
          />
          <span className="text-sm">Include latest injuries, news & rookie buzz</span>
        </label>
      </div>

      <button
        onClick={generateWaiverSuggestions}
        disabled={loading || !userRoster.trim()}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold shadow-lg disabled:opacity-50 transition-all"
      >
        {loading ? 'Scanning Waivers...' : 'Find Hidden Gems'}
      </button>

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 text-cyan-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Thinking with real-time data...</span>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <div>Pulling FantasyCalc league-adjusted values</div>
            <div>Analyzing your roster needs & FAAB strategy</div>
            {useRealTimeNews && (
              <>
                <div>Searching X for injury/news impact</div>
                <div>Checking rookie hype & breakout candidates</div>
              </>
            )}
            <div>Ranking waiver targets for your build...</div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-bold">Top Waiver Targets</h3>
          {suggestions.map((sug, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-lg">{sug.playerName}</h4>
                  <p className="text-sm text-cyan-400">Rank #{sug.rank} &middot; Score: {sug.score}</p>
                </div>
                {sug.faabBidRecommendation != null && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm">
                    FAAB Bid: ${sug.faabBidRecommendation}
                  </span>
                )}
              </div>

              <ul className="space-y-2 text-sm">
                {sug.reason.map((r, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-cyan-400">&bull;</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              {sug.sensitivityNote && (
                <p className="mt-4 text-sm italic text-purple-300">
                  Note: {sug.sensitivityNote}
                </p>
              )}

              <div className="flex gap-4 mt-5 pt-4 border-t border-slate-700">
                <button className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300">
                  <ThumbsUp className="w-5 h-5" /> Helpful
                </button>
                <button className="flex items-center gap-2 text-red-400 hover:text-red-300">
                  <ThumbsDown className="w-5 h-5" /> Not helpful
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-900/30 border border-red-500/30 text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-1" />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
