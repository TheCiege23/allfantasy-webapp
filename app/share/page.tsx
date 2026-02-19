'use client'

import { useState } from 'react'

export default function SharePage() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/legacy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_username: username, share_type: 'legacy', platform: 'x' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Share generation failed')
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Share generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a051f] text-white p-6 md:p-10 space-y-4">
      <h1 className="text-3xl font-bold">Share Generator</h1>
      <div className="flex gap-3 max-w-2xl">
        <input className="flex-1 bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Sleeper username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <button onClick={handleGenerate} disabled={loading || !username} className="bg-cyan-600 rounded px-3 py-2 disabled:opacity-50">{loading ? 'Generating...' : 'Generate'}</button>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      {result && <pre className="text-xs bg-white/5 border border-white/20 rounded p-4 overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  )
}
