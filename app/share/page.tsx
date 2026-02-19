'use client'

import { useState } from 'react'

const STYLES = [
  { value: 'clean', label: 'Clean' },
  { value: 'funny', label: 'Funny' },
  { value: 'hype', label: 'Hype' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'humble', label: 'Humble' },
  { value: 'trash_talk', label: 'Trash Talk' },
]

const PLATFORMS = [
  { value: 'x', label: 'X / Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
]

interface ShareResult {
  caption: string
  alt_captions: string[]
  hashtags: string[]
}

export default function SharePage() {
  const [username, setUsername] = useState('')
  const [style, setStyle] = useState('clean')
  const [platform, setPlatform] = useState('x')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ShareResult | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<number | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) {
      setError('Please enter your Sleeper username.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/legacy/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeper_username: username.trim(),
          share_type: 'legacy',
          style,
          platform,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(index)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] via-[#0a051f] to-[#0f0a24] text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Share Generator</h1>
        <p className="text-gray-400 mb-6">Generate social media captions for your fantasy legacy — pick your tone and platform.</p>

        <form onSubmit={handleGenerate} className="space-y-4 mb-8">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              >
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#0a051f]">{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-[#0a051f]">{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg px-4 py-3 font-semibold transition-colors"
          >
            {loading ? 'Generating...' : 'Generate Caption'}
          </button>
        </form>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-300">{error}</div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-400">Crafting your caption...</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
              <h3 className="text-sm text-gray-400 uppercase">Main Caption</h3>
              <p className="text-white whitespace-pre-wrap">{result.caption}</p>
              <button
                onClick={() => copyToClipboard(result.caption, 0)}
                className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {copied === 0 ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>

            {result.alt_captions?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm text-gray-400 uppercase">Alternatives</h3>
                {result.alt_captions.map((alt, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap flex-1">{alt}</p>
                    <button
                      onClick={() => copyToClipboard(alt, i + 1)}
                      className="text-xs text-purple-400 hover:text-purple-300 shrink-0"
                    >
                      {copied === i + 1 ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {result.hashtags?.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <h3 className="text-sm text-gray-400 uppercase mb-2">Hashtags</h3>
                <div className="flex flex-wrap gap-2">
                  {result.hashtags.map((tag, i) => (
                    <span key={i} className="text-sm text-purple-300 bg-purple-500/10 rounded-full px-3 py-1">
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => copyToClipboard(result.hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' '), -1)}
                  className="text-xs text-purple-400 hover:text-purple-300 mt-2"
                >
                  {copied === -1 ? 'Copied!' : 'Copy all hashtags'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
