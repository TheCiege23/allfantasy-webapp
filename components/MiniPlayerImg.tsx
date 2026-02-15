'use client'

import React, { useState } from 'react'

const SLEEPER_HEADSHOT_BASE = 'https://sleepercdn.com/content/nfl/players/thumb'

interface MiniPlayerImgProps {
  sleeperId?: string
  name?: string
  size?: number
  className?: string
}

export default function MiniPlayerImg({ sleeperId, name, size = 20, className = '' }: MiniPlayerImgProps) {
  const [error, setError] = useState(false)

  if (!sleeperId || error) {
    return (
      <div
        className={`rounded-full bg-white/10 flex items-center justify-center text-white/40 font-bold flex-shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
    )
  }

  return (
    <img
      src={`${SLEEPER_HEADSHOT_BASE}/${sleeperId}.jpg`}
      alt={name || ''}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-white/5 flex-shrink-0 ${className}`}
      onError={() => setError(true)}
      loading="lazy"
    />
  )
}
