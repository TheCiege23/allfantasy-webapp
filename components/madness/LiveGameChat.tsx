'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Send, MessageCircle, X, Flag, Smile } from 'lucide-react'
import { toast } from 'sonner'

const EMOJIS = [
  '👍', '❤️', '😂', '🔥', '😭', '🤯', '🙌', '💯',
  '👀', '🤔', '😤', '🎉', '💪', '🤩', '😱', '🤬',
  '🥳', '😎', '🤝', '👑',
]

type Reaction = { emoji: string; userId: string }

type ChatMessage = {
  id: string
  message: string
  createdAt: string
  isPinned?: boolean
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
  const [lastSent, setLastSent] = useState(0)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const typingTimeout = useRef<NodeJS.Timeout>()
  const lastTypingPing = useRef(0)
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

  const fetchTyping = useCallback(async () => {
    if (!open) return
    try {
      const res = await fetch(`/api/madness/typing?leagueId=${leagueId}`)
      if (!res.ok) return
      const data = await res.json()
      setTypingUsers(data.typing || [])
    } catch {}
  }, [leagueId, open])

  useEffect(() => {
    fetchMessages()
    const msgInterval = setInterval(fetchMessages, 5000)
    const typingInterval = setInterval(fetchTyping, 2000)
    return () => {
      clearInterval(msgInterval)
      clearInterval(typingInterval)
    }
  }, [fetchMessages, fetchTyping])

  useEffect(() => {
    if (open) {
      setUnread(0)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [open, messages.length])

  const sendTypingPing = useCallback(async () => {
    const now = Date.now()
    if (now - lastTypingPing.current < 2000) return
    lastTypingPing.current = now
    try {
      await fetch('/api/madness/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      })
    } catch {}
  }, [leagueId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    sendTypingPing()
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return

    if (Date.now() - lastSent < 5000) {
      toast.error('Slow down — 5 sec between messages')
      return
    }

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
        setLastSent(Date.now())
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to send')
      }
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
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
        toast.success('Message reported — thank you!')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Could not report message')
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
    <div className="fixed bottom-0 right-0 w-96 h-[30rem] bg-black/95 border border-cyan-900/50 rounded-tl-3xl overflow-hidden flex flex-col z-50 shadow-2xl shadow-black/80">
      <div className="bg-gradient-to-r from-cyan-900 to-purple-900 p-4 flex items-center justify-between">
        <span className="text-white font-medium text-sm">Live League Chat</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/50">Moderated</span>
          <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">No messages yet. Say something!</p>
        )}
        {messages.map(msg => {
          const grouped = groupReactions(msg.reactions || [], currentUserId)
          const isOwn = msg.user.id === currentUserId
          const displayName = msg.user.displayName || msg.user.username
          const initial = (displayName?.[0] || '?').toUpperCase()

          return (
            <div key={msg.id} className="group">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  isOwn ? 'bg-cyan-700 text-white' : 'bg-gray-700 text-gray-300'
                }`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-medium text-sm ${isOwn ? 'text-cyan-400' : 'text-cyan-300'}`}>
                      {displayName}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mt-0.5 break-words">{msg.message}</p>

                  {grouped.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {grouped.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                            r.hasReacted
                              ? 'bg-cyan-900/60 border border-cyan-500/50'
                              : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-gray-300">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 flex-shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-cyan-400">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 bg-gray-950 border border-gray-800" side="left" align="start">
                      <div className="grid grid-cols-5 gap-2">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="text-xl hover:scale-125 transition-transform p-1 rounded hover:bg-gray-800"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {!isOwn && !flaggedIds.has(msg.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => reportMessage(msg.id)}
                      className="h-7 w-7 text-gray-400 hover:text-red-400"
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {flaggedIds.has(msg.id) && (
                    <span className="text-[10px] text-red-400 self-center">Reported</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 text-[11px] text-gray-400 border-t border-gray-800/50">
          <span className="inline-flex items-center gap-1">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`}
          </span>
        </div>
      )}

      <div className="border-t border-gray-800 p-3 flex gap-2">
        <Input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
          maxLength={1000}
        />
        <Button
          onClick={sendMessage}
          size="icon"
          disabled={sending || !input.trim()}
          className="bg-cyan-600 hover:bg-cyan-500"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
