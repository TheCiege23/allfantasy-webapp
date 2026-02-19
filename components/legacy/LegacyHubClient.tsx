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
      className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8 md:px-8 lg:px-12"
    >
      <div className="max-w-7xl mx-auto">
        <motion.div variants={staggerContainer} className="mb-10 text-center md:text-left">
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
            <TabsTrigger value="tools" disabled className="text-base md:text-lg opacity-50">
              More Tools (soon)
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
                    <CardDescription>Coming soon — stacked positional bars, AI power scores, tier badges.</CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-[400px] flex items-center justify-center text-gray-400 text-xl">
                    Feature in active development — check back soon!
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
                    <CardDescription>Multi-player + picks, value deltas, confidence meter, counter-offers.</CardDescription>
                  </CardHeader>
                  <CardContent className="min-h-[400px] flex items-center justify-center text-gray-400 text-xl">
                    Ready for testing — link coming in next update.
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
      </div>
    </motion.div>
  )
}
