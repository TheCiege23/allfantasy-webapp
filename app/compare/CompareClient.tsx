'use client'

import { useState } from 'react'

export default function CompareClient({ defaultUsername = '' }: { defaultUsername?: string }) {
  const [a, setA] = useState(defaultUsername)
  const [b, setB] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [searched, setSearched] = useState(false)

  async function handleCompare() {
    const userA = a.trim().toLowerCase()
    const userB = b.trim().toLowerCase()

    if (!userA || !userB) {
      setError('Both usernames are required')
      return
    }

    if (userA === userB) {
      setError('Usernames must be different')
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch('/api/legacy/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_a: userA, username_b: userB }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Compare failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Compare failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a051f] text-white p-6 md:p-10 space-y-4">
      <h1 className="text-3xl font-bold">Manager Compare</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Username A" value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCompare()} />
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Username B" value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCompare()} />
        <button onClick={handleCompare} disabled={loading || !a.trim() || !b.trim()} className="bg-cyan-600 rounded px-3 py-2 disabled:opacity-50">{loading ? 'Comparing...' : 'Compare'}</button>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      {!loading && !error && !result && !searched && (
        <p className="text-white/60 text-sm">Enter two Sleeper usernames to compare their dynasty profiles.</p>
      )}
      {result && (
        <div className="space-y-4">
          {result.winner && (
            <div className="bg-white/5 border border-cyan-500/30 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Winner</div>
              <div className="text-lg font-bold text-cyan-300">{result.winner}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['a', 'b'].map((side) => {
              const profile = result[`manager_${side}`] || result[side]
              if (!profile) return null
              const name = side === 'a' ? a.trim() : b.trim()
              return (
                <div key={side} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                  <div className="text-sm font-semibold text-white">{name}</div>
                  {profile.grade && <div className="text-xs text-amber-300">Grade: {profile.grade}</div>}
                  {profile.overall_score != null && <div className="text-xs text-white/70">Score: {profile.overall_score}</div>}
                  {profile.total_value != null && <div className="text-xs text-white/70">Total Value: {Math.round(profile.total_value).toLocaleString()}</div>}
                  {profile.win_rate != null && <div className="text-xs text-white/70">Win Rate: {(profile.win_rate * 100).toFixed(1)}%</div>}
                  {profile.record && <div className="text-xs text-white/70">Record: {profile.record}</div>}
                  {profile.roster_count != null && <div className="text-xs text-white/70">Roster Size: {profile.roster_count}</div>}
                  {profile.league_count != null && <div className="text-xs text-white/70">Leagues: {profile.league_count}</div>}
                </div>
              )
            })}
          </div>

          {result.summary && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-1">Summary</div>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{result.summary}</p>
            </div>
          )}

          <details className="text-xs">
            <summary className="text-white/40 cursor-pointer hover:text-white/60">View raw data</summary>
            <pre className="mt-2 bg-white/5 border border-white/10 rounded p-3 overflow-auto text-white/60">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
