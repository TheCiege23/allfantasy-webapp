'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Send, MessageCircle, X, Flag, Smile, Pin, Search, Check, CheckCheck, VolumeX, Volume2 } from 'lucide-react'
import { toast } from 'sonner'

const EMOJI_MAP: Record<string, string> = {
  '👍': 'thumbs up like',
  '❤️': 'heart love',
  '😂': 'laugh cry funny',
  '🔥': 'fire hot lit',
  '😭': 'crying sad',
  '🤯': 'mind blown shocked',
  '🙌': 'hands celebrate',
  '💯': 'hundred perfect',
  '👀': 'eyes looking',
  '🤔': 'thinking hmm',
  '😤': 'angry mad steam',
  '🎉': 'party celebrate tada',
  '💪': 'muscle strong flex',
  '🤩': 'star eyes wow',
  '😱': 'scream shocked',
  '🤬': 'cursing angry swear',
  '🥳': 'party celebrate birthday',
  '😎': 'cool sunglasses',
  '🤝': 'handshake deal',
  '👑': 'crown king queen',
  '🏀': 'basketball ball',
  '🏆': 'trophy winner champion',
  '💀': 'skull dead',
  '🤡': 'clown joke',
  '🧠': 'brain smart galaxy',
  '📈': 'chart up stonks',
  '📉': 'chart down crash',
  '🗑️': 'trash garbage',
  '💰': 'money bag rich',
  '🎯': 'target bullseye',
  '⭐': 'star favorite',
  '🚀': 'rocket moon launch',
  '🐐': 'goat greatest',
  '💎': 'diamond gem',
  '🤷': 'shrug whatever idk',
  '😏': 'smirk sly',
  '🥶': 'cold freezing ice',
  '🫡': 'salute respect',
  '🧊': 'ice cube cold',
  '💩': 'poop crap',
}

const ALL_EMOJIS = Object.keys(EMOJI_MAP)

type Reaction = { emoji: string; userId: string }

type ChatMessage = {
  id: string
  message: string
  createdAt: string
  isPinned?: boolean
  reactions?: Reaction[]
  seenBy?: string[]
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

export default function LiveGameChat({ leagueId, currentUserId, isLeagueOwner = false }: { leagueId: string; currentUserId: string; isLeagueOwner?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set())
  const [lastSent, setLastSent] = useState(0)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(`chat-muted-${leagueId}`)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [emojiSearch, setEmojiSearch] = useState('')
  const filteredEmojis = useMemo(() => {
    const q = emojiSearch.toLowerCase().trim()
    if (!q) return ALL_EMOJIS
    return ALL_EMOJIS.filter(e => e.includes(q) || EMOJI_MAP[e].includes(q))
  }, [emojiSearch])
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

  useEffect(() => {
    if (!open || messages.length === 0) return
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg) return
    fetch('/api/madness/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, messageId: lastMsg.id }),
    }).catch(() => {})
  }, [open, messages.length, leagueId])

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

  const pinMessage = async (messageId: string) => {
    try {
      const res = await fetch('/api/madness/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (res.ok) {
        const { isPinned } = await res.json()
        setMessages(prev =>
          prev.map(msg => ({
            ...msg,
            isPinned: msg.id === messageId ? isPinned : (isPinned ? false : msg.isPinned),
          })),
        )
        toast.success(isPinned ? 'Message pinned' : 'Message unpinned')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Could not pin message')
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

  const muteUser = (userId: string, username: string) => {
    setMutedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
        toast.success(`Unmuted ${username}`)
      } else {
        next.add(userId)
        toast.success(`Muted ${username} — their messages are now hidden`)
      }
      try { localStorage.setItem(`chat-muted-${leagueId}`, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const visibleMessages = useMemo(
    () => messages.filter(m => !mutedUsers.has(m.user.id)),
    [messages, mutedUsers]
  )

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

      {(() => {
        const pinned = messages.find(m => m.isPinned)
        if (!pinned) return null
        return (
          <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-800/30 flex items-center gap-2">
            <Pin className="h-3 w-3 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-200 truncate flex-1">
              <span className="font-medium text-amber-400">{pinned.user.displayName || pinned.user.username}:</span>{' '}
              {pinned.message}
            </p>
          </div>
        )
      })()}

      {mutedUsers.size > 0 && (
        <div className="px-4 py-1.5 bg-orange-950/30 border-b border-orange-800/20 flex items-center justify-between">
          <span className="text-[10px] text-orange-300">{mutedUsers.size} user{mutedUsers.size > 1 ? 's' : ''} muted</span>
          <button
            onClick={() => {
              setMutedUsers(new Set())
              try { localStorage.removeItem(`chat-muted-${leagueId}`) } catch {}
              toast.success('All users unmuted')
            }}
            className="text-[10px] text-orange-400 hover:text-orange-300 underline"
          >
            Unmute all
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {visibleMessages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-8">No messages yet. Say something!</p>
        )}
        {visibleMessages.map(msg => {
          const grouped = groupReactions(msg.reactions || [], currentUserId)
          const isOwn = msg.user.id === currentUserId
          const displayName = msg.user.displayName || msg.user.username
          const initial = (displayName?.[0] || '?').toUpperCase()

          return (
            <div key={msg.id} className={`group ${msg.isPinned ? 'bg-amber-950/20 -mx-4 px-4 py-1 rounded-lg border-l-2 border-amber-500/50' : ''}`}>
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

                  {isOwn && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {(msg.seenBy?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-cyan-400" title={`Seen by ${msg.seenBy!.join(', ')}`}>
                          <CheckCheck className="h-3 w-3" />
                          <span>
                            {msg.seenBy!.length <= 2
                              ? msg.seenBy!.join(', ')
                              : `${msg.seenBy![0]} +${msg.seenBy!.length - 1}`}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] text-gray-500" title="Sent">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  )}

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
                  <Popover onOpenChange={(o) => { if (!o) setEmojiSearch('') }}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-cyan-400">
                        <Smile className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3 bg-gray-950 border border-gray-800 shadow-2xl" side="left" align="start">
                      <div className="relative mb-3">
                        <Input
                          placeholder="Search emojis..."
                          value={emojiSearch}
                          onChange={e => setEmojiSearch(e.target.value)}
                          className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 h-8 text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredEmojis.length === 0 ? (
                          <div className="text-center text-gray-500 text-sm py-6">No emojis found</div>
                        ) : (
                          <div className="grid grid-cols-8 gap-1">
                            {filteredEmojis.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  toggleReaction(msg.id, emoji)
                                  setEmojiSearch('')
                                }}
                                className="text-xl hover:scale-125 transition-transform duration-150 p-1 rounded hover:bg-gray-800"
                                title={EMOJI_MAP[emoji]}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {isLeagueOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => pinMessage(msg.id)}
                      className={`h-7 w-7 transition-colors ${msg.isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-gray-400 hover:text-amber-400'}`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!isOwn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => muteUser(msg.user.id, displayName)}
                      className={`h-7 w-7 transition-colors ${mutedUsers.has(msg.user.id) ? 'text-orange-400 hover:text-orange-300' : 'text-gray-400 hover:text-orange-400'}`}
                      title={mutedUsers.has(msg.user.id) ? `Unmute ${displayName}` : `Mute ${displayName}`}
                    >
                      {mutedUsers.has(msg.user.id) ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    </Button>
                  )}
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
