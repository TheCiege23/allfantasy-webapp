'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type LeaderboardEntry = {
  bracketId: string
  name: string
  user: string
  score: number
  avatar?: string
}

export default function LiveLeaderboard({
  initialLeaderboard,
  leagueId,
}: {
  initialLeaderboard: LeaderboardEntry[]
  leagueId: string
}) {
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/madness/leagues/${leagueId}/leaderboard`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setLeaderboard(data.map((e: any) => ({
              bracketId: e.bracketId,
              name: e.bracketName,
              user: e.ownerName,
              score: e.score,
              avatar: e.avatar,
            })))
          }
        }
      } catch {}
    }, 60000)

    return () => clearInterval(interval)
  }, [leagueId])

  if (leaderboard.length === 0) {
    return (
      <Card className="border-gray-800 bg-gray-950/50">
        <CardContent className="p-8 text-center text-gray-500">
          No brackets submitted yet
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-cyan-900/50 bg-gray-950/50">
      <CardContent className="p-6">
        <div className="space-y-4">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.bracketId}
              className={`flex items-center gap-6 p-4 rounded-xl transition-all ${
                i === 0
                  ? 'bg-yellow-500/10 hover:bg-yellow-500/15'
                  : i === 1
                  ? 'bg-gray-400/10 hover:bg-gray-400/15'
                  : i === 2
                  ? 'bg-orange-500/10 hover:bg-orange-500/15'
                  : 'bg-black/40 hover:bg-black/60'
              }`}
            >
              <div className="w-12 text-center">
                <div className={`text-3xl font-bold ${
                  i === 0 ? 'text-yellow-400' :
                  i === 1 ? 'text-gray-300' :
                  i === 2 ? 'text-orange-400' : 'text-cyan-400'
                }`}>
                  #{i + 1}
                </div>
              </div>

              <Avatar className="h-12 w-12">
                <AvatarImage src={entry.avatar} />
                <AvatarFallback className="bg-gray-800 text-gray-300">
                  {entry.user?.[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="font-medium text-lg text-white">{entry.name}</div>
                <div className="text-sm text-gray-400">by {entry.user}</div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-bold text-purple-400">{entry.score}</div>
                <div className="text-xs text-gray-500">points</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
