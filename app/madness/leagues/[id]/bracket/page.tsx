'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'

interface GameNode {
  id: string
  slot: string
  round: number
  region: string | null
  homeTeamName: string | null
  awayTeamName: string | null
  seedHome: number | null
  seedAway: number | null
}

export default function BracketEntry() {
  const { id } = useParams()
  const router = useRouter()
  const [bracketName, setBracketName] = useState('Bracket 1')
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [deadlinePassed, setDeadlinePassed] = useState(false)
  const [deadline, setDeadline] = useState<string | null>(null)
  const [userBracketsCount, setUserBracketsCount] = useState(0)
  const [games, setGames] = useState<GameNode[]>([])
  const [leagueName, setLeagueName] = useState('')

  useEffect(() => {
    fetch(`/api/madness/leagues/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) return
        setDeadlinePassed(data.deadline ? new Date() > new Date(data.deadline) : false)
        setDeadline(data.deadline)
        setUserBracketsCount(data.userBracketsCount || 0)
        setLeagueName(data.name || '')
        if (data.tournament?.nodes) {
          setGames(data.tournament.nodes)
        }
      })
  }, [id])

  const makePick = (gameId: string, team: string) => {
    if (deadlinePassed) return toast.error('Picks locked — deadline passed')
    if (userBracketsCount >= 3) return toast.error('Max 3 brackets allowed')

    setPicks(prev => {
      const updated = { ...prev }
      const gameKeys = Object.keys(updated).filter(k => k.startsWith(gameId.split('_')[0]))
      gameKeys.forEach(k => delete updated[k])
      updated[gameId] = team
      return updated
    })
  }

  const finalizeBracket = async () => {
    const totalGames = games.length || 32
    if (Object.keys(picks).length < totalGames) {
      return toast.error(`Complete all ${totalGames} picks first`)
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

  const displayGames = games.length > 0
    ? games
    : Array.from({ length: 32 }, (_, i) => ({
        id: `placeholder_${i}`,
        slot: `r1g${i + 1}`,
        round: 1,
        region: i < 8 ? 'East' : i < 16 ? 'West' : i < 24 ? 'South' : 'Midwest',
        homeTeamName: null,
        awayTeamName: null,
        seedHome: null,
        seedAway: null,
      }))

  const regions = Array.from(new Set(displayGames.map(g => g.region).filter(Boolean)))

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
          {regions.length > 0 ? regions.map(region => {
            const regionGames = displayGames.filter(g => g.region === region)
            return (
              <div key={region}>
                <h3 className="text-2xl font-bold mb-4 text-cyan-300">{region} Region</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {regionGames.map((game) => (
                    <div key={game.id} className="bg-gray-950 border border-gray-800 rounded-xl p-4 hover:border-cyan-500/40 transition-colors">
                      <p className="text-center text-xs text-gray-500 mb-3">{game.slot}</p>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant={picks[game.id] === (game.homeTeamName || 'Home') ? 'default' : 'outline'}
                          onClick={() => makePick(game.id, game.homeTeamName || 'Home')}
                          className="w-full justify-between text-sm"
                          disabled={deadlinePassed}
                        >
                          <span>{game.seedHome ? `(${game.seedHome})` : ''} {game.homeTeamName || 'TBD'}</span>
                          {picks[game.id] === (game.homeTeamName || 'Home') && <Check className="h-4 w-4 text-green-400" />}
                        </Button>
                        <Button
                          variant={picks[game.id] === (game.awayTeamName || 'Away') ? 'default' : 'outline'}
                          onClick={() => makePick(game.id, game.awayTeamName || 'Away')}
                          className="w-full justify-between text-sm"
                          disabled={deadlinePassed}
                        >
                          <span>{game.seedAway ? `(${game.seedAway})` : ''} {game.awayTeamName || 'TBD'}</span>
                          {picks[game.id] === (game.awayTeamName || 'Away') && <Check className="h-4 w-4 text-green-400" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          }) : (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">Tournament bracket not yet available</p>
              <p className="text-sm mt-2">Check back when teams are announced</p>
            </div>
          )}

          <div className="text-center mt-12">
            <Input
              value={bracketName}
              onChange={e => setBracketName(e.target.value)}
              placeholder="Bracket Name (e.g. My Madness 1)"
              className="mb-4 max-w-md mx-auto"
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
              <p className="text-red-400 mt-4">Max 3 brackets reached</p>
            )}
            <p className="text-gray-500 text-sm mt-3">
              {Object.keys(picks).length} / {displayGames.length} picks made
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
