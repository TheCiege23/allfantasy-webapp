'use client'

import { useState, useEffect } from 'react'

interface TradingProfile {
  userId: string
  sleeperUsername: string
  totalTrades: number
  tradingStyle: {
    youthVsProduction: number
    consolidationVsDepth: number
    picksVsPlayers: number
    riskTolerance: number
  }
  positionPreferences: Array<{
    position: string
    acquired: number
    traded: number
    netAcquired: number
  }>
  favoriteTradePartners: Array<{
    managerId: string
    managerName: string
    tradeCount: number
  }>
  avgTradeValue: number
  preferredTierRange: { min: number; max: number }
  winRate: number
  recentTrends: {
    lastTradeDate: string | null
    tradesLast30Days: number
    tradesLast90Days: number
  }
}

interface TradeRecommendation {
  id: string
  tradeType: 'acquire' | 'sell' | 'swap'
  confidence: number
  reason: string
  playerToAcquire?: {
    name: string
    position: string
    team: string
    value: number
    tier: number | null
    whyGoodFit: string
  }
  playerToTrade?: {
    name: string
    position: string
    team: string
    value: number
    tier: number | null
    whySellNow: string
  }
  valueMatch: {
    differential: number
    fairnessScore: number
  }
  basedOn: string[]
  suggestedTargetManagers?: string[]
}

interface SmartRecommendationsResult {
  recommendations: TradeRecommendation[]
  userProfile: TradingProfile
  marketInsights: {
    hotPlayers: string[]
    undervaluedPositions: string[]
    overvaluedPositions: string[]
  }
  generatedAt: string
}

interface Props {
  username: string
  leagueId: string | null
  sport?: 'nfl' | 'nba'
}

