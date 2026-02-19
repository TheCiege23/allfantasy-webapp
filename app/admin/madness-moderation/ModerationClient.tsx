'use client'

import { useState } from 'react'

type Flag = {
  id: string
  reason: string
  createdAt: string
  message: {
    id: string
    message: string
    user: { username: string; displayName: string | null }
  }
  reportedBy: { username: string; displayName: string | null }
}

export default function ModerationClient({ initialFlags }: { initialFlags: Flag[] }) {
  const [flags, setFlags] = useState(initialFlags)
  const [processing, setProcessing] = useState<string | null>(null)

  const resolveFlag = async (flagId: string, status: string) => {
    setProcessing(flagId)
    try {
      const res = await fetch('/api/madness/moderate-flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagId, status }),
      })
      if (res.ok) {
        setFlags(prev => prev.filter(f => f.id !== flagId))
      }
    } catch {} finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">
      {flags.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No pending flags — chat is clean!
        </div>
      ) : (
        flags.map(flag => (
          <div key={flag.id} className="bg-gray-950 border border-red-900/50 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-medium text-white">
                  Reported by <span className="text-cyan-400">{flag.reportedBy.displayName || flag.reportedBy.username}</span>
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(flag.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300 border border-red-800/50">
                {flag.reason.toUpperCase()}
              </span>
            </div>

            <div className="mb-2 text-xs text-gray-500">
              Sent by <span className="text-gray-400">{flag.message.user.displayName || flag.message.user.username}</span>
            </div>

            <div className="bg-black/60 p-4 rounded-lg mb-4 border border-gray-800">
              <p className="text-gray-300">{flag.message.message}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => resolveFlag(flag.id, 'dismissed')}
                disabled={processing === flag.id}
                className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Dismiss
              </button>
              <button
                onClick={() => resolveFlag(flag.id, 'resolved')}
                disabled={processing === flag.id}
                className="px-4 py-2 text-sm rounded-lg border border-green-600 text-green-400 hover:bg-green-900/30 transition-colors disabled:opacity-50"
              >
                Resolve
              </button>
              <button
                onClick={() => resolveFlag(flag.id, 'deleted')}
                disabled={processing === flag.id}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Delete Message
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
