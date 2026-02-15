"use client"

import React from "react"
import { PartnerProfileCard } from "./PartnerProfileCard"

export function PartnerProfilesGrid(props: { profiles: any[] }) {
  return (
    <div className="rounded-2xl bg-gray-950 border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white">Partner Strategy Profiles</h2>
        <span className="text-xs text-gray-500">league-aware tendencies</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {props.profiles.map((p) => (
          <PartnerProfileCard key={p.rosterId} profile={p} />
        ))}
      </div>
    </div>
  )
}
