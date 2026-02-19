'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'

interface Game {
  id: string
  round: number
  gameNumber: number
  region: string | null
  team1: string
  team2: string
  team1Seed: number | null
  team2Seed: number | null
  winnerId: string | null
  date: string | null
  venue: string | null
}

export default function BracketEntry() {
  const { id } = useParams()
  const router = useRouter()
  const [bracketName, setBracketName] = useState('Bracket 1')
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [userBracketsCount, setUserBracketsCount] = useState(0)
  const [games, setGames] = useState<Game[]>([])
  const [leagueName, setLeagueName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/madness/leagues/${id}`).then(res => res.json()),
      fetch('/api/madness/games').then(res => res.json()),
    ]).then(([leagueData, gamesData]) => {
      if (!leagueData.error) {
        setDeadlinePassed(leagueData.deadline ? new Date() > new Date(leagueData.deadline) : false)
        setDeadline(leagueData.deadline)
        setUserBracketsCount(leagueData.userBracketsCount || 0)
        setLeagueName(leagueData.name || '')
      }
      if (Array.isArray(gamesData)) {
        setGames(gamesData)
      }
      setLoading(false)
    })
  }, [id])

  const makePick = (gameId: string, team: string) => {
    if (deadlinePassed) return toast.error('Picks locked — deadline passed')
    if (userBracketsCount >= 3) return toast.error('Max 3 brackets allowed')
    setPicks(prev => ({ ...prev, [gameId]: team }))
  }

  const finalizeBracket = async () => {
    const round1Games = games.filter(g => g.round === 1)
    if (Object.keys(picks).length < round1Games.length) {
      return toast.error(`Complete all ${round1Games.length} picks first`)
    }

    const res = await fetch('/api/madness/brackets/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId: id, name: bracketName, picks }),
    })

    if (res.ok) {
      toast.success('Bracket submitted!')
      router.push(`/madness/my-brackets`)
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to submit bracket')
    }
  }

  const round1Games = games.filter(g => g.round === 1)
  const regions = Array.from(new Set(round1Games.map(g => g.region).filter(Boolean))) as string[]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading bracket...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Enter Your Bracket
        </h1>
        {leagueName && (
          <p className="text-center text-gray-400 mb-8">{leagueName}</p>
        )}

        {deadlinePassed ? (
          <div className="text-center text-red-400 mb-8 flex items-center justify-center gap-2">
            <Lock className="h-6 w-6" /> Picks are locked &mdash; deadline has passed.
          </div>
        ) : deadline ? (
          <div className="text-center text-green-400 mb-8">
            Picks open until {new Date(deadline).toLocaleString()}
          </div>
        ) : null}

        <div className="space-y-12">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-white">Round of 64</h3>
            {regions.length > 0 ? regions.map(region => {
              const regionGames = round1Games.filter(g => g.region === region)
              return (
                <div key={region} className="mb-8">
                  <h4 className="text-lg font-semibold mb-3 text-cyan-300">{region} Region</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {regionGames.map(game => (
                      <div key={game.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4 hover:border-cyan-500/40 transition-colors">
                        <p className="text-center font-medium mb-3 text-sm text-gray-300">
                          <span className="text-cyan-400">{game.team1Seed}</span> {game.team1}
                          <span className="text-gray-600 mx-1">vs</span>
                          <span className="text-cyan-400">{game.team2Seed}</span> {game.team2}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant={picks[game.id] === game.team1 ? 'default' : 'outline'}
                            onClick={() => makePick(game.id, game.team1)}
                            className="flex-1 text-xs"
                            disabled={deadlinePassed}
                          >
                            {picks[game.id] === game.team1 && <Check className="h-3 w-3 mr-1" />}
                            {game.team1}
                          </Button>
                          <Button
                            variant={picks[game.id] === game.team2 ? 'default' : 'outline'}
                            onClick={() => makePick(game.id, game.team2)}
                            className="flex-1 text-xs"
                            disabled={deadlinePassed}
                          >
                            {picks[game.id] === game.team2 && <Check className="h-3 w-3 mr-1" />}
                            {game.team2}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }) : round1Games.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {round1Games.map(game => (
                  <div key={game.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                    <p className="text-center font-medium mb-2 text-sm text-gray-300">
                      <span className="text-cyan-400">{game.team1Seed}</span> {game.team1}
                      <span className="text-gray-600 mx-1">vs</span>
                      <span className="text-cyan-400">{game.team2Seed}</span> {game.team2}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant={picks[game.id] === game.team1 ? 'default' : 'outline'}
                        onClick={() => makePick(game.id, game.team1)}
                        className="flex-1 text-xs"
                        disabled={deadlinePassed}
                      >
                        {picks[game.id] === game.team1 && <Check className="h-3 w-3 mr-1" />}
                        {game.team1}
                      </Button>
                      <Button
                        variant={picks[game.id] === game.team2 ? 'default' : 'outline'}
                        onClick={() => makePick(game.id, game.team2)}
                        className="flex-1 text-xs"
                        disabled={deadlinePassed}
                      >
                        {picks[game.id] === game.team2 && <Check className="h-3 w-3 mr-1" />}
                        {game.team2}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p className="text-lg">Tournament bracket not yet available</p>
                <p className="text-sm mt-2">Check back when teams are announced</p>
              </div>
            )}
          </div>

          <div className="text-center mt-12 space-y-4">
            <Input
              value={bracketName}
              onChange={e => setBracketName(e.target.value)}
              placeholder="Bracket Name (e.g. My Madness 1)"
              className="max-w-md mx-auto"
              disabled={deadlinePassed}
            />
            <Button
              onClick={finalizeBracket}
              disabled={deadlinePassed || userBracketsCount >= 3}
              className="h-12 px-10 bg-gradient-to-r from-cyan-500 to-purple-600"
            >
              <Check className="mr-2 h-5 w-5" /> Finalize Bracket
            </Button>
            {userBracketsCount >= 3 && !deadlinePassed && (
              <p className="text-red-400">Max 3 brackets reached</p>
            )}
            <p className="text-gray-500 text-sm">
              {Object.keys(picks).length} / {round1Games.length} picks made
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
