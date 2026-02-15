// lib/trade-engine/grok-enrichment.ts
import type { TradeCandidate } from "./types";
import type { GrokEnrichmentResult } from "../ai-external/grok-types";
import { grokEnrich } from "../ai-external/grok";

export async function enrichTradeCandidateWithGrok(args: {
  leagueMeta: {
    leagueName?: string;
    format?: "dynasty" | "redraft";
    superflex?: boolean;
    tep?: boolean;
    idp?: boolean;
  };
  candidate: TradeCandidate;
  guardrailReasons?: string[];
}): Promise<GrokEnrichmentResult> {
  const { leagueMeta, candidate, guardrailReasons } = args;

  return grokEnrich({
    kind: "trade_narrative",
    context: {
      leagueName: leagueMeta.leagueName,
      format: leagueMeta.format,
      superflex: leagueMeta.superflex,
      tep: leagueMeta.tep,
      idp: leagueMeta.idp,
    },
    payload: {
      fromManagerName: candidate.fromManagerName,
      toManagerName: candidate.toManagerName,
      give: (candidate.give || []).map((a) => ({
        type: a.type,
        name: a.name || a.displayName || a.id,
        pos: a.pos,
        team: a.team,
        tags: a.tags,
        projected: a.projected,
        round: a.round,
        pickSeason: a.pickSeason,
      })),
      receive: (candidate.receive || []).map((a) => ({
        type: a.type,
        name: a.name || a.displayName || a.id,
        pos: a.pos,
        team: a.team,
        tags: a.tags,
        projected: a.projected,
        round: a.round,
        pickSeason: a.pickSeason,
      })),
      acceptanceLabel: candidate.acceptanceLabel,
      vetoLikelihood: candidate.vetoLikelihood,
      parityFlags: candidate.parityFlags,
      riskFlags: candidate.riskFlags,
      guardrailReasons: guardrailReasons || [],
      whyTheyAccept: candidate.explanation?.whyTheyAccept || [],
      whyYouAccept: candidate.explanation?.whyYouAccept || [],
    },
  });
}
