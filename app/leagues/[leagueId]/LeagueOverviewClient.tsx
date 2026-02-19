'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Trophy, Users, ArrowRight, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LeagueOverviewProps {
  league: {
    id: string
    name: string | null
    platform: string
    platformLeagueId: string
    season: number | null
    leagueSize: number | null
    scoring: string | null
    isDynasty: boolean
    teamCount: number
    managers: Array<{
      displayName: string
      avatar: string | null
      wins: number
      losses: number
      ties: number
    }>
    teams: Array<{
      id: string
      teamName: string
      ownerName: string
      wins: number
      losses: number
      pointsFor: number
    }>
  }
  isWelcome: boolean
}

export default function LeagueOverviewClient({ league, isWelcome }: LeagueOverviewProps) {
  const roster = league.teams.length > 0 ? league.teams : league.managers.map((m, i) => ({
    id: String(i),
    teamName: m.displayName,
    ownerName: m.displayName,
    wins: m.wins,
    losses: m.losses,
    pointsFor: 0,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8 md:px-8">
      <div className="max-w-5xl mx-auto">
        {isWelcome && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 p-6 text-center"
          >
            <Sparkles className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-cyan-300">League Transferred Successfully!</h2>
            <p className="text-gray-300 mt-2">
              Your league data has been imported. Explore your tools below.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            {league.name || 'My League'}
          </h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-400">
            <span className="capitalize">{league.platform}</span>
            <span>•</span>
            <span>Season {league.season}</span>
            <span>•</span>
            <span>{league.leagueSize}-team</span>
            <span>•</span>
            <span className="uppercase">{league.scoring}</span>
            {league.isDynasty && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-semibold">Dynasty</span>
              </>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-[#0f0a24]/80 border-cyan-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-cyan-400" />
                Managers ({league.teamCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {roster.map((t, i) => (
                <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-gray-200">{t.teamName || t.ownerName}</span>
                  <span className="text-sm text-gray-400">{t.wins}-{t.losses}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#0f0a24]/80 border-cyan-900/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-amber-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/rankings" className="block">
                <Button variant="outline" className="w-full justify-between border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/40">
                  Power Rankings <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dynasty-trade-analyzer" className="block">
                <Button variant="outline" className="w-full justify-between border-white/10 hover:bg-purple-500/10 hover:border-purple-500/40">
                  Trade Analyzer <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/strategy" className="block">
                <Button variant="outline" className="w-full justify-between border-white/10 hover:bg-amber-500/10 hover:border-amber-500/40">
                  AI Strategy Engine <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/af-legacy" className="block">
                <Button className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90">
                  Open Legacy Hub <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
