"use client"

import React, { useMemo } from "react"
import { useLeagueRankingsPremium } from "@/hooks/useLeagueRankingsPremium"
import { RankingsPremiumRow } from "./RankingsPremiumRow"
import { PartnerProfilesGrid } from "./PartnerProfilesGrid"
import { computeTier, computeWinWindow, whatChangedSummary } from "@/lib/rankings-engine/premium-panels"

export function RankingsPremiumSection(props: {
  leagueId: string
  week: number
  teams: any[]
  selectedRosterId?: string | number | null
  onOpenTradeHub: () => void
  onGenerateOffers: () => void
}) {
  const selectedTeam = useMemo(() => {
    if (!props.selectedRosterId) return props.teams?.[0] ?? null
    return props.teams.find((t) => String(t.rosterId) === String(props.selectedRosterId)) ?? props.teams?.[0] ?? null
  }, [props.teams, props.selectedRosterId])

  const premium = useLeagueRankingsPremium({
    leagueId: props.leagueId,
    week: props.week,
    selectedRosterId: selectedTeam?.rosterId ?? null,
    enableSnapshots: true
  })

  const tier = selectedTeam ? computeTier(selectedTeam) : "Mid Pack"
  const winWindow = selectedTeam ? computeWinWindow(selectedTeam) : "Flexible"
  const changed = selectedTeam ? whatChangedSummary(selectedTeam) : { rankDelta: 0, topDrivers: [] }

  const rankHistory = useMemo(() => {
    const rows = premium.rankHistory?.rows ?? []
    return rows.map((r) => Number(r.rank))
  }, [premium.rankHistory])

  if (premium.error) {
    return (
      <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
        <div className="font-bold text-white mb-1">Premium Modules</div>
        <div className="text-sm text-gray-400">Error: {premium.error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {premium.heatmap?.cells ? (
        <RankingsPremiumRow
          heatmapCells={premium.heatmap.cells}
          selectedTeam={selectedTeam}
          rankHistory={rankHistory}
          tier={tier}
          winWindow={winWindow}
          whatChanged={{ rankDelta: changed.rankDelta, topDrivers: changed.topDrivers }}
          onOpenTradeHub={props.onOpenTradeHub}
          onGenerateOffers={props.onGenerateOffers}
        />
      ) : (
        <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
          <div className="text-sm text-gray-400">{premium.loading ? "Loading premium modules…" : "No heatmap data."}</div>
        </div>
      )}

      {premium.profiles?.profiles?.length ? <PartnerProfilesGrid profiles={premium.profiles.profiles} /> : null}
    </div>
  )
}
