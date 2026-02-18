'use client';

import { useState } from 'react';
import RosterLegacyReport from '@/app/components/RosterLegacyReport';
import SyncedRosters from '@/app/components/SyncedRosters';
import WaiverAI from '@/app/components/WaiverAI';

export default function LegacyOverview() {
  const [activeTab, setActiveTab] = useState<'overview' | 'trade' | 'waiver' | 'chat' | 'transfer'>('overview');

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-white/10 bg-black/70 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-purple-600 via-cyan-400 to-indigo-500 rounded-2xl flex items-center justify-center text-3xl shadow-xl">
              👑
            </div>
            <div>
              <div className="font-bold text-2xl tracking-tight">TheCiege24</div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                High Confidence
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm">
            <div className="text-center">
              <div className="text-3xl font-bold text-cyan-400">448</div>
              <div className="text-xs text-slate-400">Leagues</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">2918-3664-63</div>
              <div className="text-xs text-slate-400">W-L-T Record</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">11</div>
              <div className="text-xs text-slate-400">Ships</div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3 overflow-x-auto">
          {['Sleeper', 'Yahoo', 'MFL', 'Fantrax'].map(p => (
            <div key={p} className="px-5 py-2 bg-white/5 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap">
              {p} <span className="text-xs text-emerald-400">531</span>
            </div>
          ))}
          <button className="px-5 py-2 bg-white/5 hover:bg-white/10 rounded-full text-sm font-medium flex items-center gap-2 transition-colors">
            + Add
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-2 border-b border-white/10 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: '🏠' },
          { id: 'trade', label: 'AI Trade Hub', icon: '⚖️' },
          { id: 'waiver', label: 'Waiver AI', icon: '📈' },
          { id: 'chat', label: 'AI Chat', icon: '💬' },
          { id: 'transfer', label: 'Transfer', icon: '🔄' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        {activeTab === 'overview' && (
          <>
            <div className="mb-16">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-sm">
                🏆 Legacy Score &bull; Updated moments ago
              </div>

              <div className="mt-10 flex flex-col lg:flex-row gap-12">
                <div className="flex-1">
                  <div className="text-[120px] leading-none font-black tracking-[-6px] bg-gradient-to-br from-white via-cyan-100 to-purple-100 bg-clip-text text-transparent">
                    66
                  </div>
                  <p className="text-3xl text-slate-300 mt-2">out of 100</p>
                  <p className="max-w-md mt-6 text-lg text-slate-300">
                    Your career spans 531 leagues across 7 seasons. You&apos;re a battle-tested competitor with room to grow in specialty formats.
                  </p>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-slate-900/70 border border-slate-700 rounded-3xl p-6">
                    <div className="text-emerald-400 text-sm">Win Rate</div>
                    <div className="text-5xl font-bold mt-3">43.1%</div>
                    <div className="text-xs text-emerald-400 mt-1">Difficulty-adjusted 55.4%</div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-700 rounded-3xl p-6">
                    <div className="text-purple-400 text-sm">Current Tier</div>
                    <div className="text-5xl font-bold mt-3">Captain</div>
                    <div className="text-xs text-slate-400 mt-1">Level 569 &bull; 284,844 XP</div>
                  </div>

                  <div className="bg-slate-900/70 border border-slate-700 rounded-3xl p-6">
                    <div className="text-amber-400 text-sm">Next Edge</div>
                    <div className="text-xl font-medium leading-tight mt-4">
                      Converting playoff runs into championships
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-16">
              <h3 className="text-xl font-semibold mb-6">Career Breakdown by League Type</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-amber-900/70 to-slate-900 border border-amber-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="text-4xl">👑</div>
                    <div>
                      <div className="font-bold text-xl">Dynasty Career</div>
                      <div className="text-amber-400 text-sm">372 leagues</div>
                    </div>
                  </div>
                  <div className="space-y-6 text-sm">
                    <div className="flex justify-between">
                      <span>2401-3133-23</span>
                      <span className="text-emerald-400">38.2% Playoff Rate</span>
                    </div>
                    <div className="flex justify-between">
                      <span>2.4% Ship Rate</span>
                      <span className="text-amber-400">1.24x Difficulty</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-900/70 to-slate-900 border border-cyan-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="text-4xl">⚡</div>
                    <div>
                      <div className="font-bold text-xl">Redraft Career</div>
                      <div className="text-cyan-400 text-sm">80 leagues</div>
                    </div>
                  </div>
                  <div className="space-y-6 text-sm">
                    <div className="flex justify-between">
                      <span>517-531-40</span>
                      <span className="text-emerald-400">37.5% Playoff Rate</span>
                    </div>
                    <div className="flex justify-between">
                      <span>2.5% Ship Rate</span>
                      <span className="text-cyan-400">1.14x Difficulty</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/70 to-slate-900 border border-purple-500/30 rounded-3xl p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="text-4xl">🌟</div>
                    <div>
                      <div className="font-bold text-xl">Specialty Formats</div>
                      <div className="text-purple-400 text-sm">79 leagues</div>
                    </div>
                  </div>
                  <div className="space-y-6 text-sm">
                    <div className="flex justify-between">
                      <span>284-409-87</span>
                      <span className="text-emerald-400">13.9% Playoff Rate</span>
                    </div>
                    <div className="flex justify-between">
                      <span>1.3% Ship Rate</span>
                      <span className="text-purple-400">1.35x Difficulty</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <RosterLegacyReport />

            <div className="mt-12">
              <SyncedRosters />
            </div>
          </>
        )}

        {activeTab === 'trade' && (
          <div className="py-16 text-center">
            <div className="text-6xl mb-4">⚖️</div>
            <h2 className="text-2xl font-bold mb-2">AI Trade Hub</h2>
            <p className="text-slate-400">Evaluate trades, get counter-offer suggestions, and analyze trade history.</p>
            <p className="text-sm text-slate-500 mt-4">Navigate to the Trade Analyzer from the dashboard for full functionality.</p>
          </div>
        )}

        {activeTab === 'waiver' && <WaiverAI />}

        {activeTab === 'chat' && (
          <div className="py-16 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold mb-2">AI Chat</h2>
            <p className="text-slate-400">Ask your personal AI assistant anything about your fantasy teams.</p>
            <p className="text-sm text-slate-500 mt-4">Coming soon — AI-powered chat with full roster context.</p>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="py-16 text-center">
            <div className="text-6xl mb-4">🔄</div>
            <h2 className="text-2xl font-bold mb-2">Transfer Portal</h2>
            <p className="text-slate-400">Import and export league data across platforms.</p>
            <p className="text-sm text-slate-500 mt-4">Coming soon — seamless cross-platform league transfers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
