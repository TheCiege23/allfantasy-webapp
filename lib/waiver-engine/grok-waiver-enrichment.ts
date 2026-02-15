// lib/waiver-engine/grok-waiver-enrichment.ts
import type { GrokEnrichmentResult } from "@/lib/ai-external/grok-types";
import { grokEnrich } from "@/lib/ai-external/grok";
import type { WaiverSuggestion } from "./waiver-types";

export async function enrichWaiverSuggestionWithGrok(args: {
  leagueMeta?: {
    leagueName?: string;
    format?: "dynasty" | "redraft" | string;
    superflex?: boolean;
    tep?: boolean;
    idp?: boolean;
  };
  suggestion: WaiverSuggestion;
  teamContextNotes?: string[];
}): Promise<GrokEnrichmentResult> {
  const { leagueMeta, suggestion, teamContextNotes } = args;

  return grokEnrich({
    kind: "waiver_narrative",
    context: {
      leagueName: leagueMeta?.leagueName,
      format: leagueMeta?.format,
      superflex: leagueMeta?.superflex,
      tep: leagueMeta?.tep,
      idp: leagueMeta?.idp,
    },
    payload: {
      add: suggestion.add
        ? {
            name: suggestion.add.name || suggestion.add.id,
            pos: suggestion.add.pos,
            team: suggestion.add.team,
            tags: suggestion.add.tags || [],
          }
        : null,
      drop: suggestion.drop
        ? {
            name: suggestion.drop.name || suggestion.drop.id,
            pos: suggestion.drop.pos,
            team: suggestion.drop.team,
            tags: suggestion.drop.tags || [],
          }
        : null,
      reasons: suggestion.reasons || [],
      teamContextNotes: teamContextNotes || [],
    },
  });
}
