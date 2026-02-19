'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MessageSquare } from 'lucide-react'

type Conversation = {
  id: string
  message: string
  createdAt: string
  senderId: string
  partnerId: string
  partnerUsername: string
  partnerDisplayName: string | null
  partnerAvatarUrl: string | null
  unreadCount: number
}

export default function DMInboxClient({ userId }: { userId: string }) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/dm')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchConversations, 8000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations])

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const getInitial = (name: string) => (name?.[0] || '?').toUpperCase()

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <div className="p-4 border-b border-gray-800 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <MessageSquare className="w-5 h-5 text-cyan-400" />
          <h1 className="font-semibold text-white text-lg">Direct Messages</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading conversations...</span>
            </div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
            <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 opacity-40" />
            </div>
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs text-gray-600">Tap a member&apos;s name in league chat to start a DM</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {conversations.map((conv) => {
              const name = conv.partnerDisplayName || conv.partnerUsername
              return (
                <button
                  key={conv.partnerId}
                  onClick={() => router.push(`/madness/dm/${conv.partnerId}`)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-800/40 transition-colors text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-700 to-pink-700 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                    {conv.partnerAvatarUrl ? (
                      <img src={conv.partnerAvatarUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      getInitial(name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white truncate">{name}</span>
                      <span className="text-[11px] text-gray-500 flex-shrink-0 ml-2">
                        {formatTime(conv.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-400 truncate">
                        {conv.senderId === userId ? 'You: ' : ''}
                        {conv.message}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[10px] font-bold text-white">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
