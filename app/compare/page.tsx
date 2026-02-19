'use client'

import { useState } from 'react'

interface ManagerGrade {
  username: string
  overall_grade: string
  grades_by_type: Record<string, { grade: string; record: string; championships: number; leagues_played: number; note: string }>
  strengths: string[]
  weaknesses: string[]
  specialty_formats_note?: string
}

interface CompareResult {
  manager_a: ManagerGrade
  manager_b: ManagerGrade
  winner: string
  winner_username: string
  summary: string
  fair_comparison_possible: boolean
  comparable_formats: string[]
}

export default function ComparePage() {
  const [usernameA, setUsernameA] = useState('')
  const [usernameB, setUsernameB] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [error, setError] = useState('')

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault()
    if (!usernameA.trim() || !usernameB.trim()) {
      setError('Please enter both Sleeper usernames.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/legacy/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_a: usernameA.trim(), username_b: usernameB.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Comparison failed')
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function gradeColor(grade: string) {
    if (!grade || grade === 'N/A') return 'text-gray-500'
    if (grade.startsWith('A')) return 'text-green-400'
    if (grade.startsWith('B')) return 'text-blue-400'
    if (grade.startsWith('C')) return 'text-yellow-400'
    return 'text-red-400'
  }

  function ManagerCard({ manager, isWinner }: { manager: ManagerGrade; isWinner: boolean }) {
    return (
      <div className={`bg-white/5 border rounded-xl p-5 space-y-4 ${isWinner ? 'border-green-500/50' : 'border-white/10'}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{manager.username}</h3>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${gradeColor(manager.overall_grade)}`}>{manager.overall_grade}</span>
            {isWinner && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">WINNER</span>}
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries(manager.grades_by_type || {}).map(([type, info]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-gray-400 capitalize">{type}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{info.record} &middot; {info.championships} titles &middot; {info.leagues_played} leagues</span>
                <span className={`font-semibold ${gradeColor(info.grade)}`}>{info.grade}</span>
              </div>
            </div>
          ))}
        </div>

        {manager.strengths?.length > 0 && (
          <div>
            <h4 className="text-xs text-gray-500 uppercase mb-1">Strengths</h4>
            <ul className="space-y-1">
              {manager.strengths.map((s, i) => (
                <li key={i} className="text-sm text-green-300 flex items-start gap-1"><span className="mt-0.5">+</span>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {manager.weaknesses?.length > 0 && (
          <div>
            <h4 className="text-xs text-gray-500 uppercase mb-1">Weaknesses</h4>
            <ul className="space-y-1">
              {manager.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-red-300 flex items-start gap-1"><span className="mt-0.5">-</span>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {manager.specialty_formats_note && (
          <p className="text-xs text-gray-500 italic">{manager.specialty_formats_note}</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Manager Compare</h1>
        <p className="text-gray-400 mb-6">Compare two Sleeper managers head-to-head with AI-powered analysis across all league types.</p>

        <form onSubmit={handleCompare} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Manager A</label>
            <input
              type="text"
              value={usernameA}
              onChange={(e) => setUsernameA(e.target.value)}
              placeholder="Sleeper username"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Manager B</label>
            <input
              type="text"
              value={usernameB}
              onChange={(e) => setUsernameB(e.target.value)}
              placeholder="Sleeper username"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg px-4 py-3 font-semibold transition-colors"
          >
            {loading ? 'Analyzing...' : 'Compare Managers'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">{error}</div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-400">Fetching league data and running AI analysis...</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {!result.fair_comparison_possible && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-300 text-sm">
                These managers play different formats, so a direct comparison may not be fully fair.
              </div>
            )}

            {result.comparable_formats?.length > 0 && (
              <p className="text-sm text-gray-500">Compared formats: {result.comparable_formats.join(', ')}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ManagerCard manager={result.manager_a} isWinner={result.winner === 'A'} />
              <ManagerCard manager={result.manager_b} isWinner={result.winner === 'B'} />
            </div>

            {result.summary && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
                <h3 className="font-semibold mb-2">Summary</h3>
                <p className="text-sm text-gray-300">{result.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
