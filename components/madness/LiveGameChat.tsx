'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, MessageCircle, X, Flag, SmilePlus } from 'lucide-react'

const REACTION_EMOJIS = ['👍', '😂', '🔥', '❤️', '💀', '🏀']

type Reaction = { emoji: string; userId: string }

type ChatMessage = {
  id: string
  message: string
  createdAt: string
  reactions?: Reaction[]
  user: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

type GroupedReaction = { emoji: string; count: number; hasReacted: boolean }

function groupReactions(reactions: Reaction[], currentUserId: string): GroupedReaction[] {
  const map = new Map<string, { count: number; hasReacted: boolean }>()
  for (const r of reactions) {
    const existing = map.get(r.emoji) || { count: 0, hasReacted: false }
    existing.count++
    if (r.userId === currentUserId) existing.hasReacted = true
    map.set(r.emoji, existing)
  }
  return Array.from(map.entries()).map(([emoji, data]) => ({ emoji, ...data }))
}

export default function LiveGameChat({ leagueId, currentUserId }: { leagueId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/madness/chat?leagueId=${leagueId}`)
      if (!res.ok) return
      const data = await res.json()
      setMessages(prev => {
        const newCount = data.messages.length - prev.length
        if (!open && newCount > 0) setUnread(u => u + newCount)
        return data.messages
      })
    } catch {}
  }, [leagueId, open])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  useEffect(() => {
    if (open) {
      setUnread(0)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages.length])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    try {
      const res = await fetch('/api/madness/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, message: text }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(prev => [...prev, msg])
        setInput('')
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch {} finally {
      setSending(false)
    }
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    setPickerOpenFor(null)
    try {
      const res = await fetch('/api/madness/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      })
      if (res.ok) {
        const { action } = await res.json()
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id !== messageId) return msg
            const reactions = [...(msg.reactions || [])]
            if (action === 'added') {
              reactions.push({ emoji, userId: currentUserId })
            } else {
              const idx = reactions.findIndex(r => r.emoji === emoji && r.userId === currentUserId)
              if (idx !== -1) reactions.splice(idx, 1)
            }
            return { ...msg, reactions }
          }),
        )
      }
    } catch {}
  }

  const reportMessage = async (messageId: string) => {
    const reason = prompt('Why are you reporting this message?\n\nOptions: spam, harassment, profanity, inappropriate, other')
    if (!reason) return
    const normalized = reason.toLowerCase().trim()
    const valid = ['spam', 'harassment', 'profanity', 'inappropriate', 'other']
    const matched = valid.find(v => normalized.includes(v)) || 'other'

    try {
      const res = await fetch('/api/madness/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, reason: matched }),
      })
      if (res.ok) {
        setFlaggedIds(prev => new Set(prev).add(messageId))
      } else {
        const data = await res.json()
        alert(data.error || 'Could not report message')
      }
    } catch {}
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white flex items-center justify-center shadow-2xl shadow-cyan-950/50 transition-all"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 h-[28rem] bg-black/95 border border-cyan-900/50 rounded-tl-3xl overflow-hidden flex flex-col z-50 shadow-2xl shadow-black/80">
      <div className="bg-gradient-to-r from-cyan-900 to-purple-900 p-4 flex items-center justify-between">
        <span className="text-white font-medium text-sm">Live League Chat</span>
        <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => {
          const grouped = groupReactions(msg.reactions || [], currentUserId)
          const isOwn = msg.user.id === currentUserId

          return (
            <div key={msg.id} className={`group text-sm ${isOwn ? 'text-right' : ''}`}>
              <div className="inline-flex items-end gap-1">
                <div className={`inline-block max-w-[80%] rounded-2xl px-4 py-2 ${
                  isOwn
                    ? 'bg-cyan-900/60 text-white'
                    : 'bg-gray-800/80 text-gray-100'
                }`}>
                  {!isOwn && (
                    <p className="text-cyan-400 text-xs font-medium mb-1">
                      {msg.user.displayName || msg.user.username}
                    </p>
                  )}
                  <p>{msg.message}</p>

                  {grouped.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {grouped.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
                            r.hasReacted
                              ? 'bg-cyan-600/30 border border-cyan-500/50'
                              : 'bg-gray-700/50 border border-gray-600/30 hover:bg-gray-600/50'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[10px] text-gray-300">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setPickerOpenFor(pickerOpenFor === msg.id ? null : msg.id)}
                    className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    <SmilePlus className="h-3 w-3" />
                  </button>
                  {!isOwn && !flaggedIds.has(msg.id) && (
                    <button
                      onClick={() => reportMessage(msg.id)}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Flag className="h-3 w-3" />
                    </button>
                  )}
                  {flaggedIds.has(msg.id) && (
                    <span className="text-[10px] text-red-400">Reported</span>
                  )}
                </div>
              </div>

              {pickerOpenFor === msg.id && (
                <div className={`flex gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className="bg-gray-900 border border-gray-700 rounded-xl px-2 py-1 flex gap-1 shadow-lg">
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform text-base px-0.5"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-600 mt-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 p-3 flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          maxLength={1000}
        />
        <Button onClick={sendMessage} size="icon" disabled={sending || !input.trim()} className="bg-cyan-600 hover:bg-cyan-500">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
