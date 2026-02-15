'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'

interface AIBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  icon?: React.ReactNode
  children: React.ReactNode
  height?: 'auto' | 'half' | 'full'
  showHandle?: boolean
}

export default function AIBottomSheet({
  open,
  onClose,
  title,
  icon,
  children,
  height = 'auto',
  showHandle = true,
}: AIBottomSheetProps) {
  const [visible, setVisible] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const startYRef = useRef(0)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
      const timer = setTimeout(() => {
        document.body.style.overflow = ''
      }, 300)
      return () => clearTimeout(timer)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY
    setDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging) return
    const delta = e.touches[0].clientY - startYRef.current
    if (delta > 0) {
      setDragOffset(delta)
    }
  }, [dragging])

  const handleTouchEnd = useCallback(() => {
    setDragging(false)
    if (dragOffset > 100) {
      onClose()
    }
    setDragOffset(0)
  }, [dragOffset, onClose])

  if (!open && !visible) return null

  const heightClasses = {
    auto: 'max-h-[85vh]',
    half: 'h-[50vh]',
    full: 'h-[90vh]',
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <div
        ref={sheetRef}
        className={`absolute bottom-0 left-0 right-0 ${heightClasses[height]} bg-gradient-to-b from-slate-900 to-slate-950 rounded-t-3xl border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          transform: visible
            ? `translateY(${dragOffset}px)`
            : 'translateY(100%)',
        }}
        onTouchStart={showHandle ? handleTouchStart : undefined}
        onTouchMove={showHandle ? handleTouchMove : undefined}
        onTouchEnd={showHandle ? handleTouchEnd : undefined}
      >
        {showHandle && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        )}

        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              {icon && <span className="text-lg">{icon}</span>}
              <h3 className="text-base font-semibold text-white">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
