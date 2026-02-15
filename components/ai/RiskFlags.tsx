'use client'

import React from 'react'

interface RiskFlagsProps {
  risks: string[]
  compact?: boolean
}

export default function RiskFlags({ risks, compact = false }: RiskFlagsProps) {
  if (!risks || risks.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'mt-3'}`}>
      {risks.map((risk, i) => (
        <span
          key={i}
          className="text-xs px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 leading-tight"
        >
          {risk}
        </span>
      ))}
    </div>
  )
}
