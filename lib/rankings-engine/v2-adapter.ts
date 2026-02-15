import { computeLeagueRankingsV2 } from "./league-rankings-v2"

export type V2RankingsResult = {
  leagueId: string
  leagueName: string
  season: string
  week: number
  phase: "offseason" | "in_season" | "post_draft" | "post_season"
  isDynasty: boolean
  isSuperFlex: boolean
  teams: any[]
  weeklyPointsDistribution: { rosterId: number; weeklyPoints: number[] }[]
  computedAt: number
  marketInsights: any[]
  ldiChips: any[]
  weeklyAwards: any | null
  tradeHubShortcuts: any[]
  partnerTendencies: any[]
  meta: {
    ldiByPos: Record<string, number>
    partnerPosCounts: Record<string, Record<string, number>>
    ldiSampleTotal: number
    ldiTrend: Record<string, number>
    proposalTargets: Array<{
      position: string
      rosterId: string
      name: string
      score: number
      ldiByPos: number
      meanPremiumPct: number
      nByPos: number
      label: "Overpayer" | "Learning"
    }>
  }
}

export async function getV2Rankings(params: { leagueId: string; week: number }) {
  return (await computeLeagueRankingsV2(params.leagueId, params.week)) as V2RankingsResult
}

export function getPosTotalsFromPartnerCounts(meta: V2RankingsResult["meta"]) {
  const partnerPosCounts = meta?.partnerPosCounts ?? {}
  const totals: Record<string, number> = {}

  for (const partnerId of Object.keys(partnerPosCounts)) {
    const posMap = partnerPosCounts[partnerId] ?? {}
    for (const pos of Object.keys(posMap)) {
      totals[pos] = (totals[pos] ?? 0) + Number(posMap[pos] ?? 0)
    }
  }

  return totals
}
