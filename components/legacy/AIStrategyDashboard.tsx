'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';
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
  MessageSquare,
  History,
  Send,
  Clock,
  Trophy,
  Shield,
  RefreshCw,
} from 'lucide-react';
import TeamArchetypeBadge from './TeamArchetypeBadge';
import LoadReportModal from './LoadReportModal';

interface StrategyInsight {
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action: string;
}

interface RadarProfile {
  qbStrength: number;
  rbDepth: number;
  wrYouth: number;
  tePremiumFit: number;
  futureCapital: number;
  contentionWindow: number;
}

interface TimelineEvent {
  year: string;
  label: string;
  subtext?: string;
  icon?: string;
}

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  trophy: <Trophy className="h-5 w-5 text-amber-400" />,
  shield: <Shield className="h-5 w-5 text-cyan-400" />,
  refresh: <RefreshCw className="h-5 w-5 text-purple-400" />,
};

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
  radarProfile?: RadarProfile;
  dynastyTimeline?: TimelineEvent[];
  weeklyBrief: string;
  rosterMoves: string;
  waiverTargets: string;
  longTermPlan: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const priorityColors = {
  high: 'bg-red-950/60 text-red-300 border-red-800/40',
  medium: 'bg-amber-950/60 text-amber-300 border-amber-800/40',
  low: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
};

function buildRadarData(profile?: RadarProfile) {
  if (!profile) {
    return [
      { subject: 'QB Strength', A: 50, leagueAvg: 70 },
      { subject: 'RB Depth', A: 50, leagueAvg: 65 },
      { subject: 'WR Youth', A: 50, leagueAvg: 75 },
      { subject: 'TE Fit', A: 50, leagueAvg: 60 },
      { subject: 'Future Capital', A: 50, leagueAvg: 50 },
      { subject: 'Contention Window', A: 50, leagueAvg: 72 },
    ];
  }
  return [
    { subject: 'QB Strength', A: profile.qbStrength, leagueAvg: 70 },
    { subject: 'RB Depth', A: profile.rbDepth, leagueAvg: 65 },
    { subject: 'WR Youth', A: profile.wrYouth, leagueAvg: 75 },
    { subject: 'TE Fit', A: profile.tePremiumFit, leagueAvg: 60 },
    { subject: 'Future Capital', A: profile.futureCapital, leagueAvg: 50 },
    { subject: 'Contention Window', A: profile.contentionWindow, leagueAvg: 72 },
  ];
}

const PARTICLES = [
  { size: 'w-2 h-2', color: 'bg-cyan-400', anim: 'animate-float-slow', top: 'top-[5%]', left: 'left-[8%]', delay: '0s' },
  { size: 'w-3 h-3', color: 'bg-purple-400', anim: 'animate-float-medium', top: 'top-[12%]', left: 'right-[12%]', delay: '2s' },
  { size: 'w-1.5 h-1.5', color: 'bg-amber-300', anim: 'animate-float-fast', top: 'bottom-[15%]', left: 'left-[33%]', delay: '4s' },
  { size: 'w-2 h-2', color: 'bg-cyan-300', anim: 'animate-float-medium', top: 'top-[25%]', left: 'left-[55%]', delay: '1s' },
  { size: 'w-1 h-1', color: 'bg-purple-300', anim: 'animate-float-slow', top: 'top-[45%]', left: 'right-[25%]', delay: '3s' },
  { size: 'w-2.5 h-2.5', color: 'bg-amber-400', anim: 'animate-float-fast', top: 'top-[60%]', left: 'left-[15%]', delay: '5s' },
  { size: 'w-1.5 h-1.5', color: 'bg-cyan-500', anim: 'animate-float-slow', top: 'top-[70%]', left: 'right-[40%]', delay: '1.5s' },
  { size: 'w-2 h-2', color: 'bg-purple-500', anim: 'animate-float-medium', top: 'top-[80%]', left: 'left-[70%]', delay: '3.5s' },
  { size: 'w-1 h-1', color: 'bg-amber-200', anim: 'animate-float-fast', top: 'top-[35%]', left: 'left-[85%]', delay: '2.5s' },
  { size: 'w-3 h-3', color: 'bg-cyan-400/60', anim: 'animate-float-slow', top: 'top-[90%]', left: 'left-[45%]', delay: '0.5s' },
  { size: 'w-1.5 h-1.5', color: 'bg-purple-400/60', anim: 'animate-float-medium', top: 'top-[18%]', left: 'left-[75%]', delay: '4.5s' },
  { size: 'w-2 h-2', color: 'bg-amber-300/60', anim: 'animate-float-fast', top: 'top-[55%]', left: 'right-[8%]', delay: '1.2s' },
];

