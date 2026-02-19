'use client'

import { cn } from '@/lib/utils'

type Game = {
  id: string
  round: number
  gameNumber: number
  team1: string
  team1Seed: number
  team2: string
  team2Seed: number
  winner?: string
}

type BracketTreeProps = {
  picks: Record<string, string>
  games: Game[]
}

const roundLabels: Record<number, string> = {
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
}

export default function BracketTree({ picks, games }: BracketTreeProps) {
  const rounds = [1, 2, 3, 4, 5, 6]

  return (
    <div className="w-full overflow-x-auto py-8">
      <div className="flex justify-between min-w-[2400px] relative">
        {rounds.map((round) => {
          const roundGames = games.filter(g => g.round === round)

          return (
            <div key={round} className="flex-1 px-4">
              <h3 className="text-center text-sm font-mono text-cyan-400 mb-6 uppercase tracking-wider">
                {roundLabels[round]}
              </h3>

              <div className="space-y-12 relative">
                {roundGames.map((game) => {
                  const isPicked = picks[game.id]
                  const isCorrect = isPicked && game.winner && isPicked === game.winner
                  const isWrong = isPicked && game.winner && isPicked !== game.winner

                  return (
                    <div key={game.id} className="relative">
                      <div className={cn(
                        "bg-gray-950 border rounded-xl p-4 text-sm shadow-lg",
                        isCorrect && "border-green-500/70 bg-green-950/30",
                        isWrong && "border-red-500/70 bg-red-950/30",
                        !game.winner && "border-cyan-900/50 hover:border-cyan-500/70 transition-colors"
                      )}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-medium">
                            {game.team1Seed} {game.team1}
                          </div>
                          <div className="text-gray-500">vs</div>
                          <div className="font-medium text-right">
                            {game.team2Seed} {game.team2}
                          </div>
                        </div>

                        <div className="text-center text-xs mt-2">
                          {isPicked ? (
                            <span className={cn(
                              isCorrect ? 'text-green-400' : isWrong ? 'text-red-400' : 'text-gray-300'
                            )}>
                              Your pick: {isPicked}
                              {game.winner && ` \u2022 Actual: ${game.winner}`}
                            </span>
                          ) : (
                            <span className="text-gray-600">No pick yet</span>
                          )}
                        </div>
                      </div>

                      {round < 6 && game.winner && (
                        <div className="absolute top-1/2 right-0 w-8 h-px bg-gray-700 translate-x-full" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
