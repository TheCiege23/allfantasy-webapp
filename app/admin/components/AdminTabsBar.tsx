"use client"

import React from "react"
import type { AdminTab } from "./AdminLayout"

export function AdminTabsBar(props: {
  tab: AdminTab
  setTab: (t: AdminTab) => void
  items: Array<{ key: AdminTab; label: string }>
}) {
  return (
    <div
      className="sticky top-0 z-30 -mx-3 px-3 py-2 backdrop-blur lg:hidden"
      style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {props.items.map((it) => {
          const active = props.tab === it.key
          return (
            <button
              key={it.key}
              onClick={() => props.setTab(it.key)}
              className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition active:scale-[0.98]"
              style={{
                borderColor: "var(--border)",
                background: active
                  ? "color-mix(in srgb, var(--accent) 22%, var(--panel))"
                  : "var(--panel)",
                color: active ? "var(--text)" : "var(--muted)"
              }}
            >
              {it.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
