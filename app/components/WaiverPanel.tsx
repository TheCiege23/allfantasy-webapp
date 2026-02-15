"use client";

import React, { useMemo, useState } from "react";
import WaiverSuggestionCard from "@/app/components/WaiverSuggestionCard";
import PlayerDetailModal from "@/components/PlayerDetailModal";
import type { WaiverResult } from "@/lib/types/WaiverResult";

type PartialWaiverResult = Pick<
  WaiverResult,
  "summary" | "top_adds" | "strategy_notes"
> & {
  bench_optimization_tips?: string[];
  risk_flags?: string[];
};

export default function WaiverPanel({ result }: { result: PartialWaiverResult }) {
  const adds = useMemo(() => result?.top_adds ?? [], [result]);
  const [selectedPlayer, setSelectedPlayer] = useState<{ name: string; id?: string; pos?: string; team?: string } | null>(null);

  return (
    <div className="space-y-4">
      {result.summary ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/50">
            Summary
          </div>
          <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">
            {result.summary}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {adds.map((add, index) => (
          <div key={`${add.player_id ?? add.player_name}-${index}`}>
            <WaiverSuggestionCard
              suggestion={{
                player_name: add.player_name,
                tier: add.tier ?? "Top Add",
                priority: add.priority_rank,
                reasoning: add.reasoning ?? "",
                team: add.team ?? undefined,
                pos: add.position,
                player_id: add.player_id,
                ai: add.ai,
              }}
              onClick={() => setSelectedPlayer({
                name: add.player_name,
                id: add.player_id,
                pos: add.position,
                team: add.team ?? undefined,
              })}
            />

            {add.faab_bid_recommendation !== null && (
              <div className="mt-2 ml-4 text-green-400 text-sm">
                Recommended FAAB: ${add.faab_bid_recommendation}
              </div>
            )}

            {add.drop_candidate && (
              <div className="mt-1 ml-4 text-red-400 text-sm">
                Drop: {add.drop_candidate}
              </div>
            )}
          </div>
        ))}
      </div>

      {(result.strategy_notes?.faab_strategy ||
        result.strategy_notes?.priority_strategy ||
        result.strategy_notes?.timing_notes) && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-[11px] uppercase tracking-wide text-white/50">
            Strategy Notes
          </div>
          <div className="mt-2 space-y-2 text-sm text-white/75">
            {result.strategy_notes?.faab_strategy ? (
              <div>
                <span className="text-white/60">FAAB:</span>{" "}
                {result.strategy_notes.faab_strategy}
              </div>
            ) : null}
            {result.strategy_notes?.priority_strategy ? (
              <div>
                <span className="text-white/60">Priority:</span>{" "}
                {result.strategy_notes.priority_strategy}
              </div>
            ) : null}
            {result.strategy_notes?.timing_notes ? (
              <div>
                <span className="text-white/60">Timing:</span>{" "}
                {result.strategy_notes.timing_notes}
              </div>
            ) : null}
          </div>
        </div>
      )}

      <PlayerDetailModal
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        playerName={selectedPlayer?.name || ''}
        playerId={selectedPlayer?.id}
        position={selectedPlayer?.pos}
        team={selectedPlayer?.team}
      />
    </div>
  );
}
