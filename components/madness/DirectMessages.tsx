'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, ArrowLeft, Check, CheckCheck, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

type ChatTheme = 'dark' | 'neon' | 'classic'

const DM_THEMES: Record<ChatTheme, {
  container: string
  header: string
  headerText: string
  msgBg: string
  msgOwn: string
  msgText: string
  nameOwn: string
  nameOther: string
  timestamp: string
  avatarOwn: string
  avatarOther: string
  inputBg: string
  inputBorder: string
  inputText: string
  sendBtn: string
  border: string
  emptyText: string
  seenText: string
  convHover: string
  convActive: string
  badge: string
}> = {
  dark: {
    container: 'bg-black/95 border-cyan-900/50',
    header: 'bg-gradient-to-r from-cyan-900 to-purple-900',
    headerText: 'text-white',
    msgBg: 'bg-gray-900/60',
    msgOwn: 'bg-cyan-900/30 border-l-2 border-cyan-500',
    msgText: 'text-gray-200',
    nameOwn: 'text-cyan-400',
    nameOther: 'text-cyan-300',
    timestamp: 'text-gray-500',
    avatarOwn: 'bg-cyan-700 text-white',
    avatarOther: 'bg-gray-700 text-gray-300',
    inputBg: 'bg-gray-900',
    inputBorder: 'border-gray-700',
    inputText: 'text-white placeholder:text-gray-500',
    sendBtn: 'bg-cyan-600 hover:bg-cyan-500',
    border: 'border-gray-800',
    emptyText: 'text-gray-500',
    seenText: 'text-cyan-400',
    convHover: 'hover:bg-gray-800/60',
    convActive: 'bg-gray-800/80',
    badge: 'bg-cyan-500 text-white',
  },
  neon: {
    container: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 border-purple-500/50',
    header: 'bg-gradient-to-r from-purple-800 to-pink-800',
    headerText: 'text-purple-200',
    msgBg: 'bg-purple-900/30',
    msgOwn: 'bg-pink-900/30 border-l-2 border-pink-500',
    msgText: 'text-purple-100',
    nameOwn: 'text-pink-400',
    nameOther: 'text-purple-300',
    timestamp: 'text-purple-500',
    avatarOwn: 'bg-pink-700 text-white',
    avatarOther: 'bg-purple-900 text-purple-300',
    inputBg: 'bg-indigo-950/60',
    inputBorder: 'border-purple-700/50',
    inputText: 'text-purple-100 placeholder:text-purple-500',
    sendBtn: 'bg-purple-600 hover:bg-purple-500',
    border: 'border-purple-800/40',
    emptyText: 'text-purple-600',
    seenText: 'text-pink-400',
    convHover: 'hover:bg-purple-900/40',
    convActive: 'bg-purple-900/60',
    badge: 'bg-pink-500 text-white',
  },
  classic: {
    container: 'bg-gray-900 border-gray-600/50',
    header: 'bg-gradient-to-r from-gray-700 to-gray-600',
    headerText: 'text-gray-100',
    msgBg: 'bg-gray-800/60',
    msgOwn: 'bg-blue-900/30 border-l-2 border-blue-500',
    msgText: 'text-gray-200',
    nameOwn: 'text-blue-400',
    nameOther: 'text-gray-300',
    timestamp: 'text-gray-500',
    avatarOwn: 'bg-blue-700 text-white',
    avatarOther: 'bg-gray-600 text-gray-200',
    inputBg: 'bg-gray-800',
    inputBorder: 'border-gray-600',
    inputText: 'text-gray-100 placeholder:text-gray-500',
    sendBtn: 'bg-blue-600 hover:bg-blue-500',
    border: 'border-gray-700',
    emptyText: 'text-gray-500',
    seenText: 'text-blue-400',
    convHover: 'hover:bg-gray-800/60',
    convActive: 'bg-gray-800/80',
    badge: 'bg-blue-500 text-white',
  },
}

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

