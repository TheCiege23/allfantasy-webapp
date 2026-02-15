import React from "react"
import { V3WeightsPanel } from "@/components/admin/V3WeightsPanel"
import { UsageAnalyticsPanel } from "@/components/admin/UsageAnalyticsPanel"

export default function ModelAdminPage(props: { params: { leagueId: string } }) {
  const leagueId = props.params.leagueId

  const season = new Date().getFullYear().toString()
  const defaultWeek = 1

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl bg-zinc-950 p-4">
        <div className="text-xl font-bold">Model Admin</div>
        <div className="text-sm opacity-70">League {leagueId}</div>
      </div>

      <V3WeightsPanel leagueId={leagueId} season={season} defaultWeek={defaultWeek} />

      <UsageAnalyticsPanel leagueId={leagueId} />
    </div>
  )
}
