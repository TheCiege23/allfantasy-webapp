'use client'

import { useState } from 'react'

export default function ComparePage() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  async function handleCompare() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/legacy/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_a: a, username_b: b }),
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
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Username A" value={a} onChange={(e) => setA(e.target.value)} />
        <input className="bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Username B" value={b} onChange={(e) => setB(e.target.value)} />
        <button onClick={handleCompare} disabled={loading || !a || !b} className="bg-cyan-600 rounded px-3 py-2 disabled:opacity-50">{loading ? 'Comparing...' : 'Compare'}</button>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      {result && <pre className="text-xs bg-white/5 border border-white/20 rounded p-4 overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
