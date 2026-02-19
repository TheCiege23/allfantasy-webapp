'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, RotateCcw, Zap, Clock, ChevronDown, Settings, Play, Pause, SkipForward, Users } from 'lucide-react'

interface LeagueOption {
  id: string
  name: string
  platform: string
  leagueSize: number
  isDynasty: boolean
  scoring: string | null
}

interface DraftPick {
  round: number
  pick: number
  overall: number
  teamIdx: number
  teamName: string
  playerName: string
  position: string
  isUser: boolean
}

interface AvailablePlayer {
  name: string
  position: string
  tier: number
  adp: number
  value: number
  bye: number
  notes: string
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const
const POSITION_COLORS: Record<string, string> = {
  QB: 'text-red-400 bg-red-500/15 border-red-500/30',
  RB: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30',
  WR: 'text-green-400 bg-green-500/15 border-green-500/30',
  TE: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  K: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  DEF: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
}

const MOCK_PLAYERS: AvailablePlayer[] = [
  { name: 'Ja\'Marr Chase', position: 'WR', tier: 1, adp: 1.2, value: 99, bye: 12, notes: 'Elite WR1 — target monster' },
  { name: 'Bijan Robinson', position: 'RB', tier: 1, adp: 2.1, value: 98, bye: 12, notes: 'Top 3 RB asset — workhorse role' },
  { name: 'CeeDee Lamb', position: 'WR', tier: 1, adp: 3.0, value: 97, bye: 7, notes: 'WR1 overall upside' },
  { name: 'Breece Hall', position: 'RB', tier: 1, adp: 4.5, value: 96, bye: 12, notes: 'Elite pass-catching RB' },
  { name: 'Amon-Ra St. Brown', position: 'WR', tier: 1, adp: 5.2, value: 95, bye: 5, notes: 'Target king — 150+ target floor' },
  { name: 'Saquon Barkley', position: 'RB', tier: 1, adp: 6.0, value: 94, bye: 5, notes: 'Aging curve risk but still elite' },
  { name: 'Josh Allen', position: 'QB', tier: 1, adp: 7.0, value: 93, bye: 12, notes: 'QB1 overall — rushing upside' },
  { name: 'Tyreek Hill', position: 'WR', tier: 1, adp: 8.0, value: 92, bye: 6, notes: 'Speed freak — league-winning upside' },
  { name: 'Garrett Wilson', position: 'WR', tier: 2, adp: 9.0, value: 91, bye: 12, notes: 'Target hog — WR1 potential' },
  { name: 'Jonathan Taylor', position: 'RB', tier: 2, adp: 10.0, value: 90, bye: 14, notes: 'Bounce-back candidate' },
  { name: 'Jahmyr Gibbs', position: 'RB', tier: 2, adp: 11.0, value: 89, bye: 5, notes: 'Electric playmaker — pass game role' },
  { name: 'Lamar Jackson', position: 'QB', tier: 2, adp: 12.0, value: 88, bye: 14, notes: 'Rushing floor — MVP upside' },
  { name: 'Puka Nacua', position: 'WR', tier: 2, adp: 13.5, value: 87, bye: 6, notes: 'Young alpha WR — target volume' },
  { name: 'De\'Von Achane', position: 'RB', tier: 2, adp: 14.0, value: 86, bye: 6, notes: 'Speed + receiving work' },
  { name: 'Travis Kelce', position: 'TE', tier: 2, adp: 15.0, value: 85, bye: 6, notes: 'Still the TE1 — aging risk' },
  { name: 'Jalen Hurts', position: 'QB', tier: 2, adp: 16.0, value: 84, bye: 5, notes: 'Rushing QB1 — TD volume' },
  { name: 'Drake London', position: 'WR', tier: 2, adp: 17.0, value: 83, bye: 12, notes: 'Red zone target — breakout' },
  { name: 'Derrick Henry', position: 'RB', tier: 3, adp: 18.0, value: 82, bye: 14, notes: 'Volume king — age concern' },
  { name: 'Sam LaPorta', position: 'TE', tier: 3, adp: 19.0, value: 81, bye: 5, notes: 'Young TE1 — growing role' },
  { name: 'Malik Nabers', position: 'WR', tier: 3, adp: 20.0, value: 80, bye: 11, notes: 'Rookie breakout — alpha upside' },
  { name: 'Kenneth Walker III', position: 'RB', tier: 3, adp: 21.0, value: 79, bye: 10, notes: 'Workload questions' },
  { name: 'Patrick Mahomes', position: 'QB', tier: 3, adp: 22.0, value: 78, bye: 6, notes: 'Safe QB1 — lower rushing' },
  { name: 'Chris Olave', position: 'WR', tier: 3, adp: 23.0, value: 77, bye: 12, notes: 'Route runner — target share' },
  { name: 'Brock Bowers', position: 'TE', tier: 3, adp: 24.0, value: 76, bye: 10, notes: 'Young stud TE — potential TE1' },
  { name: 'Kyren Williams', position: 'RB', tier: 3, adp: 25.0, value: 75, bye: 6, notes: 'Volume-based RB2' },
  { name: 'Stefon Diggs', position: 'WR', tier: 3, adp: 26.0, value: 74, bye: 9, notes: 'Bounce back — target magnet' },
  { name: 'Isiah Pacheco', position: 'RB', tier: 3, adp: 27.0, value: 73, bye: 6, notes: 'Mahomes offense upside' },
  { name: 'DJ Moore', position: 'WR', tier: 3, adp: 28.0, value: 72, bye: 7, notes: 'Target share — WR2 floor' },
  { name: 'Joe Burrow', position: 'QB', tier: 3, adp: 29.0, value: 71, bye: 12, notes: 'Elite passing — injury risk' },
  { name: 'Tee Higgins', position: 'WR', tier: 3, adp: 30.0, value: 70, bye: 12, notes: 'New team upside' },
  { name: 'Aaron Jones', position: 'RB', tier: 4, adp: 31.0, value: 69, bye: 9, notes: 'Reliable veteran floor' },
  { name: 'Mark Andrews', position: 'TE', tier: 4, adp: 32.0, value: 68, bye: 14, notes: 'Boom/bust TE1' },
  { name: 'Mike Evans', position: 'WR', tier: 4, adp: 33.0, value: 67, bye: 11, notes: 'Red zone TD king' },
  { name: 'Deebo Samuel', position: 'WR', tier: 4, adp: 34.0, value: 66, bye: 9, notes: 'Versatile weapon' },
  { name: 'Josh Jacobs', position: 'RB', tier: 4, adp: 35.0, value: 65, bye: 10, notes: 'Volume-dependent back' },
  { name: 'Davante Adams', position: 'WR', tier: 4, adp: 36.0, value: 64, bye: 10, notes: 'Elite route runner — aging' },
]

const AI_TEAM_NAMES = [
  'Shadow Wolves', 'Cyber Falcons', 'Neon Knights', 'Phantom Vipers',
  'Steel Titans', 'Ghost Riders', 'Blaze Runners', 'Iron Hawks',
  'Storm Chasers', 'Dark Phoenix', 'Thunder Bolts', 'Frost Giants',
]

export default function MockDraftSimulatorClient({ leagues }: { leagues: LeagueOption[] }) {
  const [phase, setPhase] = useState<'setup' | 'drafting' | 'complete'>('setup')
  const [selectedLeague, setSelectedLeague] = useState<string>(leagues[0]?.id || '')
  const [draftOrder, setDraftOrder] = useState(1)
  const [numTeams, setNumTeams] = useState(leagues[0]?.leagueSize || 12)
  const [numRounds, setNumRounds] = useState(15)
  const [userTeamName, setUserTeamName] = useState('My Team')
  const [autopick, setAutopick] = useState(false)
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')

  const [picks, setPicks] = useState<DraftPick[]>([])
  const [available, setAvailable] = useState<AvailablePlayer[]>([...MOCK_PLAYERS])
  const [currentPick, setCurrentPick] = useState(1)
  const [isPaused, setIsPaused] = useState(false)
  const [posFilter, setPosFilter] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const totalPicks = numTeams * numRounds
  const currentRound = Math.ceil(currentPick / numTeams)
  const pickInRound = ((currentPick - 1) % numTeams) + 1
  const isSnake = true

  const getCurrentTeamIdx = useCallback((overall: number) => {
    const round = Math.ceil(overall / numTeams)
    const posInRound = ((overall - 1) % numTeams)
    return round % 2 === 1 ? posInRound : numTeams - 1 - posInRound
  }, [numTeams])

  const isUserPick = useCallback((overall: number) => {
    return getCurrentTeamIdx(overall) === draftOrder - 1
  }, [getCurrentTeamIdx, draftOrder])

  const teamNames = useCallback(() => {
    const names: string[] = []
    for (let i = 0; i < numTeams; i++) {
      if (i === draftOrder - 1) {
        names.push(userTeamName)
      } else {
        names.push(AI_TEAM_NAMES[i % AI_TEAM_NAMES.length])
      }
    }
    return names
  }, [numTeams, draftOrder, userTeamName])

  const makeAIPick = useCallback(() => {
    if (available.length === 0) return null
    const topIdx = Math.floor(Math.random() * Math.min(3, available.length))
    return available[topIdx]
  }, [available])

  const draftPlayer = useCallback((player: AvailablePlayer) => {
    const teamIdx = getCurrentTeamIdx(currentPick)
    const names = teamNames()
    const pick: DraftPick = {
      round: currentRound,
      pick: pickInRound,
      overall: currentPick,
      teamIdx,
      teamName: names[teamIdx],
      playerName: player.name,
      position: player.position,
      isUser: teamIdx === draftOrder - 1,
    }
    setPicks(prev => [...prev, pick])
    setAvailable(prev => prev.filter(p => p.name !== player.name))
    const nextPick = currentPick + 1
    if (nextPick > totalPicks) {
      setPhase('complete')
    } else {
      setCurrentPick(nextPick)
    }
  }, [currentPick, currentRound, pickInRound, getCurrentTeamIdx, teamNames, draftOrder, totalPicks])

  useEffect(() => {
    if (phase !== 'drafting' || isPaused) return
    if (currentPick > totalPicks) {
      setPhase('complete')
      return
    }
    if (!isUserPick(currentPick) || autopick) {
      const delay = speed === 'fast' ? 300 : speed === 'slow' ? 1500 : 800
      timerRef.current = setTimeout(() => {
        const player = makeAIPick()
        if (player) draftPlayer(player)
      }, delay)
      return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    }
  }, [phase, currentPick, isPaused, autopick, isUserPick, makeAIPick, draftPlayer, totalPicks, speed])

  const startDraft = () => {
    setPicks([])
    setAvailable([...MOCK_PLAYERS])
    setCurrentPick(1)
    setIsPaused(false)
    setPhase('drafting')
  }

  const resetDraft = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPicks([])
    setAvailable([...MOCK_PLAYERS])
    setCurrentPick(1)
    setIsPaused(false)
    setPhase('setup')
  }