export default function AIStrategyDashboard({ userId }: { userId: string }) {
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState('outlook');
  const [reportsHistory, setReportsHistory] = useState<any[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedLeagueId) {
      fetch(`/api/strategy/reports?leagueId=${selectedLeagueId}`)
        .then(r => r.json())
        .then(data => setReportsHistory(data.reports || []))
        .catch(() => {});
    }
  }, [selectedLeagueId, strategy]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  const loadSection = async (section: string) => {
    if (!selectedLeagueId || sectionLoading) return;
    setSectionLoading(section);
    setError(null);

    try {
      const res = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId: selectedLeagueId, section }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${section} generation failed`);
      }

      const data = await res.json();
      setStrategy(prev => prev ? { ...prev, ...data.strategy } : data.strategy);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSectionLoading(null);
    }
  };

  const handleChatSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };

    setChatMessages(prev => [...prev, userMsg, assistantMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const allMessages = [...chatMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/strategy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          leagueId: selectedLeagueId,
          context: {
            archetype: strategy?.archetype || 'Unknown',
            score: strategy?.archetypeScore ?? 0,
            rosterSummary: strategy?.overallStrategy || 'No report generated yet',
            insights: strategy?.immediateActions?.join('; ') || 'No insights yet',
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Chat request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream reader');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setChatMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: current } : m)
        );
      }
    } catch (err) {
      setChatMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      );
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, selectedLeagueId, strategy]);

  const loadHistoricalReport = (report: any) => {
    if (report.content && typeof report.content === 'object' && !report.content.type) {
      setStrategy(report.content as StrategyResponse);
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

  const radarData = buildRadarData(strategy?.radarProfile);
  const timelineEvents = strategy?.dynastyTimeline || [];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a051f] via-[#0f0a24] to-[#1a1238] animate-gradient-slow" />
        <div className="absolute inset-0 opacity-30">
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className={`absolute ${p.size} ${p.color} rounded-full ${p.anim} ${p.top} ${p.left}`}
              style={{ animationDelay: p.delay }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 space-y-8 p-4 md:p-8">
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
                Generate Full AI Strategy Report
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
          <LoadReportModal
            reports={reportsHistory}
            onLoad={(r) => {
              setStrategy(r.content as StrategyResponse);
            }}
          />
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
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="shrink-0">
              <TeamArchetypeBadge
                archetype={strategy.archetype as any}
                score={strategy.archetypeScore}
                explanation={strategy.archetypeExplanation}
              />
            </div>

            <Card className="flex-1 bg-[#0f0a24]/70 border-cyan-900/30 backdrop-blur-md shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#00f5d4] transition-shadow duration-700">
              <CardHeader>
                <CardTitle className="text-xl text-cyan-300 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-purple-400" />
                  Team Radar Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96">
                  <ResponsiveContainer>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 13 }} stroke="#475569" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8' }} stroke="#475569" />
                      <Radar name="Your Team" dataKey="A" stroke="#00f5d4" fill="#00f5d4" fillOpacity={0.35} animationDuration={1800} animationEasing="easeOut" />
                      <Radar name="League Avg" dataKey="leagueAvg" stroke="#64748b" fill="#64748b" fillOpacity={0.15} dot={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1a1238', border: '1px solid #00f5d4', borderRadius: '12px', color: 'white', boxShadow: '0 0 20px rgba(0,245,212,0.3)' }} labelStyle={{ color: '#00f5d4' }} />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} iconType="circle" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {timelineEvents.length > 0 && (
            <Card className="bg-gradient-to-br from-purple-950/50 via-cyan-950/40 to-[#0f0a24] border-none shadow-[0_0_50px_-15px_#a855f7]">
              <CardHeader>
                <CardTitle className="text-2xl text-amber-300 flex items-center gap-3">
                  <Clock className="h-6 w-6 text-amber-400" />
                  Your Dynasty Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="relative pt-12 pb-20">
                <div className="absolute left-1/2 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-cyan-500/70 to-transparent transform -translate-x-1/2" />
                {timelineEvents.map((event, i) => (
                  <motion.div
                    key={event.year}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -80 : 80, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.7, delay: i * 0.4, ease: 'easeOut' }}
                    className={`relative flex items-center mb-16 last:mb-0 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className="absolute left-1/2 transform -translate-x-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_25px_8px_rgba(0,245,212,0.5)] z-10 border-2 border-white/20">
                      {event.year.slice(2)}
                    </div>
                    <div className={`w-5/12 p-6 rounded-2xl backdrop-blur-md border border-cyan-800/40 ${i % 2 === 0 ? 'mr-auto' : 'ml-auto'} bg-[#1a1238]/90 shadow-[0_0_30px_-10px_#00f5d4]`}>
                      <h4 className="text-xl font-bold text-cyan-200 mb-3 flex items-center gap-2">
                        {(event.icon && TIMELINE_ICONS[event.icon]) || <Sparkles className="h-5 w-5 text-amber-400" />}
                        {event.year}
                      </h4>
                      <p className="text-gray-200 leading-relaxed">{event.label}</p>
                      {event.subtext && <p className="text-sm text-gray-400 mt-3 italic">{event.subtext}</p>}
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          )}

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
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30 shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#a855f7] transition-shadow duration-500">
                    <CardHeader>
                      <CardTitle className="text-2xl text-cyan-300">Weekly Brief</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.weeklyBrief ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.weeklyBrief}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 text-lg mb-4">Get this week's matchup analysis, start/sit advice, and trade windows.</p>
                          <Button
                            onClick={() => loadSection('weekly')}
                            disabled={sectionLoading === 'weekly'}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white font-bold py-4 px-6 rounded-xl"
                          >
                            {sectionLoading === 'weekly' ? (
                              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="mr-2 h-5 w-5" /> Generate Weekly Brief</>
                            )}
                          </Button>
                        </div>
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
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30 shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#a855f7] transition-shadow duration-500">
                    <CardHeader>
                      <CardTitle className="text-2xl text-purple-300">Roster Moves</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.rosterMoves ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.rosterMoves}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 text-lg mb-4">Get specific trade, drop, and add recommendations for your roster.</p>
                          <Button
                            onClick={() => loadSection('roster')}
                            disabled={sectionLoading === 'roster'}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white font-bold py-4 px-6 rounded-xl"
                          >
                            {sectionLoading === 'roster' ? (
                              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="mr-2 h-5 w-5" /> Generate Roster Moves</>
                            )}
                          </Button>
                        </div>
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
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30 shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#a855f7] transition-shadow duration-500">
                    <CardHeader>
                      <CardTitle className="text-2xl text-emerald-300">Waiver AI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.waiverTargets ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.waiverTargets}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 text-lg mb-4">Find the best waiver wire pickups ranked by dynasty value and team fit.</p>
                          <Button
                            onClick={() => loadSection('waiver')}
                            disabled={sectionLoading === 'waiver'}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold py-4 px-6 rounded-xl"
                          >
                            {sectionLoading === 'waiver' ? (
                              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="mr-2 h-5 w-5" /> Generate Waiver Targets</>
                            )}
                          </Button>
                        </div>
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
                  <Card className="bg-[#1a1238]/40 border-cyan-900/30 shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#a855f7] transition-shadow duration-500">
                    <CardHeader>
                      <CardTitle className="text-2xl text-amber-300">Long-Term Plan</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {strategy.longTermPlan ? (
                        <div className="prose prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap">
                          {strategy.longTermPlan}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-400 text-lg mb-4">Get your 2026-2028 dynasty blueprint with rebuild timeline and pick strategy.</p>
                          <Button
                            onClick={() => loadSection('longterm')}
                            disabled={sectionLoading === 'longterm'}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 text-white font-bold py-4 px-6 rounded-xl"
                          >
                            {sectionLoading === 'longterm' ? (
                              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="mr-2 h-5 w-5" /> Generate Long-Term Plan</>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </Tabs>
        </motion.div>
      )}

      <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-[0_0_40px_-10px_#00f5d4] hover:shadow-[0_0_60px_-5px_#a855f7] transition-shadow duration-500">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-purple-400" />
            Live Strategy Chat
          </CardTitle>
          <p className="text-gray-400 text-sm mt-1">
            {strategy
              ? `Chatting as ${strategy.archetype} (${strategy.archetypeScore}/100) — context loaded`
              : 'Generate a report first for context-aware responses'}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-96 overflow-y-auto p-4 bg-black/40 rounded-xl border border-purple-900/30 space-y-4">
            {chatMessages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500 text-center">
                  Ask anything about your dynasty strategy, trade targets, or roster construction...
                </p>
              </div>
            )}
            {chatMessages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-cyan-950/70 text-white'
                      : 'bg-purple-950/70 text-gray-100'
                  }`}
                >
                  {m.content || (chatLoading && m.role === 'assistant' ? (
                    <span className="text-cyan-400 animate-pulse">Thinking...</span>
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="flex gap-3">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={selectedLeagueId ? 'Ask anything about your dynasty strategy...' : 'Enter a League ID above first...'}
              disabled={!selectedLeagueId}
              className="flex-1 bg-[#1a1238] border border-cyan-800/50 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={chatLoading || !chatInput.trim() || !selectedLeagueId}
              className="bg-purple-600 hover:bg-purple-700 px-6"
            >
              {chatLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      </div>
    </div>
  );
}
