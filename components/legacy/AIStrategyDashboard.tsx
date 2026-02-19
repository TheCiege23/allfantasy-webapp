'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Target,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Sparkles,
  Download,
} from 'lucide-react';
import TeamArchetypeBadge from './TeamArchetypeBadge';

interface StrategyInsight {
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

interface StrategyResponse {
  archetype: string;
  archetypeScore: number;
  archetypeExplanation: string;
  winWindow: string;
  overallStrategy: string;
  buyTargets: Array<{ name: string; position: string; reason: string }>;
  sellTargets: Array<{ name: string; position: string; reason: string }>;
  holdTargets: Array<{ name: string; position: string; reason: string }>;
  keyInsights: StrategyInsight[];
  rosterGrade: string;
  immediateActions: string[];
  weeklyBrief: string;
  rosterMoves: string;
  waiverTargets: string;
  longTermPlan: string;
}

const priorityColors = {
  high: 'bg-red-950/60 text-red-300 border-red-800/40',
  medium: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  low: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
};

export default function AIStrategyDashboard({ userId }: { userId: string }) {
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState('outlook');

  const handleGenerate = async () => {
    if (!selectedLeagueId) {
      setError('Please enter a League ID to generate your strategy.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Strategy generation failed');
      }

      const data = await res.json();
      setStrategy(data.strategy);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    const element = document.getElementById('strategy-report');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { backgroundColor: '#0f0a24', scale: 2 });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`AllFantasy-AI-Strategy-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <input
          type="text"
          placeholder="Enter your League ID"
          value={selectedLeagueId}
          onChange={(e) => setSelectedLeagueId(e.target.value)}
          className="flex-1 bg-[#1a1238]/80 border border-cyan-900/40 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex gap-3">
          <Button
            onClick={handleGenerate}
            disabled={loading || !selectedLeagueId}
            className="bg-gradient-to-r from-amber-500 via-cyan-500 to-purple-600 hover:brightness-110 text-white font-bold py-6 px-8 text-lg rounded-2xl shadow-2xl shadow-purple-500/30"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate My AI Strategy Report
              </>
            )}
          </Button>
          {strategy && (
            <Button
              onClick={exportPDF}
              variant="outline"
              className="border-amber-400 text-amber-400 hover:bg-amber-950/30 py-6"
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-700 text-red-200 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-6">
          <Skeleton className="h-16 w-64" />
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {strategy && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="mb-6">
            <TeamArchetypeBadge
              archetype={strategy.archetype as any}
              score={strategy.archetypeScore}
              explanation={strategy.archetypeExplanation}
            />
          </div>

          <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 bg-[#1a1238]/70 backdrop-blur-lg border border-white/10 rounded-xl">
              <TabsTrigger value="outlook">Dynasty Outlook</TabsTrigger>
              <TabsTrigger value="weekly">Weekly Brief</TabsTrigger>
              <TabsTrigger value="roster">Roster Moves</TabsTrigger>
              <TabsTrigger value="waiver">Waiver AI</TabsTrigger>
              <TabsTrigger value="longterm">Long-Term Plan</TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {activeSubTab === 'outlook' && (
                <motion.div
                  key="outlook"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                  id="strategy-report"
                >
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white border-0">
                      {strategy.archetype}
                    </Badge>
                    <Badge variant="outline" className="text-lg px-4 py-2 border-cyan-500 text-cyan-300">
                      Win Window: {strategy.winWindow}
                    </Badge>
                    <Badge variant="outline" className="text-lg px-4 py-2 border-purple-500 text-purple-300">
                      Roster Grade: {strategy.rosterGrade}
                    </Badge>
                  </div>

                  <p className="text-gray-200 text-lg leading-relaxed mb-8">{strategy.overallStrategy}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-emerald-950/20 border-emerald-800/40">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-emerald-300 flex items-center gap-2 text-xl">
                          <TrendingUp className="h-5 w-5" />
                          Buy Targets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {strategy.buyTargets.map((t, i) => (
                          <div key={i} className="bg-emerald-950/30 rounded-lg p-3">
                            <div className="font-semibold text-white">
                              {t.name} <span className="text-emerald-400 text-sm">({t.position})</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1">{t.reason}</p>
                          </div>
                        ))}
                        {strategy.buyTargets.length === 0 && (
                          <p className="text-gray-500 italic">No buy targets identified</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-red-950/20 border-red-800/40">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-red-300 flex items-center gap-2 text-xl">
                          <TrendingDown className="h-5 w-5" />
                          Sell Targets
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {strategy.sellTargets.map((t, i) => (
                          <div key={i} className="bg-red-950/30 rounded-lg p-3">
                            <div className="font-semibold text-white">
                              {t.name} <span className="text-red-400 text-sm">({t.position})</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1">{t.reason}</p>
                          </div>
                        ))}
                        {strategy.sellTargets.length === 0 && (
                          <p className="text-gray-500 italic">No sell targets identified</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-cyan-950/20 border-cyan-800/40">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-cyan-300 flex items-center gap-2 text-xl">
                          <ShieldCheck className="h-5 w-5" />
                          Core Holds
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {strategy.holdTargets.map((t, i) => (
                          <div key={i} className="bg-cyan-950/30 rounded-lg p-3">
                            <div className="font-semibold text-white">
                              {t.name} <span className="text-cyan-400 text-sm">({t.position})</span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1">{t.reason}</p>
                          </div>
                        ))}
                        {strategy.holdTargets.length === 0 && (
                          <p className="text-gray-500 italic">No core holds identified</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {strategy.keyInsights?.length > 0 && (
                    <div className="mt-8">
                      <h4 className="text-xl font-semibold text-amber-300 mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Key Insights
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {strategy.keyInsights.map((insight, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                          >
                            <Card className={`border ${priorityColors[insight.priority]}`}>
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-white">{insight.title}</span>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {insight.priority}
                                  </Badge>
                                </div>
                                <p className="text-gray-300 text-sm mb-2">{insight.description}</p>
                                <p className="text-cyan-400 text-sm font-medium">{insight.action}</p>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {strategy.immediateActions?.length > 0 && (
                    <div className="mt-8 bg-[#1a1238]/60 border border-amber-900/40 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-amber-300 mb-3">Immediate Actions</h4>
                      <ol className="list-decimal pl-5 space-y-2">
                        {strategy.immediateActions.map((action, i) => (
                          <li key={i} className="text-gray-200">{action}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </motion.div>
              )}

              {activeSubTab === 'weekly' && (
                <motion.div
                  key="weekly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-2xl text-cyan-300">Weekly Brief</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.weeklyBrief ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.weeklyBrief}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg">Weekly briefing will appear here after generation.</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeSubTab === 'roster' && (
                <motion.div
                  key="roster"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-2xl text-purple-300">Roster Moves</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.rosterMoves ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.rosterMoves}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg">Roster move recommendations will appear here.</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeSubTab === 'waiver' && (
                <motion.div
                  key="waiver"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-2xl text-emerald-300">Waiver AI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.waiverTargets ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.waiverTargets}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg">Waiver wire targets will appear here.</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {activeSubTab === 'longterm' && (
                <motion.div
                  key="longterm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-8"
                >
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30">
                    <CardHeader>
                      <CardTitle className="text-2xl text-amber-300">Long-Term Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.longTermPlan ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.longTermPlan}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-lg">Long-term dynasty plan will appear here.</p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}
