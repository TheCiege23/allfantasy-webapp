'use client'

import { useState } from 'react'

interface PlayerResult {
  name: string
  position: string
  team: string
  age?: number
  experience?: string
  injury?: string
  depthChart?: string
  stockMovement?: {
    direction: string
    signal: string
    reason: string
  }
  ownership?: {
    leaguesOwned: number
    totalLeagues: number
    percentage: number
    isStarter: boolean
  }
  aiInsight?: string
}

export default function PlayerFinderPage() {
  const [username, setUsername] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PlayerResult[] | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !query.trim()) {
      setError('Please enter both your Sleeper username and a player search.')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch('/api/legacy/player-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_username: username.trim(), query: query.trim(), sport: 'nfl' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results || data.players || [data])
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function signalColor(signal?: string) {
    if (!signal) return 'text-gray-400'
    if (signal.includes('buy')) return 'text-green-400'
    if (signal.includes('sell')) return 'text-red-400'
    return 'text-yellow-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Player Finder</h1>
        <p className="text-gray-400 mb-6">Search any NFL player for ownership, stock movement, and AI insights across your leagues.</p>

        <form onSubmit={handleSearch} className="space-y-4 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Sleeper Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Sleeper username"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Player Search</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. CeeDee Lamb, Josh Allen"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg px-4 py-3 font-semibold transition-colors"
          >
            {loading ? 'Searching...' : 'Find Player'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">{error}</div>
        )}

        {results && results.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center text-gray-400">No players found matching your search.</div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-4">
            {results.map((p, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <span className="text-sm text-gray-400">{p.position} &middot; {p.team}</span>
                    {p.age && <span className="text-sm text-gray-500 ml-2">Age {p.age}</span>}
                  </div>
                  {p.stockMovement && (
                    <span className={`text-sm font-semibold uppercase ${signalColor(p.stockMovement.signal)}`}>
                      {p.stockMovement.signal?.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {p.injury && (
                  <div className="text-xs text-yellow-400 bg-yellow-400/10 rounded px-2 py-1 inline-block">{p.injury}</div>
                )}
                {p.ownership && (
                  <div className="text-sm text-gray-300">
                    Owned in <span className="text-white font-semibold">{p.ownership.leaguesOwned}/{p.ownership.totalLeagues}</span> leagues ({p.ownership.percentage}%)
                    {p.ownership.isStarter && <span className="ml-2 text-green-400 text-xs">STARTER</span>}
                  </div>
                )}
                {p.stockMovement?.reason && (
                  <p className="text-sm text-gray-400">{p.stockMovement.reason}</p>
                )}
                {p.aiInsight && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-sm text-purple-200">{p.aiInsight}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
