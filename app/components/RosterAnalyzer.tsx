'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Award,
  Clock,
  DollarSign,
  Loader2,
  AlertCircle,
  BarChart3,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

type RosterInsight = {
  title: string;
  description: string;
  score: number;
  category: string;
};

const categoryIcons: Record<string, any> = {
  star_power: Award,
  depth: BarChart3,
  youth: Clock,
  balance: Shield,
  momentum: TrendingUp,
  stability: Zap,
  info: AlertCircle,
};

const categoryColors: Record<string, string> = {
  star_power: 'text-yellow-400',
  depth: 'text-cyan-400',
  youth: 'text-emerald-400',
  balance: 'text-violet-400',
  momentum: 'text-orange-400',
  stability: 'text-blue-400',
  info: 'text-slate-400',
};

export default function RosterAnalyzer({ leagueId }: { leagueId?: string }) {
  const [insights, setInsights] = useState<RosterInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/roster/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagueId }),
        });

        if (res.status === 401) {
          setError('Sign in to view your Roster Legacy Report');
          return;
        }

        if (!res.ok) throw new Error('Failed to analyze roster');

        const data = await res.json();
        setInsights(data.insights || []);
        setMeta(data);

        if (data.message && (!data.insights || data.insights.length === 0)) {
          setError(data.message);
        }
      } catch (err: any) {
        const msg = err.message || 'Could not analyze roster';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [leagueId]);

  if (loading) {
    return (
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 p-8 border border-indigo-500/30 min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Analyzing your roster...</p>
        </div>
      </div>
    );
  }

  if (error || insights.length === 0) {
    return (
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 p-8 border border-indigo-500/30">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-orange-400" />
          <p className="text-slate-300 text-lg mb-2">
            {error || 'Sync a league to unlock your Roster Legacy Report'}
          </p>
          <p className="text-slate-500 text-sm">
            Head to League Sync to connect your first league
          </p>
        </div>
      </div>
    );
  }

  const overallScore = Math.round(
    insights.reduce((sum, i) => sum + i.score, 0) / insights.length
  );

  const scoreColor =
    overallScore >= 80
      ? 'text-emerald-400'
      : overallScore >= 60
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 md:p-8 border border-indigo-500/30 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Award className="w-7 h-7 text-yellow-400" />
            Roster Legacy Report
          </h2>
          {meta?.leagueName && (
            <p className="text-slate-500 text-sm mt-1">
              {meta.leagueName} &bull; {meta.matchedPlayers}/{meta.rosterSize} players matched
            </p>
          )}
          <p className="text-slate-400 mt-1">
            Overall Score:{' '}
            <span className={`text-2xl font-bold ${scoreColor}`}>
              {overallScore}/100
            </span>
          </p>
        </div>
        <div
          className={`text-5xl font-black ${scoreColor} bg-white/5 rounded-2xl w-20 h-20 flex items-center justify-center`}
        >
          {overallScore}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => {
          const Icon = categoryIcons[insight.category] || AlertTriangle;
          const color = categoryColors[insight.category] || 'text-slate-400';

          const barColor =
            insight.score >= 80
              ? 'bg-emerald-500'
              : insight.score >= 60
              ? 'bg-yellow-500'
              : 'bg-red-500';

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-cyan-500/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon className={`w-6 h-6 ${color}`} />
                <h3 className="text-lg font-bold">{insight.title}</h3>
              </div>
              <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                {insight.description}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <motion.div
                    className={`h-2 rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${insight.score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 + 0.3 }}
                  />
                </div>
                <span className="text-sm font-bold whitespace-nowrap w-12 text-right">
                  {insight.score}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-center text-slate-500 mt-8">
        Powered by synced league data + FantasyCalc values + your feedback profile
      </p>
    </div>
  );
}
