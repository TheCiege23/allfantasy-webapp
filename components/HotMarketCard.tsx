'use client'

import { useState, useEffect, useCallback } from 'react'

interface PositionDemand {
  position: string
  demandScore: number
  avgOverpayPct: number
  tradeVolume: number
  premiumPlayers: string[]
}

interface HotMarketProps {
  leagueId: string
}

export default function HotMarketCard({ leagueId }: HotMarketProps) {
  const [positions, setPositions] = useState<PositionDemand[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDemand = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leagues/demand-index?leagueId=${leagueId}&range=90&mode=cached`)
      if (res.ok) {
        const json = await res.json()
        setPositions(json.positionDemand ?? [])
      }
    } catch {
    }
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    if (leagueId) fetchDemand()
  }, [leagueId, fetchDemand])

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-40 mb-3" />
        <div className="space-y-2">
          <div className="h-8 bg-gray-800 rounded" />
          <div className="h-8 bg-gray-800 rounded" />
        </div>
      </div>
    )
  }

  const sorted = [...positions].sort((a, b) => b.demandScore - a.demandScore)
  const hot = sorted.filter(p => p.demandScore >= 60).slice(0, 2)
  const cold = sorted.filter(p => p.demandScore <= 40).slice(-2).reverse()

  if (hot.length === 0 && cold.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">Your League&apos;s Hot Market</h3>
      </div>
      <div className="p-4 space-y-3">
        {hot.length > 0 && (
          <div>
            <div className="text-xs text-red-400 font-medium mb-2">High Demand (Sell High)</div>
            {hot.map(p => (
              <div key={p.position} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{p.position}</span>
                  <span className="text-xs text-red-400">+{p.avgOverpayPct}% premium</span>
                </div>
                <span className="text-xs text-gray-400">{p.tradeVolume} trades</span>
              </div>
            ))}
          </div>
        )}

        {cold.length > 0 && (
          <div>
            <div className="text-xs text-cyan-400 font-medium mb-2">Low Demand (Buy Low)</div>
            {cold.map(p => (
              <div key={p.position} className="flex items-center justify-between bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{p.position}</span>
                  <span className="text-xs text-cyan-400">{p.avgOverpayPct}% discount</span>
                </div>
                <span className="text-xs text-gray-400">{p.tradeVolume} trades</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-gray-800">
          <div className="text-xs text-gray-500 font-medium mb-1">Exploit Ideas</div>
          {hot.length > 0 && cold.length > 0 && (
            <p className="text-xs text-gray-400">
              Sell {hot[0].position} depth you don&apos;t need — your league overpays.
              Target {cold[0].position} assets at a discount — they&apos;re undervalued in your league.
            </p>
          )}
          {hot.length > 0 && cold.length === 0 && (
            <p className="text-xs text-gray-400">
              Sell {hot[0].position} depth — your league is paying a premium for that position right now.
            </p>
          )}
          {hot.length === 0 && cold.length > 0 && (
            <p className="text-xs text-gray-400">
              Buy {cold[0].position} assets — they&apos;re being undervalued by your league right now.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
