"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useHallOfFame } from "@/hooks/useHallOfFame"
import { HallOfFameCard } from "@/components/HallOfFameCard"
import { SeasonLeaderboardCard } from "@/components/rankings/SeasonLeaderboardCard"

export function HallOfFameSection(props: {
  leagueId: string
  seasons: string[]
  defaultSeason?: string
}) {
  const normalizedSeasons = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const s of props.seasons ?? []) {
      const v = String(s)
      if (!seen.has(v)) {
        seen.add(v)
        out.push(v)
      }
    }
    return out
  }, [props.seasons])

  const initialSeason =
    props.defaultSeason && normalizedSeasons.includes(props.defaultSeason)
      ? props.defaultSeason
      : normalizedSeasons?.[0] ?? ""

  const [season, setSeason] = useState<string>(initialSeason)

  useEffect(() => {
    if (props.defaultSeason && normalizedSeasons.includes(props.defaultSeason)) {
      setSeason(props.defaultSeason)
    } else if (!season && normalizedSeasons.length) {
      setSeason(normalizedSeasons[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.defaultSeason, normalizedSeasons])

  const { hofRows, seasonRows, loading, error, meta, rebuild } = useHallOfFame({
    leagueId: props.leagueId,
    season: season || null
  })

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-zinc-900 p-4 flex items-center justify-between">
        <div>
          <div className="font-bold">Hall of Fame</div>
          <div className="text-xs opacity-70">All-time leaderboard + season view</div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            {normalizedSeasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <button
            className="rounded-xl bg-white text-black px-4 py-2 font-bold disabled:opacity-60"
            disabled={loading}
            onClick={() => rebuild()}
          >
            Rebuild
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-zinc-950 p-3 text-sm opacity-80">Error: {error}</div>
      ) : null}

      {meta?.fallbackMode && (
        <div className="rounded-2xl bg-yellow-900/20 border border-yellow-700/30 px-4 py-3 text-yellow-300 text-xs">
          {meta.rankingSourceNote}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <HallOfFameCard rows={hofRows} />
        <SeasonLeaderboardCard season={season} rows={seasonRows} />
      </div>
    </div>
  )
}
