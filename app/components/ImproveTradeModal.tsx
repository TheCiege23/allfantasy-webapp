'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Copy, AlertCircle, Loader2, RefreshCw, Plus } from 'lucide-react'
import { toast } from 'sonner'

type Suggestion = {
  title: string
  counter: string
  impact: string
  reasons: string[]
}

type ImproveTradeModalProps = {
  isOpen: boolean
  onClose: () => void
  originalTradeText: string
  leagueSize: number
  scoring: 'ppr' | 'half' | 'standard' | 'superflex'
  isDynasty: boolean
  currentResult: any
}

export default function ImproveTradeModal({
  isOpen,
  onClose,
  originalTradeText,
  leagueSize,
  scoring,
  isDynasty,
  currentResult,
}: ImproveTradeModalProps) {
  const [loading, setLoading] = useState(false)
  const [additionalLoading, setAdditionalLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const generateSuggestions = useCallback(async (append = false) => {
    if (!originalTradeText || originalTradeText.trim().length < 5) {
      setError('Trade text is too short to improve.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (append) {
      setAdditionalLoading(true)
    } else {
      setLoading(true)
      setStreaming(true)
      setStreamText('')
      setSuggestions([])
    }
    setError('')

    try {
      const res = await fetch('/api/instant/improve-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeText: originalTradeText,
          leagueSize,
          scoring,
          isDynasty,
          currentVerdict: currentResult?.verdict || 'unknown',
          currentFairness: currentResult?.values?.percentDiff || 0,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let data: any
        try { data = await res.json() } catch {}
        throw new Error(data?.error || 'Failed to generate suggestions')
      }

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let receivedSuggestions = false
        let hadError = false
        let streamDone = false

        while (!streamDone) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') {
              streamDone = true
              break
            }

            try {
              const event = JSON.parse(payload)

              if (event.error) {
                setError(event.error)
                hadError = true
                streamDone = true
                break
              }

              if (!append && event.accumulated) {
                setStreamText(event.accumulated)
              }

              if (event.done && event.suggestions) {
                if (append) {
                  setSuggestions(prev => [...prev, ...event.suggestions])
                  toast.success('More suggestions added!')
                } else {
                  setSuggestions(event.suggestions)
                  toast.success('AI suggestions ready!')
                }
                receivedSuggestions = true
                streamDone = true
                break
              }
            } catch {
              setError('Failed to read AI response. Please try again.')
              hadError = true
              streamDone = true
              break
            }
          }
        }

        setStreaming(false)
        setLoading(false)
        setAdditionalLoading(false)
        if (!receivedSuggestions && !hadError) {
          setError('No suggestions received. Please try again.')
        }
      } else {
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        if (append) {
          setSuggestions(prev => [...prev, ...(data.suggestions || [])])
          if (data.suggestions?.length) toast.success('More suggestions added!')
        } else {
          setSuggestions(data.suggestions || [])
          if (data.suggestions?.length) toast.success('AI suggestions ready!')
        }
        setStreaming(false)
        setLoading(false)
        setAdditionalLoading(false)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || 'Could not generate improvements right now.')
      toast.error('Suggestion generation failed')
      setStreaming(false)
      setLoading(false)
      setAdditionalLoading(false)
    }
  }, [originalTradeText, leagueSize, scoring, isDynasty, currentResult])

  const fetchSuggestions = useCallback(() => generateSuggestions(false), [generateSuggestions])
  const generateMore = useCallback(() => generateSuggestions(true), [generateSuggestions])

  useEffect(() => {
    if (isOpen) {
      setSuggestions([])
      setStreamText('')
      setError('')
      fetchSuggestions()
    } else {
      abortRef.current?.abort()
    }
  }, [isOpen])

  const cancelRequest = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setAdditionalLoading(false)
    setStreaming(false)
    setError('Generation cancelled.')
    toast.info('Generation cancelled')
  }

  const copySuggestion = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Suggestion copied — paste into your league chat!')
  }

  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
            style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 sm:p-6 rounded-t-3xl" style={{ borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Improve This Trade</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full transition-colors"
                style={{ color: 'var(--muted)' }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--subtle-bg)', color: 'var(--muted)' }}>
                <span style={{ color: 'var(--muted2)' }}>Current trade:</span>{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {originalTradeText.length > 100 ? originalTradeText.slice(0, 100) + '...' : originalTradeText}
                </strong>
                {currentResult?.verdict && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--muted2)' }}>
                    — {currentResult.verdict}
                  </span>
                )}
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--accent-red)' }} />
                  <div className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</div>
                </div>
              )}

              {loading && streaming ? (
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                        Grok is crafting counter-offers...
                      </span>
                    </div>
                    <button
                      onClick={cancelRequest}
                      className="px-4 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.95]"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red, #ef4444)' }}
                    >
                      Cancel
                    </button>
                  </div>
                  {streamText && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 rounded-2xl font-mono text-xs overflow-hidden"
                      style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                    >
                      <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                        {streamText}
                        <span className="animate-pulse">▊</span>
                      </div>
                    </motion.div>
                  )}
                  {!streamText && [1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <div className="h-5 w-1/2 rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
                      <div className="h-4 w-full rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
                      <div className="h-4 w-4/5 rounded animate-pulse" style={{ background: 'var(--subtle-bg)' }} />
                    </div>
                  ))}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-5">
                  {suggestions.map((sug, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--text)' }}>{sug.title}</h3>
                        {sug.impact && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 shrink-0 whitespace-nowrap" style={{ color: 'var(--accent-emerald)' }}>
                            {sug.impact}
                          </span>
                        )}
                      </div>

                      {sug.counter && (
                        <div className="mb-4 p-3 rounded-xl text-sm font-mono whitespace-pre-line" style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                          {sug.counter}
                        </div>
                      )}

                      <ul className="space-y-1.5 mb-4 text-sm">
                        {sug.reasons.map((point, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                            <span style={{ color: 'var(--muted)' }}>{point}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => copySuggestion(sug.counter)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97]"
                        style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy counter-offer
                      </button>
                    </motion.div>
                  ))}

                  {additionalLoading && (
                    <div className="flex items-center justify-center gap-3 py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                        Generating more suggestions...
                      </span>
                      <button
                        onClick={cancelRequest}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.95]"
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--accent-red, #ef4444)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : !error && !loading ? (
                <div className="text-center py-12" style={{ color: 'var(--muted2)' }}>
                  No suggestions available yet — try again later or refine your trade text.
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 p-5 sm:p-6 flex flex-wrap justify-end gap-3 rounded-b-3xl" style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)' }}>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                Close
              </button>
              {!loading && !additionalLoading && suggestions.length > 0 && (
                <>
                  <button
                    onClick={generateMore}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] flex items-center gap-2"
                    style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: 'var(--text)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    More Ideas
                  </button>
                  <button
                    onClick={fetchSuggestions}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] flex items-center gap-2"
                    style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--text)' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </>
              )}
              {!loading && !additionalLoading && error && suggestions.length === 0 && (
                <button
                  onClick={fetchSuggestions}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all active:scale-[0.97]"
                >
                  Try Again
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