type DMMessage = {
  id: string
  senderId: string
  receiverId: string
  message: string
  isRead: boolean
  createdAt: string
  sender: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

interface DirectMessagesProps {
  userId: string
  theme?: ChatTheme
  initialPartnerId?: string
  initialPartnerName?: string
  onClose?: () => void
}

export default function DirectMessages({
  userId,
  theme = 'dark',
  initialPartnerId,
  initialPartnerName,
  onClose,
}: DirectMessagesProps) {
  const t = DM_THEMES[theme]
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activePartner, setActivePartner] = useState<{
    id: string
    name: string
    avatarUrl?: string | null
  } | null>(
    initialPartnerId && initialPartnerId.length > 0
      ? { id: initialPartnerId, name: initialPartnerName || 'User' }
      : null
  )
  const [messages, setMessages] = useState<DMMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  const markRead = useCallback(async (partnerId: string) => {
    try {
      await fetch('/api/dm/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId }),
      })
    } catch {}
  }, [])

  const fetchMessages = useCallback(async (partnerId: string) => {
    try {
      const res = await fetch(`/api/dm?partnerId=${partnerId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!activePartner) {
      fetchConversations()
      pollRef.current = setInterval(fetchConversations, 8000)
    } else {
      setLoading(true)
      Promise.all([fetchMessages(activePartner.id), markRead(activePartner.id)]).finally(() => setLoading(false))
      pollRef.current = setInterval(() => {
        fetchMessages(activePartner.id)
        markRead(activePartner.id)
      }, 4000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activePartner, fetchConversations, fetchMessages, markRead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMsg.trim() || !activePartner || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activePartner.id, message: newMsg.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setNewMsg('')
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to send')
      }
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const openConversation = (conv: Conversation) => {
    setActivePartner({
      id: conv.partnerId,
      name: conv.partnerDisplayName || conv.partnerUsername,
      avatarUrl: conv.partnerAvatarUrl,
    })
    setMessages([])
  }

  const goBack = () => {
    setActivePartner(null)
    setMessages([])
    fetchConversations()
  }

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

  if (activePartner) {
    return (
      <div className={`flex flex-col h-full rounded-xl border ${t.container}`}>
        <div className={`flex items-center gap-3 px-4 py-3 rounded-t-xl ${t.header}`}>
          <button onClick={onClose ? onClose : goBack} className="p-1 rounded hover:bg-white/10">
            <ArrowLeft className={`w-5 h-5 ${t.headerText}`} />
          </button>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${t.avatarOther}`}>
            {activePartner.avatarUrl ? (
              <img src={activePartner.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              getInitial(activePartner.name)
            )}
          </div>
          <span className={`font-semibold ${t.headerText}`}>{activePartner.name}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {loading ? (
            <div className={`flex items-center justify-center h-full ${t.emptyText}`}>
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-full gap-2 ${t.emptyText}`}>
              <MessageSquare className="w-10 h-10 opacity-40" />
              <p className="text-sm">Start a conversation with {activePartner.name}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId === userId
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 p-2 rounded-lg ${isOwn ? t.msgOwn : t.msgBg}`}
                >
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isOwn ? t.avatarOwn : t.avatarOther}`}>
                    {msg.sender.avatarUrl ? (
                      <img src={msg.sender.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      getInitial(msg.sender.displayName || msg.sender.username)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isOwn ? t.nameOwn : t.nameOther}`}>
                        {isOwn ? 'You' : msg.sender.displayName || msg.sender.username}
                      </span>
                      <span className={`text-[10px] ${t.timestamp}`}>{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className={`text-sm mt-0.5 break-words ${t.msgText}`}>{msg.message}</p>
                    {isOwn && (
                      <div className={`flex items-center gap-0.5 mt-0.5 ${msg.isRead ? t.seenText : t.timestamp}`}>
                        {msg.isRead ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span className="text-[9px]">{msg.isRead ? 'Seen' : 'Sent'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className={`p-3 border-t ${t.border}`}>
          <div className="flex gap-2">
            <Input
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              maxLength={1000}
              className={`flex-1 text-sm ${t.inputBg} ${t.inputBorder} ${t.inputText}`}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMsg.trim() || sending}
              size="icon"
              className={`${t.sendBtn} text-white`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full rounded-xl border ${t.container}`}>
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${t.header}`}>
        <span className={`font-semibold ${t.headerText}`}>Direct Messages</span>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <ArrowLeft className={`w-5 h-5 ${t.headerText}`} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {conversations.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-full gap-2 p-6 ${t.emptyText}`}>
            <MessageSquare className="w-12 h-12 opacity-40" />
            <p className="text-sm text-center">No conversations yet. Tap a member in chat to send a direct message.</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.partnerId}
              onClick={() => openConversation(conv)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b ${t.border} ${t.convHover} transition-colors`}
            >
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${t.avatarOther}`}>
                {conv.partnerAvatarUrl ? (
                  <img src={conv.partnerAvatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  getInitial(conv.partnerDisplayName || conv.partnerUsername)
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold truncate ${t.nameOther}`}>
                    {conv.partnerDisplayName || conv.partnerUsername}
                  </span>
                  <span className={`text-[10px] flex-shrink-0 ${t.timestamp}`}>
                    {formatTime(conv.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={`text-xs truncate ${t.msgText} opacity-70`}>
                    {conv.senderId === userId ? 'You: ' : ''}
                    {conv.message}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className={`ml-2 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${t.badge}`}>
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
