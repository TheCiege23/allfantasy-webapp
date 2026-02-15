"use client"

import React from "react"

export function AdminCard(props: {
  title?: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${props.className ?? ""}`}
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      {(props.title || props.subtitle || props.right) ? (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {props.title ? <div className="text-base sm:text-lg font-bold">{props.title}</div> : null}
            {props.subtitle ? <div className="text-xs sm:text-sm" style={{ color: "var(--muted)" }}>{props.subtitle}</div> : null}
          </div>
          {props.right ? <div className="shrink-0">{props.right}</div> : null}
        </div>
      ) : null}
      {props.children}
    </div>
  )
}
