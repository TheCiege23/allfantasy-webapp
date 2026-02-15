type Difficulty = {
  score: number;
  tier: "Casual" | "Competitive" | "Challenger" | "Elite" | "Legendary";
  multiplier: number;
  breakdown: {
    teamCountPts: number;
    rosterDepthPts: number;
    scoringPts: number;
    leagueTypePts: number;
    draftTypePts: number;
    formatWeight: number;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function teamCountPoints(teamCount?: number | null) {
  const n = Number(teamCount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 8) return 0;
  if (n <= 10) return 1;
  if (n <= 12) return 2;
  if (n <= 14) return 3;
  if (n <= 16) return 4;
  return 5;
}

function rosterDepthPoints(_starterCount?: number | null) {
  return 0;
}

function scoringPoints(scoringType?: string | null) {
  const s = (scoringType || "").toLowerCase();
  if (!s) return 0;
  if (s.includes("idp")) return 5;
  if (s.includes("premium") || s.includes("te") || s.includes("superflex") || s.includes("2qb")) return 4;
  if (s.includes("ppr") || s.includes("half")) return 2;
  return 0;
}

function leagueTypePoints(leagueType?: string | null) {
  const t = (leagueType || "").toLowerCase();
  if (!t) return 0;

  if (t.includes("survivor") || t.includes("big brother")) return 5;
  if (t.includes("devy")) return 5;
  if (t.includes("guillotine")) return 5;
  if (t.includes("koth") || t.includes("king of the hill")) return 5;
  if (t.includes("zombie") || t.includes("gambit") || t.includes("graveyard") || t.includes("royal")) return 5;

  if (t.includes("dynasty")) return 4;
  if (t.includes("keeper")) return 3;
  if (t.includes("bestball") || t.includes("best ball")) return 3;

  return 0;
}

function draftTypePoints(_draftType?: string | null) {
  return 0;
}

function formatWeightMultiplier(leagueType?: string | null) {
  const t = (leagueType || "").toLowerCase();
  if (!t) return 1.0;
  if (t.includes("survivor") || t.includes("big brother")) return 1.25;
  if (t.includes("guillotine")) return 1.15;
  if (t.includes("devy")) return 1.20;
  if (t.includes("dynasty") || t.includes("keeper") || t.includes("bestball") || t.includes("best ball")) return 1.10;
  if (t.includes("koth") || t.includes("king of the hill") || t.includes("royal") || t.includes("zombie") || t.includes("gambit") || t.includes("graveyard"))
    return 1.20;
  return 1.0;
}

export function difficultyFromLegacyLeague(input: {
  teamCount?: number | null;
  scoringType?: string | null;
  leagueType?: string | null;
  starterCount?: number | null;
  draftType?: string | null;
}): Difficulty {
  const teamCountPts = teamCountPoints(input.teamCount);
  const rosterDepthPts = rosterDepthPoints(input.starterCount);
  const scoringPts = scoringPoints(input.scoringType);
  const leagueTypePts = leagueTypePoints(input.leagueType);
  const draftTypePts = draftTypePoints(input.draftType);

  const score = teamCountPts + rosterDepthPts + scoringPts + leagueTypePts + draftTypePts;

  let tier: Difficulty["tier"] = "Casual";
  let mult = 1.0;

  if (score <= 5) { tier = "Casual"; mult = 1.0; }
  else if (score <= 10) { tier = "Competitive"; mult = 1.25; }
  else if (score <= 15) { tier = "Challenger"; mult = 1.5; }
  else if (score <= 20) { tier = "Elite"; mult = 2.0; }
  else { tier = "Legendary"; mult = 3.0; }

  const formatWeight = formatWeightMultiplier(input.leagueType);

  const finalMultiplier = clamp(mult * formatWeight, 1.0, 3.0);

  return {
    score,
    tier,
    multiplier: finalMultiplier,
    breakdown: { teamCountPts, rosterDepthPts, scoringPts, leagueTypePts, draftTypePts, formatWeight },
  };
}
