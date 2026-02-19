'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TooltipProviderProps {
  children: React.ReactNode
  delayDuration?: number
}

const TooltipContext = React.createContext<{
  open: boolean
  setOpen: (v: boolean) => void
  delayDuration: number
}>({ open: false, setOpen: () => {}, delayDuration: 300 })

function TooltipProvider({ children, delayDuration = 300 }: TooltipProviderProps) {
  return <>{children}</>
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <TooltipContext.Provider value={{ open, setOpen, delayDuration: 300 }}>
      <div className="relative inline-flex">{children}</div>
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode
  asChild?: boolean
}) {
  const { setOpen, delayDuration } = React.useContext(TooltipContext)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setOpen(true), delayDuration)
  }

  const handleLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onMouseEnter: handleEnter,
      onMouseLeave: handleLeave,
      onFocus: () => setOpen(true),
      onBlur: () => setOpen(false),
    })
  }

  return (
    <span
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
    </span>
  )
}

interface TooltipContentProps {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

function TooltipContent({ children, side = 'top', className }: TooltipContentProps) {
  const { open } = React.useContext(TooltipContext)

  if (!open) return null

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      role="tooltip"
      className={cn(
        'absolute z-50 px-3 py-2 rounded-lg bg-[#1a1238] border border-white/10 text-white text-sm shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95',
        positionClasses[side],
        className
      )}
    >
      {children}
    </div>
  )
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
