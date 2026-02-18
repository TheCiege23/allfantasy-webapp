'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Copy, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Suggestion = {
  description: string
  whyBetter: string[]
  newVerdict?: string
  deltaEstimate?: string
  copyText: string
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [error, setError] = useState('')

  const fetchSuggestions = async () => {
    if (!originalTradeText || originalTradeText.trim().length < 5) {
      setError('Trade text is too short to improve.')
      return
    }

    setLoading(true)
    setError('')
    setSuggestions([])

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
      })

      let data: any
      try {
        data = await res.json()
      } catch {
        throw new Error('Unexpected server response. Please try again.')
      }

      if (!res.ok) throw new Error(data.error || 'Failed to generate suggestions')

      setSuggestions(data.suggestions || [])
      if (data.suggestions?.length) toast.success('AI suggestions ready!')
    } catch (err: any) {
      setError(err.message || 'Could not generate improvements right now.')
      toast.error('Suggestion generation failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setSuggestions([])
      setError('')
      fetchSuggestions()
    }
  }, [isOpen])

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
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Your current trade: <strong style={{ color: 'var(--text)' }}>{originalTradeText.length > 80 ? originalTradeText.slice(0, 80) + '...' : originalTradeText}</strong>
              </p>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: 'var(--accent-red)' }} />
                  <div className="text-sm" style={{ color: 'var(--accent-red)' }}>{error}</div>
                </div>
              )}

              {loading ? (
                <div className="space-y-6 py-4">
                  <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                      AI is crafting better trades...
                    </span>
                  </div>
                  {[1, 2, 3].map((i) => (
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
                      transition={{ delay: i * 0.1 }}
                      className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-purple-500/5"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <h3 className="font-bold text-base sm:text-lg" style={{ color: 'var(--text)' }}>{sug.description}</h3>
                        {sug.deltaEstimate && (
                          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 shrink-0" style={{ color: 'var(--accent-emerald)' }}>
                            {sug.deltaEstimate}
                          </span>
                        )}
                      </div>

                      {sug.newVerdict && (
                        <div className="mb-3 text-sm font-medium" style={{ color: 'var(--accent-emerald)' }}>
                          New projected verdict: <strong>{sug.newVerdict}</strong>
                        </div>
                      )}

                      <ul className="space-y-2 mb-4 text-sm">
                        {sug.whyBetter.map((point, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                            <span style={{ color: 'var(--muted)' }}>{point}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => copySuggestion(sug.copyText)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all active:scale-[0.97]"
                        style={{ background: 'var(--subtle-bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy this counter-offer
                      </button>
                    </motion.div>
                  ))}
                </div>
              ) : !error ? (
                <div className="text-center py-12" style={{ color: 'var(--muted2)' }}>
                  No suggestions available yet — try again later or refine your trade text.
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 p-5 sm:p-6 flex justify-end gap-3 rounded-b-3xl" style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)' }}>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                Close
              </button>
              {!loading && (error || suggestions.length > 0) && (
                <button
                  onClick={fetchSuggestions}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all active:scale-[0.97]"
                >
                  {error ? 'Try Again' : 'Regenerate'}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
