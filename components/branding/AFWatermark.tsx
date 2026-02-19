'use client'

export function AFShieldWatermark({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <img
        src="/af-shield-bg.png"
        alt=""
        className="w-24 h-24 opacity-10"
        draggable={false}
      />
    </div>
  )
}

export function AFLogoWatermark({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <img
        src="/allfantasy-hero.png"
        alt=""
        className="h-6 opacity-20"
        draggable={false}
      />
    </div>
  )
}

export function AFBrandingFooter() {
  return (
    <div className="flex items-center justify-center gap-3 py-6 opacity-15 pointer-events-none select-none">
      <img src="/af-shield-bg.png" alt="" className="w-8 h-8" draggable={false} />
      <img src="/allfantasy-hero.png" alt="" className="h-4" draggable={false} />
    </div>
  )
}

export function AFCornerBadge({ position = 'top-right' }: { position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }) {
  const posClass = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }[position]

  return (
    <div className={`absolute ${posClass} pointer-events-none select-none z-0`}>
      <img
        src="/af-shield-bg.png"
        alt=""
        className="w-10 h-10 opacity-[0.08]"
        draggable={false}
      />
    </div>
  )
}
