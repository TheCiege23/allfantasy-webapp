import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'
import type { Metadata } from 'next'

const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400 bg-red-500/15 border-red-500/30',
  RB: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
  WR: 'text-green-400 bg-green-500/15 border-green-500/30',
  TE: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  K: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  DEF: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
}

interface DraftPick {
  round: number
  pick: number
  overall: number
  playerName: string
  position: string
  team: string
  manager: string
  managerAvatar?: string
  confidence: number
  isUser: boolean
  value: number
  notes: string
}

export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  const draft = await prisma.mockDraft.findUnique({
    where: { shareId: params.shareId },
    include: { league: { select: { name: true } } },
  })
  if (!draft) return { title: 'Draft Not Found - AllFantasy' }
  const picks = (draft.results as unknown) as DraftPick[]
  const userPicks = picks.filter(p => p.isUser)
  return {
    title: `${draft.league.name} Mock Draft - AllFantasy`,
    description: `${picks.length} picks across ${draft.rounds} rounds. Top picks: ${userPicks.slice(0, 3).map(p => p.playerName).join(', ')}`,
  }
}

export default async function SharedDraftPage({ params }: { params: { shareId: string } }) {
  const draft = await prisma.mockDraft.findUnique({
    where: { shareId: params.shareId },
    include: {
      league: { select: { name: true, scoring: true, isDynasty: true, leagueSize: true } },
      user: { select: { displayName: true } },
    },
  })

  if (!draft) notFound()

  const picks = Array.isArray(draft.results) ? (draft.results as unknown as DraftPick[]) : []
  if (picks.length === 0) notFound()
  const totalRounds = Math.max(...picks.map(p => p.round), 1)
  const userPicks = picks.filter(p => p.isUser)
  const positionCounts = userPicks.reduce((acc, p) => {
    acc[p.position] = (acc[p.position] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <p className="text-sm text-cyan-400 font-mono mb-2">SHARED MOCK DRAFT</p>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            {draft.league.name}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            by {draft.user.displayName || 'Anonymous'} &middot; {draft.league.leagueSize}-team {draft.league.isDynasty ? 'Dynasty' : 'Redraft'} &middot; {draft.league.scoring || 'PPR'} &middot; {new Date(draft.createdAt).toLocaleDateString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-center mb-8">
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-gray-400">Picks:</span>
            <span className="font-bold text-white">{userPicks.length}</span>
          </div>
          {Object.entries(positionCounts).sort().map(([pos, count]) => (
            <Badge key={pos} className={`${POSITION_COLORS[pos] || ''} border px-3 py-1`}>
              {pos}: {count}
            </Badge>
          ))}
        </div>

        <div className="bg-black/80 border border-cyan-900/50 rounded-3xl p-4 sm:p-8">
          <div className="space-y-10">
            {Array.from({ length: totalRounds }).map((_, roundIdx) => {
              const roundPicks = picks.filter(p => p.round === roundIdx + 1)
              if (roundPicks.length === 0) return null

              return (
                <div key={roundIdx}>
                  <div className="text-cyan-400 text-sm font-mono mb-3 pl-4 flex items-center gap-2">
                    ROUND {roundIdx + 1}
                    {roundIdx === 0 && (
                      <span className="text-xs bg-purple-600/50 px-2 py-1 rounded-full text-purple-200">First Round</span>
                    )}
                    <span className="text-xs text-gray-600">({roundPicks.length} picks)</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {roundPicks.map((pick) => (
                      <div
                        key={pick.overall}
                        className={`relative rounded-xl p-3 border transition-all ${
                          pick.overall === 1
                            ? 'bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-amber-500/50 ring-1 ring-amber-400/30'
                            : pick.isUser
                              ? 'bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border-cyan-500/40'
                              : 'bg-gray-950/80 border-gray-800/60 hover:border-gray-700'
                        }`}
                      >
                        {pick.overall === 1 && (
                          <div className="absolute -top-2 -right-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30">
                            #1 PICK
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-gray-600">#{pick.overall}</span>
                          <Badge className={`${POSITION_COLORS[pick.position] || ''} border text-[10px] px-1.5 py-0`}>
                            {pick.position}
                          </Badge>
                        </div>
                        <div className="font-bold text-sm text-white truncate">{pick.playerName}</div>
                        <div className="text-xs text-gray-500 truncate">{pick.position} &middot; {pick.team}</div>
                        <div className="mt-2 flex items-center gap-1.5 text-xs">
                          {pick.managerAvatar && (
                            <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-700 shrink-0">
                              <img src={pick.managerAvatar} alt={pick.manager} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <span className={`truncate ${pick.isUser ? 'text-cyan-400 font-semibold' : 'text-gray-600'}`}>
                            {pick.manager}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-600">
          Powered by <span className="text-cyan-400 font-semibold">AllFantasy AI</span>
        </div>
      </div>
    </div>
  )
}
