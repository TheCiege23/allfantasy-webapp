'use client'

import { useState } from 'react'
import { Share2, Twitter, Link2, Check } from 'lucide-react'

export default function ShareBracketButton({ bracketId }: { bracketId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const getShareUrl = async () => {
    if (shareUrl) return shareUrl

    setLoading(true)
    try {
      const res = await fetch('/api/madness/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bracketId }),
      })
      const data = await res.json()
      const url = `${window.location.origin}/api/madness/share-meta/${data.shareId}`
      setShareUrl(url)
      return url
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async () => {
    const url = await getShareUrl()
    if (!url) return
    setOpen(true)
  }

  const shareOnX = () => {
    if (!shareUrl) return
    const text = 'Check out my bracket in AF Madness!'
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`
    window.open(url, '_blank')
  }

  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleShare}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white text-sm font-medium transition-all disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" />
        {loading ? 'Loading...' : 'Share Bracket'}
      </button>

      {open && shareUrl && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-3 space-y-2">
            <button
              onClick={shareOnX}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-800 text-white text-sm transition-colors"
            >
              <Twitter className="h-4 w-4 text-cyan-400" />
              Share on X
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-800 text-white text-sm transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Link2 className="h-4 w-4 text-purple-400" />
              )}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
