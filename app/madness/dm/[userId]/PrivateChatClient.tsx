'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useReactMediaRecorder } from 'react-media-recorder'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, ArrowLeft, Check, CheckCheck, MessageSquare, Mic, MicOff, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type UserInfo = {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

type DMMessage = {
  id: string
  senderId: string
  receiverId: string
  message: string
  voiceUrl?: string | null
  isRead: boolean
  createdAt: string
  sender: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

interface PrivateChatClientProps {
  currentUser: UserInfo
  partner: UserInfo
}

export default function PrivateChatClient({ currentUser, partner }: PrivateChatClientProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<DMMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sendingVoice, setSendingVoice] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const [recording, setRecording] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const {
    startRecording,
    stopRecording,
    mediaBlobUrl,
  } = useReactMediaRecorder({ audio: true, blobPropertyBag: { type: 'audio/webm' } })

  const partnerName = partner.displayName || partner.username
  const partnerInitial = (partnerName?.[0] || '?').toUpperCase()

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm?partnerId=${partner.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {}
  }, [partner.id])

  const markRead = useCallback(async () => {
    try {
      await fetch('/api/dm/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: partner.id }),
      })
    } catch {}
  }, [partner.id])

  useEffect(() => {
    Promise.all([fetchMessages(), markRead()]).finally(() => setLoading(false))
    pollRef.current = setInterval(() => {
      fetchMessages()
      markRead()
    }, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchMessages, markRead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (mediaBlobUrl) {
      setPreviewUrl(mediaBlobUrl)
    }
  }, [mediaBlobUrl])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setSending(true)
    setInput('')
    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: partner.id, message: text }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to send')
        setInput(text)
      }
    } catch {
      toast.error('Failed to send message')
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const toggleRecord = () => {
    if (recording) {
      stopRecording()
      setRecording(false)
    } else {
      startRecording()
      setRecording(true)
    }
  }

  const sendVoice = async () => {
    if (!mediaBlobUrl) return
    setSendingVoice(true)
    try {
      const blob = await fetch(mediaBlobUrl).then((r) => r.blob())
      if (blob.size > 2 * 1024 * 1024) {
        toast.error('Voice message too long (max 2MB)')
        return
      }
      const formData = new FormData()
      formData.append('voice', blob, 'voice.webm')
      formData.append('receiverId', partner.id)

      const res = await fetch('/api/dm/voice', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => [...prev, data.message])
        setPreviewUrl(null)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to send voice')
      }
    } catch {
      toast.error('Failed to send voice message')
    } finally {
      setSendingVoice(false)
    }
  }

  const discardVoice = () => {
    setPreviewUrl(null)
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) return time
    if (isYesterday) return `Yesterday ${time}`
    if (diff < 604800000) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
  }

  const getInitial = (name: string) => (name?.[0] || '?').toUpperCase()

  const shouldShowDateSeparator = (idx: number) => {
    if (idx === 0) return true
    const prev = new Date(messages[idx - 1].createdAt).toDateString()
    const curr = new Date(messages[idx].createdAt).toDateString()
    return prev !== curr
  }

  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return 'Today'
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
  }

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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
            {partner.avatarUrl ? (
              <img src={partner.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              partnerInitial
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">{partnerName}</h3>
            <p className="text-xs text-gray-500">@{partner.username}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading messages...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
              <div className="w-16 h-16 rounded-full bg-gray-800/60 flex items-center justify-center">
                <MessageSquare className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs text-gray-600">Send the first message to {partnerName}</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.senderId === currentUser.id
              const senderName = isOwn
                ? currentUser.displayName || currentUser.username
                : partner.displayName || partner.username
              const showDate = shouldShowDateSeparator(idx)

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex items-center justify-center py-4">
                      <div className="bg-gray-800/60 text-gray-400 text-[11px] px-3 py-1 rounded-full">
                        {getDateLabel(msg.createdAt)}
                      </div>
                    </div>
                  )}
                  <div className={`flex gap-2.5 py-1.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${
                      isOwn
                        ? 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white'
                        : 'bg-gradient-to-br from-purple-700 to-pink-700 text-white'
                    }`}>
                      {isOwn ? (
                        currentUser.avatarUrl ? (
                          <img src={currentUser.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : getInitial(senderName)
                      ) : (
                        partner.avatarUrl ? (
                          <img src={partner.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : getInitial(senderName)
                      )}
                    </div>
                    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-3.5 py-2 ${
                        isOwn
                          ? 'bg-cyan-900/40 border border-cyan-800/40 rounded-tr-sm'
                          : 'bg-gray-800/60 border border-gray-700/40 rounded-tl-sm'
                      }`}>
                        <p className="text-sm text-gray-100 break-words leading-relaxed">{msg.message}</p>
                        {msg.voiceUrl && (
                          <div className="mt-2">
                            <audio controls src={msg.voiceUrl} className="w-full max-w-xs" />
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : ''}`}>
                        <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
                        {isOwn && (
                          <span className={msg.isRead ? 'text-cyan-400' : 'text-gray-600'}>
                            {msg.isRead ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-gray-800 bg-black/60 backdrop-blur-sm p-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto">
          {previewUrl ? (
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-700 rounded-full px-4 py-2">
              <Mic className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <audio controls src={previewUrl} className="h-8 w-48" />
              {sendingVoice ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
              ) : (
                <>
                  <Button size="sm" onClick={sendVoice} className="bg-green-600 hover:bg-green-700 text-white">
                    Send
                  </Button>
                  <Button variant="ghost" size="icon" onClick={discardVoice} className="text-gray-400 hover:text-white h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <Button
                onClick={toggleRecord}
                size="icon"
                variant="ghost"
                className={recording ? 'text-red-500 animate-pulse hover:text-red-400 hover:bg-red-900/20' : 'text-gray-400 hover:text-cyan-400 hover:bg-gray-800'}
                title={recording ? 'Stop recording' : 'Record voice message'}
              >
                {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-4 w-4" />}
              </Button>
              {recording ? (
                <div className="flex-1 flex items-center gap-3 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-medium">Recording...</span>
                </div>
              ) : (
                <>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={`Message ${partnerName}...`}
                    maxLength={1000}
                    className="flex-1 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 focus:border-cyan-700"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || sending}
                    size="icon"
                    className="bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
