"use client"

import { useState, useEffect } from 'react'
import { Gift, User, Calendar, Coins, TrendingUp, RefreshCw } from 'lucide-react'

interface ShareReward {
  id: string
  sleeperUsername: string
  leagueId: string | null
  shareType: string
  shareContent: any
  tokensAwarded: number
  platform: string | null
  redeemed: boolean
  redeemedAt: string | null
  createdAt: string
}

interface Stats {
  totalShares: number
  totalTokensAwarded: number
  uniqueUsers: number
  todayShares: number
  unredeemed: number
}

export default function AdminShareRewards() {
  const [rewards, setRewards] = useState<ShareReward[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const perPage = 20

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/share-rewards?page=${page}&limit=${perPage}`)
      const data = await res.json()
      if (res.ok) {
        setRewards(data.rewards || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to fetch share rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [page])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Share Rewards</h2>
          <p className="text-sm text-gray-400">Track users sharing trade results for AI tokens</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Gift className="w-4 h-4" />
              <span className="text-xs font-medium">Total Shares</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalShares}</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30">
            <div className="flex items-center gap-2 text-cyan-400 mb-2">
              <Coins className="w-4 h-4" />
              <span className="text-xs font-medium">Tokens Awarded</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalTokensAwarded}</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <User className="w-4 h-4" />
              <span className="text-xs font-medium">Unique Users</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.uniqueUsers}</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">Today</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.todayShares}</div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/30">
            <div className="flex items-center gap-2 text-rose-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Unredeemed</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.unredeemed}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-black/30 border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left p-3 text-gray-400 font-medium">User</th>
              <th className="text-left p-3 text-gray-400 font-medium">Type</th>
              <th className="text-left p-3 text-gray-400 font-medium">Platform</th>
              <th className="text-left p-3 text-gray-400 font-medium">Tokens</th>
              <th className="text-left p-3 text-gray-400 font-medium">Status</th>
              <th className="text-left p-3 text-gray-400 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading...
                </td>
              </tr>
            ) : rewards.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No share rewards yet
                </td>
              </tr>
            ) : (
              rewards.map((reward) => (
                <tr key={reward.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3">
                    <div className="font-medium text-white">{reward.sleeperUsername}</div>
                    {reward.leagueId && (
                      <div className="text-xs text-gray-500 truncate max-w-[120px]">{reward.leagueId}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {reward.shareType.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-gray-400">{reward.platform || '—'}</td>
                  <td className="p-3">
                    <span className="font-semibold text-cyan-400">+{reward.tokensAwarded}</span>
                  </td>
                  <td className="p-3">
                    {reward.redeemed ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Redeemed
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-gray-400">{formatDate(reward.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rewards.length >= perPage && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-gray-400 text-sm">Page {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
