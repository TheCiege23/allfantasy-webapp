'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import LeagueTransferClient from '@/components/legacy/LeagueTransferClient'
import AIStrategyDashboard from '@/components/legacy/AIStrategyDashboard'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fadeInUp,
  staggerContainer,
  tabContentVariants,
} from '@/components/motion/variants'
import { useState } from 'react'
import Link from 'next/link'
import { AFBrandingFooter } from '@/components/branding/AFWatermark'

interface LegacyHubClientProps {
  userId: string
}

export default function LegacyHubClient({ userId }: LegacyHubClientProps) {
  const [activeTab, setActiveTab] = useState('transfer')

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="relative min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8 md:px-8 lg:px-12"
    >
      <div className="absolute top-6 right-6 pointer-events-none select-none z-0">
        <img src="/af-shield-bg.png" alt="" className="w-14 h-14 opacity-[0.07]" draggable={false} />
      </div>
      <div className="max-w-7xl mx-auto">
        <motion.div variants={staggerContainer} className="mb-10 text-center md:text-left">
          <motion.div variants={fadeInUp} className="flex items-center gap-3 justify-center md:justify-start mb-2">
            <img src="/af-shield-bg.png" alt="" className="w-10 h-10 opacity-60" draggable={false} />
            <img src="/allfantasy-hero.png" alt="AllFantasy" className="h-5 opacity-40" draggable={false} />
          </motion.div>
          <motion.h1
            variants={fadeInUp}
            className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
          >
            AllFantasy Legacy Hub
          </motion.h1>
          <motion.p
            variants={fadeInUp}
            className="mt-3 text-lg md:text-xl text-gray-300 max-w-3xl"
          >
            Bring your dynasty history, analyze trades like a pro, rank your roster, and more — all in one powerful space.
          </motion.p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:w-auto lg:inline-flex bg-[#1a1238]/70 backdrop-blur-lg border border-white/10 rounded-xl mb-10">
            <TabsTrigger value="transfer" className="text-base md:text-lg">League Transfer</TabsTrigger>
            <TabsTrigger value="rankings" className="text-base md:text-lg">Rankings</TabsTrigger>
            <TabsTrigger value="trades" className="text-base md:text-lg">Trade Analyzer</TabsTrigger>
            <TabsTrigger value="strategy" className="relative text-base md:text-lg font-bold text-amber-300">
              AI Strategy
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-base md:text-lg">
              More Tools
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {activeTab === 'transfer' && (
              <motion.div
                key="transfer"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-3xl bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                      Migrate Your Sleeper League
                    </CardTitle>
                    <CardDescription className="text-gray-300 text-lg">
                      One-click import of history, settings, rosters, and managers. Everything preserved.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <LeagueTransferClient userId={userId} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'rankings' && (
              <motion.div
                key="rankings"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-3xl">Dynasty Rankings</CardTitle>
                    <CardDescription>Open the full rankings workspace with scorecards, tiers, and history.</CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-[220px] flex flex-col items-center justify-center gap-4 text-gray-300 text-center">
                    <p className="text-lg">Your rankings tools are live in the dedicated Rankings page.</p>
                    <Link href="/rankings" className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 font-semibold hover:opacity-90 transition-opacity">
                      Open Rankings
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'trades' && (
              <motion.div
                key="trades"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-3xl">Dynasty Trade Analyzer</CardTitle>
                    <CardDescription>Analyze multi-player deals, picks, confidence, and counters.</CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-[220px] flex flex-col items-center justify-center gap-4 text-gray-300 text-center">
                    <p className="text-lg">The AI trade analyzer is available now.</p>
                    <Link href="/dynasty-trade-analyzer" className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 font-semibold hover:opacity-90 transition-opacity">
                      Open Trade Analyzer
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'tools' && (
              <motion.div
                key="tools"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-3xl">More Legacy Tools</CardTitle>
                    <CardDescription>Quick links to the rest of your legacy and dynasty toolkit.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { href: '/af-legacy/pulse', label: 'League Pulse' },
                      { href: '/trade-finder', label: 'Trade Finder' },
                      { href: '/player-finder', label: 'Player Finder' },
                      { href: '/waiver-ai', label: 'Waiver AI' },
                      { href: '/rankings', label: 'Dynasty Rankings' },
                      { href: '/compare', label: 'Manager Compare' },
                      { href: '/share', label: 'Share Generator' },
                      { href: '/strategy', label: 'Season Strategy' },
                      { href: '/dynasty-trade-analyzer', label: 'Trade Analyzer' },
                      { href: '/dashboard', label: 'Legacy Dashboard' },
                    ].map((tool) => (
                      <Link key={tool.href} href={tool.href} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-colors">
                        <div className="font-semibold text-lg text-white">{tool.label}</div>
                        <div className="text-sm text-gray-400 mt-1">Open tool</div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'strategy' && (
              <motion.div
                key="strategy"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Card className="bg-[#0f0a24]/80 border-cyan-900/30 backdrop-blur-sm shadow-2xl shadow-purple-950/20">
                  <CardHeader>
                    <CardTitle className="text-4xl bg-gradient-to-r from-amber-300 via-cyan-300 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
                      <span className="text-5xl">🧠</span> AI Strategy Engine
                    </CardTitle>
                    <CardDescription className="text-xl text-gray-300">
                      Your personal dynasty strategist. Powered by real-time data + elite AI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AIStrategyDashboard userId={userId} />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </Tabs>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-16 text-center text-sm text-gray-500"
        >
          Secure · Powered by Sleeper API · Your data stays yours
        </motion.div>
        <AFBrandingFooter />
      </div>
    </motion.div>
  )
}
