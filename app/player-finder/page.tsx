'use client'

import { useState } from 'react'

export default function PlayerFinderPage() {
  const [username, setUsername] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<any[]>([])

  async function handleSearch() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/legacy/player-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_username: username, query }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setPlayers(data.players || [])
    } catch (e: any) {
      setError(e.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a051f] text-white p-6 md:p-10 space-y-4">
      <h1 className="text-3xl font-bold">Player Finder</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Sleeper username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Player name" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button onClick={handleSearch} disabled={loading || !username || query.length < 2} className="bg-cyan-600 rounded px-3 py-2 disabled:opacity-50">{loading ? 'Searching...' : 'Search'}</button>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      <div className="space-y-2">
        {players.map((p, i) => (
          <div key={`${p.player_id || p.name}-${i}`} className="border border-white/10 rounded p-3 bg-white/5">
            <div className="font-semibold">{p.full_name || p.name || p.player_id}</div>
            <div className="text-sm text-white/70">{p.position || '—'} {p.team ? `• ${p.team}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