export default function SmartRecommendations({ username, leagueId, sport = 'nfl' }: Props) {
  const [loading, setLoading] = useState(false)
  const [checkingEligibility, setCheckingEligibility] = useState(true)
  const [isEligible, setIsEligible] = useState(false)
  const [profile, setProfile] = useState<TradingProfile | null>(null)
  const [recommendations, setRecommendations] = useState<SmartRecommendationsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function checkEligibility() {
      if (!username) {
        setCheckingEligibility(false)
        return
      }

      try {
        const res = await fetch(`/api/legacy/smart-recommendations?username=${encodeURIComponent(username)}`)
        const data = await res.json()
        setIsEligible(data.hasRecommendations)
        setProfile(data.profile)
      } catch {
        setIsEligible(false)
      } finally {
        setCheckingEligibility(false)
      }
    }

    checkEligibility()
  }, [username])

  const generateRecommendations = async () => {
    if (!leagueId) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/legacy/smart-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, leagueId, sport }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to generate recommendations')
      }

      const data = await res.json()
      setRecommendations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checkingEligibility) {
    return null
  }

  if (!isEligible) {
    return (
      <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h4 className="font-semibold text-white">Smart Trade Recommendations</h4>
            <p className="text-sm text-white/60">
              Complete more trades to unlock AI-powered personalized recommendations based on your trading style.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧠</span>
            <div>
              <h4 className="font-semibold text-white">Smart Trade Recommendations</h4>
              <p className="text-sm text-white/60">
                AI-powered suggestions based on your {profile?.totalTrades || 0} historical trades
              </p>
            </div>
          </div>
          
          {!recommendations && (
            <button
              onClick={generateRecommendations}
              disabled={loading || !leagueId}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Get Smart Recommendations
                </>
              )}
            </button>
          )}
        </div>

        {profile && !recommendations && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-black/30 rounded-lg">
              <div className="text-xs text-white/50">Trade Win Rate</div>
              <div className="text-lg font-bold text-emerald-400">{profile.winRate}%</div>
            </div>
            <div className="p-3 bg-black/30 rounded-lg">
              <div className="text-xs text-white/50">Trading Style</div>
              <div className="text-lg font-bold text-cyan-400">
                {profile.tradingStyle.consolidationVsDepth > 20 ? 'Consolidator' : 
                 profile.tradingStyle.consolidationVsDepth < -20 ? 'Depth Builder' : 'Balanced'}
              </div>
            </div>
            <div className="p-3 bg-black/30 rounded-lg">
              <div className="text-xs text-white/50">Position Focus</div>
              <div className="text-lg font-bold text-purple-400">
                {profile.positionPreferences[0]?.position || 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-black/30 rounded-lg">
              <div className="text-xs text-white/50">Recent Activity</div>
              <div className="text-lg font-bold text-yellow-400">
                {profile.recentTrends.tradesLast30Days} / 30d
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">
          {error}
        </div>
      )}

      {recommendations && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-white">Your Personalized Recommendations</h4>
            <button
              onClick={() => setRecommendations(null)}
              className="text-sm text-white/50 hover:text-white transition"
            >
              Refresh
            </button>
          </div>

          {recommendations.recommendations.map((rec) => (
            <div 
              key={rec.id}
              className="bg-black/40 border border-white/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === rec.id ? null : rec.id)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                    rec.tradeType === 'acquire' ? 'bg-emerald-500/20' :
                    rec.tradeType === 'sell' ? 'bg-orange-500/20' : 'bg-purple-500/20'
                  }`}>
                    {rec.tradeType === 'acquire' ? '📈' : rec.tradeType === 'sell' ? '📉' : '🔄'}
                  </div>
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      {rec.tradeType === 'acquire' && rec.playerToAcquire && (
                        <span>Target: {rec.playerToAcquire.name}</span>
                      )}
                      {rec.tradeType === 'sell' && rec.playerToTrade && (
                        <span>Sell High: {rec.playerToTrade.name}</span>
                      )}
                      {rec.tradeType === 'swap' && (
                        <span>Swap: {rec.playerToTrade?.name} → {rec.playerToAcquire?.name}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        rec.confidence >= 85 ? 'bg-emerald-500/20 text-emerald-400' :
                        rec.confidence >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-orange-500/20 text-orange-400'
                      }`}>
                        {rec.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-1">{rec.reason}</p>
                  </div>
                </div>
                <span className="text-white/30">{expanded === rec.id ? '▲' : '▼'}</span>
              </button>

              {expanded === rec.id && (
                <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
                  {rec.playerToAcquire && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <div className="text-xs text-emerald-400 mb-1">Player to Acquire</div>
                      <div className="font-semibold text-white">
                        {rec.playerToAcquire.name} ({rec.playerToAcquire.position}, {rec.playerToAcquire.team})
                      </div>
                      <div className="text-sm text-white/70 mt-1">{rec.playerToAcquire.whyGoodFit}</div>
                      <div className="text-xs text-white/50 mt-2">
                        Value: {rec.playerToAcquire.value} | Tier: {rec.playerToAcquire.tier ?? 'N/A'}
                      </div>
                    </div>
                  )}

                  {rec.playerToTrade && (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <div className="text-xs text-orange-400 mb-1">Player to Trade Away</div>
                      <div className="font-semibold text-white">
                        {rec.playerToTrade.name} ({rec.playerToTrade.position}, {rec.playerToTrade.team})
                      </div>
                      <div className="text-sm text-white/70 mt-1">{rec.playerToTrade.whySellNow}</div>
                      <div className="text-xs text-white/50 mt-2">
                        Value: {rec.playerToTrade.value} | Tier: {rec.playerToTrade.tier ?? 'N/A'}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm">
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg">
                      <span className="text-white/50">Fairness:</span>{' '}
                      <span className={rec.valueMatch.fairnessScore >= 80 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {rec.valueMatch.fairnessScore}%
                      </span>
                    </div>
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg">
                      <span className="text-white/50">Value Diff:</span>{' '}
                      <span className={rec.valueMatch.differential >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {rec.valueMatch.differential >= 0 ? '+' : ''}{rec.valueMatch.differential}
                      </span>
                    </div>
                  </div>

                  {rec.suggestedTargetManagers && rec.suggestedTargetManagers.length > 0 && (
                    <div>
                      <div className="text-xs text-white/50 mb-2">Potential Trade Partners</div>
                      <div className="flex flex-wrap gap-2">
                        {rec.suggestedTargetManagers.map((manager, idx) => (
                          <span key={idx} className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm">
                            {manager}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-xs text-white/50 mb-2">Based On</div>
                    <div className="flex flex-wrap gap-2">
                      {rec.basedOn.map((insight, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs">
                          {insight}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {recommendations.marketInsights.hotPlayers.length > 0 && (
            <div className="p-4 bg-black/30 border border-white/10 rounded-xl">
              <h5 className="text-sm font-semibold text-white mb-2">Market Insights</h5>
              <div className="text-xs text-white/50">
                <span className="text-emerald-400">Hot Players:</span>{' '}
                {recommendations.marketInsights.hotPlayers.slice(0, 5).join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