  const filteredAvailable = posFilter
    ? available.filter(p => p.position === posFilter)
    : available

  const userPicks = picks.filter(p => p.isUser)

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-cyan-400" /> Draft Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {leagues.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">League</label>
                <select
                  value={selectedLeague}
                  onChange={(e) => {
                    setSelectedLeague(e.target.value)
                    const l = leagues.find(l => l.id === e.target.value)
                    if (l) setNumTeams(l.leagueSize)
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
                >
                  {leagues.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.platform} &middot; {l.leagueSize}-team{l.isDynasty ? ' Dynasty' : ''})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Your Draft Position</label>
                <select
                  value={draftOrder}
                  onChange={(e) => setDraftOrder(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
                >
                  {Array.from({ length: numTeams }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Pick #{i + 1}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Teams</label>
                <select
                  value={numTeams}
                  onChange={(e) => setNumTeams(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
                >
                  {[8, 10, 12, 14, 16].map(n => (
                    <option key={n} value={n}>{n} teams</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Rounds</label>
                <select
                  value={numRounds}
                  onChange={(e) => setNumRounds(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
                >
                  {[5, 10, 15, 18, 20].map(n => (
                    <option key={n} value={n}>{n} rounds</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">AI Speed</label>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white"
                >
                  <option value="slow">Slow</option>
                  <option value="normal">Normal</option>
                  <option value="fast">Fast</option>
                </select>
              </div>
            </div>

            <Button
              onClick={startDraft}
              size="lg"
              className="w-full bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 hover:from-cyan-600 hover:via-purple-700 hover:to-pink-700 text-lg py-6"
            >
              <Play className="mr-2 h-5 w-5" /> Start Mock Draft
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <Trophy className="h-16 w-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Draft Complete!</h2>
          <p className="text-gray-400">You selected {userPicks.length} players across {numRounds} rounds</p>
        </div>

        <Card className="glass-card max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-xl">Your Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userPicks.map((pick) => (
                <div key={pick.overall} className="flex items-center gap-4 p-3 rounded-xl bg-black/40 border border-cyan-900/20">
                  <div className="w-10 text-center text-xs text-gray-500 font-mono">
                    {pick.round}.{pick.pick}
                  </div>
                  <Badge className={`${POSITION_COLORS[pick.position] || ''} border text-xs px-2`}>
                    {pick.position}
                  </Badge>
                  <span className="font-medium text-white flex-1">{pick.playerName}</span>
                  <span className="text-xs text-gray-500">Overall #{pick.overall}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button onClick={resetDraft} variant="outline" className="border-gray-600">
            <RotateCcw className="mr-2 h-4 w-4" /> New Draft
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-gray-400 uppercase">Round</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">{currentRound}/{numRounds}</span>
          </div>
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-gray-400 uppercase">Pick</span>
            <span className="text-xl font-bold text-purple-400 font-mono">{currentPick}/{totalPicks}</span>
          </div>
          {isUserPick(currentPick) && !autopick && (
            <Badge className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-0 px-4 py-1.5 text-sm animate-pulse">
              YOUR PICK
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsPaused(!isPaused)}
            variant="outline"
            size="sm"
            className="border-gray-600"
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
          <Button
            onClick={() => setAutopick(!autopick)}
            variant="outline"
            size="sm"
            className={autopick ? 'border-cyan-500 text-cyan-400' : 'border-gray-600'}
          >
            <Zap className="h-4 w-4 mr-1" /> Auto
          </Button>
          <Button onClick={resetDraft} variant="outline" size="sm" className="border-gray-600">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
          animate={{ width: `${(currentPick / totalPicks) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 space-y-3">
          <Card className="glass-card max-h-[500px] overflow-hidden flex flex-col">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Recent Picks</span>
                <span className="text-xs text-gray-500 font-normal">{picks.length} made</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <AnimatePresence>
                  {[...picks].reverse().slice(0, 20).map((pick) => (
                    <motion.div
                      key={pick.overall}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                        pick.isUser ? 'bg-cyan-950/30 border border-cyan-500/20' : 'bg-black/30'
                      }`}
                    >
                      <span className="text-[10px] text-gray-500 font-mono w-8 shrink-0">{pick.round}.{String(pick.pick).padStart(2, '0')}</span>
                      <Badge className={`${POSITION_COLORS[pick.position] || ''} border text-[9px] px-1.5 py-0 shrink-0`}>
                        {pick.position}
                      </Badge>
                      <span className={`truncate ${pick.isUser ? 'text-cyan-300 font-medium' : 'text-white/70'}`}>
                        {pick.playerName}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" /> Your Roster ({userPicks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userPicks.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No picks yet</p>
              ) : (
                <div className="space-y-1">
                  {userPicks.map(p => (
                    <div key={p.overall} className="flex items-center gap-2 text-sm">
                      <Badge className={`${POSITION_COLORS[p.position] || ''} border text-[9px] px-1.5 py-0`}>
                        {p.position}
                      </Badge>
                      <span className="text-white/80 truncate">{p.playerName}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">Available Players ({filteredAvailable.length})</CardTitle>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPosFilter(null)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                      !posFilter ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    ALL
                  </button>
                  {POSITIONS.map(pos => (
                    <button
                      key={pos}
                      onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        posFilter === pos ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[440px] overflow-y-auto">
                {filteredAvailable.map((player) => (
                  <div
                    key={player.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isUserPick(currentPick) && !autopick
                        ? 'bg-black/40 border-cyan-900/20 hover:border-cyan-500/40 hover:bg-cyan-950/20 cursor-pointer'
                        : 'bg-black/20 border-transparent opacity-60'
                    }`}
                    onClick={() => {
                      if (isUserPick(currentPick) && !autopick) draftPlayer(player)
                    }}
                  >
                    <Badge className={`${POSITION_COLORS[player.position] || ''} border text-xs px-2 shrink-0`}>
                      {player.position}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm">{player.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          player.tier === 1 ? 'tier-contender' :
                          player.tier === 2 ? 'tier-frisky' :
                          player.tier === 3 ? 'tier-midpack' :
                          'tier-rebuild'
                        }`}>
                          T{player.tier}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate">{player.notes}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-cyan-400">{player.value}</div>
                      <div className="text-[9px] text-gray-500">ADP {player.adp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
