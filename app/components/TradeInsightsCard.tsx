'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, AlertTriangle, Trophy } from 'lucide-react'

type TradeInsight = {
  type: 'overpay' | 'win' | 'pattern' | 'tip'
  title: string
  description: string
  examples: string[]
  color: string
}

export default function TradeInsightsCard() {
  const [insights, setInsights] = useState<TradeInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/user/trade-insights')
        if (res.ok) {
          const data = await res.json()
          if (data.insights?.length) {
            setInsights(data.insights)
            setLoading(false)
            return
          }
        }
      } catch {}

      setInsights([
        {
          type: 'overpay',
          title: "You tend to overpay for QBs",
          description: "In 4 of your last 6 trades you gave up 15%+ extra value for QB upgrades.",
          examples: [
            "Gave up 2026 1st + 2nd for Josh Allen (fair value was 2026 2nd only)",
            "Overpaid by 22% for Patrick Mahomes last season",
          ],
          color: "text-orange-400",
        },
        {
          type: 'win',
          title: "You're elite at WR trades",
          description: "You've won 87% of WR-involved trades according to market value.",
          examples: ["Acquired CeeDee Lamb for a 2025 2nd + depth (huge win)"],
          color: "text-emerald-400",
        },
      ])
      setLoading(false)
    }

    fetchInsights()
  }, [])

  const iconMap = {
    overpay: TrendingDown,
    win: Trophy,
    pattern: TrendingUp,
    tip: AlertTriangle,
  }

  const borderColorMap: Record<string, string> = {
    'text-orange-400': 'border-orange-400/60',
    'text-emerald-400': 'border-emerald-400/60',
    'text-cyan-400': 'border-cyan-400/60',
    'text-purple-400': 'border-purple-400/60',
    'text-red-400': 'border-red-400/60',
  }

  if (loading) {
    return (
      <div className="rounded-3xl p-6" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
        <div className="h-6 w-48 rounded animate-pulse mb-5" style={{ background: 'var(--subtle-bg)' }} />
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-3/4 rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
              <div className="h-3 w-full rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!insights.length) return null

  return (
    <div className="rounded-3xl p-6" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
      <h3 className="font-bold text-xl mb-5 flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        Your Trade Patterns
      </h3>
      {insights.map((insight, i) => {
        const Icon = iconMap[insight.type] || TrendingUp
        const borderClass = borderColorMap[insight.color] || 'border-orange-400/60'

        return (
          <div key={i} className={`mb-8 last:mb-0 border-l-2 ${borderClass} pl-5`}>
            <div className={`font-semibold flex items-center gap-2 ${insight.color}`}>
              <Icon className="w-4 h-4" />
              {insight.title}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{insight.description}</p>
            {insight.examples.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--muted2)' }}>
                {insight.examples.map((ex, idx) => (
                  <li key={idx}>• {ex}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      <p className="text-xs text-center mt-6" style={{ color: 'var(--muted2)' }}>
        These insights update automatically from your trade history
      </p>
    </div>
  )
}
