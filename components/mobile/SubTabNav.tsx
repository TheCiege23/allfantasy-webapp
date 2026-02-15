'use client'

import React from 'react'

interface SubTab {
  id: string
  label: string
  icon?: React.ReactNode
  badge?: string
}

interface SubTabNavProps {
  tabs: SubTab[]
  activeTab: string
  onChange: (id: string) => void
}

export default function SubTabNav({ tabs, activeTab, onChange }: SubTabNavProps) {
  return (
    <div className="w-full overflow-x-auto scrollbar-hide -mx-1 px-1">
      <div className="flex gap-1.5 p-1 bg-black/20 rounded-xl min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap touch-manipulation min-h-[36px] ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-400/25'
                  : 'text-white/45 hover:text-white/70 hover:bg-white/5 active:scale-[0.97]'
              }`}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`px-1 py-0.5 rounded text-[8px] font-semibold uppercase ${
                  tab.badge === 'AI'
                    ? 'bg-purple-500/20 text-purple-300/80'
                    : 'bg-white/10 text-white/50'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
