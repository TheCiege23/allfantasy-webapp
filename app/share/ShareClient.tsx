'use client'

import { useState } from 'react'

export default function ShareClient({ defaultUsername = '' }: { defaultUsername?: string }) {
  const [username, setUsername] = useState(defaultUsername)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ caption?: string; hashtags?: string[]; alt_captions?: string[] } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    const normalizedUsername = username.trim().toLowerCase()
    if (!normalizedUsername) {
      setError('Sleeper username is required')
      return
    }

    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const res = await fetch('/api/legacy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeper_username: normalizedUsername, share_type: 'legacy', platform: 'x' }),
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

  async function copyCaption() {
    if (!result?.caption) return
    const text = [result.caption, result.hashtags?.join(' ')].filter(Boolean).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0a051f] text-white p-6 md:p-10 space-y-4">
      <h1 className="text-3xl font-bold">Share Generator</h1>
      <div className="flex gap-3 max-w-2xl">
        <input className="flex-1 bg-white/5 border border-white/20 rounded px-3 py-2" placeholder="Sleeper username" value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} />
        <button onClick={handleGenerate} disabled={loading || !username.trim()} className="bg-cyan-600 rounded px-3 py-2 disabled:opacity-50">{loading ? 'Generating...' : 'Generate'}</button>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      {result && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-white/5 border border-white/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50">Caption</div>
              <button onClick={copyCaption} className="text-xs text-cyan-400 hover:text-cyan-300 transition">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{result.caption || '—'}</p>
          </div>

          {result.hashtags && result.hashtags.length > 0 && (
            <div className="bg-white/5 border border-white/20 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-2">Hashtags</div>
              <div className="flex flex-wrap gap-2">
                {result.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                    {tag.startsWith('#') ? tag : `#${tag}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.alt_captions && result.alt_captions.length > 0 && (
            <div className="bg-white/5 border border-white/20 rounded-xl p-4">
              <div className="text-xs text-white/50 mb-2">Alternative Captions</div>
              <div className="space-y-2">
                {result.alt_captions.map((alt, i) => (
                  <p key={i} className="text-sm text-white/70 whitespace-pre-wrap">{alt}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
