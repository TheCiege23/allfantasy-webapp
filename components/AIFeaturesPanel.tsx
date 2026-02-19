'use client'

import React, { useState, useEffect } from 'react'

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

interface AIFeature {
  icon: string
  title: string
  description: string
  route: string
  tabId: string
  gradient: string
  glow: string
  accentText: string
  tagClasses: string
  tag: string
}

const AI_FEATURES: AIFeature[] = [
  {
    icon: '\u{2696}\uFE0F',
    title: 'AI Trade Analyzer',
    description: 'Context-aware evaluations using manager tendencies, league scoring, and competitive windows',
    route: '/af-legacy',
    tabId: 'trade',
    gradient: 'from-red-500/20 to-orange-500/10',
    glow: 'neon-glow-red',
    accentText: 'text-red-400',
    tagClasses: 'text-red-400 bg-red-500/10 border-red-500/20',
    tag: 'Core Tool',
  },
  {
    icon: '\u{1F525}',
    title: 'Rivalry Week Storylines',
    description: 'AI-generated weekly narratives with rivalry scoring, revenge games, and trade tension tracking',
    route: '/af-legacy',
    tabId: 'transfer',
    gradient: 'from-amber-500/20 to-yellow-500/10',
    glow: 'neon-glow-amber',
    accentText: 'text-amber-400',
    tagClasses: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    tag: 'New',
  },
  {
    icon: '\u{1F3AF}',
    title: 'Draft War Room',
    description: 'Real-time draft recommendations, value-based rankings, and trade-up/down strategies',
    route: '/af-legacy',
    tabId: 'draft',
    gradient: 'from-emerald-500/20 to-teal-500/10',
    glow: 'neon-glow-emerald',
    accentText: 'text-emerald-400',
    tagClasses: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    tag: 'Draft Season',
  },
  {
    icon: '\u{1F4CB}',
    title: 'Waiver "One Move" Plan',
    description: 'Weekly waiver priority with one high-impact recommendation tailored to your team needs',
    route: '/af-legacy',
    tabId: 'finder',
    gradient: 'from-purple-500/20 to-violet-500/10',
    glow: 'neon-glow-purple',
    accentText: 'text-purple-400',
    tagClasses: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    tag: 'Weekly',
  },
  {
    icon: '\u{1F4CA}',
    title: 'Power + Luck Rankings',
    description: 'Luck-adjusted power rankings with 5-score composite, win probability, and Monte Carlo projections',
    route: '/af-legacy',
    tabId: 'rankings',
    gradient: 'from-cyan-500/20 to-blue-500/10',
    glow: 'neon-glow-cyan',
    accentText: 'text-cyan-400',
    tagClasses: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    tag: 'Rankings v2',
  },
  {
    icon: '\u{1F50D}',
    title: 'AI Trade Finder',
    description: 'Scans every roster in your league to surface mutually beneficial trade proposals with acceptance odds',
    route: '/af-legacy',
    tabId: 'finder',
    gradient: 'from-pink-500/20 to-rose-500/10',
    glow: 'neon-glow-red',
    accentText: 'text-pink-400',
    tagClasses: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    tag: 'Smart Match',
  },
]

function FeatureCard({ feature, index, onNavigate }: { feature: AIFeature; index: number; onNavigate: (tabId: string) => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 100 + index * 80); return () => clearTimeout(t) }, [index])

  return (
    <button
      onClick={() => onNavigate(feature.tabId)}
      className={cx(
        'group relative w-full text-left rounded-xl glass-card overflow-hidden transition-all duration-300',
        'hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]',
        feature.glow,
        visible ? 'animate-slide-up' : 'opacity-0'
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className={cx('absolute inset-0 bg-gradient-to-br pointer-events-none rounded-xl opacity-80 group-hover:opacity-100 transition-opacity -z-10', feature.gradient)} />
      <div className="relative p-3.5 flex items-start gap-3">
        <div className="text-xl shrink-0 mt-0.5 group-hover:animate-rival-pulse">{feature.icon}</div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-white group-hover:text-white transition-colors">{feature.title}</span>
            <span className={cx('text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0',
              feature.tagClasses,
            )}>{feature.tag}</span>
          </div>
          <p className="text-[9px] text-white/35 leading-relaxed line-clamp-2 group-hover:text-white/45 transition-colors">{feature.description}</p>
        </div>
        <svg className="w-4 h-4 text-white/15 shrink-0 mt-1 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </div>
    </button>
  )
}

interface AIFeaturesPanelProps {
  leagueName?: string
  onNavigate: (tabId: string) => void
}

export default function AIFeaturesPanel({ leagueName, onNavigate }: AIFeaturesPanelProps) {
  return (
    <div className="w-full space-y-5">
      <div className="rounded-2xl glass-card-vivid neon-glow-cyan overflow-hidden animate-neon-border">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-purple-500/[0.03] to-transparent pointer-events-none" />
          <div className="relative px-5 py-4 border-b border-cyan-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-cyan-500/25">
                AF
              </div>
              <div>
                <h3 className="text-sm font-black text-white">AI Features Included at Launch</h3>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {leagueName ? (
                    <>Unlocked for <span className="text-cyan-400/60 font-semibold">{leagueName}</span></>
                  ) : (
                    <>Unlocked for your imported league</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-rival-pulse" />
                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">All Active</span>
              </div>
              <span className="text-[8px] text-white/20">{AI_FEATURES.length} AI-powered tools ready</span>
            </div>
          </div>
        </div>

        <div className="relative p-4">
          <div className="grid gap-2.5 sm:grid-cols-2 stagger-children">
            {AI_FEATURES.map((feature, i) => (
              <FeatureCard key={feature.tabId + i} feature={feature} index={i} onNavigate={onNavigate} />
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.04] text-center">
            <p className="text-[9px] text-white/20 font-medium">
              All features are context-aware and personalized to your league settings, scoring, and manager history
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
