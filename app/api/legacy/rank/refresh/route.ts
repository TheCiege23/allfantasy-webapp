import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeLegacyRankPreview } from "@/lib/ranking/computeLegacyRank";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { trackLegacyToolUsage } from "@/lib/analytics-server";

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const POST = withApiUsage({ endpoint: "/api/legacy/rank/refresh", tool: "LegacyRankRefresh" })(async (request: NextRequest) => {
  const raw = request.nextUrl.searchParams.get("sleeper_username")?.trim();
  if (!raw) return NextResponse.json({ error: "Missing sleeper_username" }, { status: 400 });

  const uname = raw.toLowerCase();

  // Unified per-user limiter (1 refresh per 60 seconds)
  // Note: we keep IP available for future anti-abuse, but you asked "per user instead of IP"
  const ip = getClientIp(request);
  const rl = consumeRateLimit({
    scope: "legacy",
    action: "rank_refresh",
    sleeperUsername: uname,
    ip,
    maxRequests: 1,
    windowMs: 60_000,
    includeIpInKey: false,
  });

  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Please wait before refreshing again.",
        retryAfterSec: rl.retryAfterSec || 60,
        remaining: rl.remaining ?? 0,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec || 60) },
      }
    );
  }

  const legacyUser = await prisma.legacyUser.findFirst({
    where: { sleeperUsername: uname },
    select: { id: true, sleeperUsername: true, sleeperUserId: true },
  });

  if (!legacyUser) {
    return NextResponse.json({ error: "Legacy user not found. Run import first." }, { status: 404 });
  }

  const leagues = await prisma.legacyLeague.findMany({
    where: { userId: legacyUser.id },
    orderBy: [{ season: "desc" }, { name: "asc" }],
    include: {
      seasonSummary: true,
      rosters: {
        where: {
          OR: [{ ownerId: legacyUser.sleeperUserId }, { isOwner: true }],
        },
      },
    },
  });

  const myRosterByLeagueId = new Map<string, any>();
  for (const lg of leagues as any[]) {
    const candidates = lg.rosters ?? [];
    const byOwnerId =
      candidates.find((r: any) => r.ownerId != null && String(r.ownerId) === String(legacyUser.sleeperUserId)) ?? null;
    const byIsOwner = candidates.find((r: any) => r.isOwner === true) ?? null;
    const myRoster = byOwnerId ?? byIsOwner;
    if (myRoster) myRosterByLeagueId.set(lg.id, myRoster);
  }

  const myRosters = Array.from(myRosterByLeagueId.values());

  const seasonsPlayed = new Set((leagues as any[]).map((lg) => lg.season)).size || 1;
  const totalWins = myRosters.reduce((s, r) => s + safeNum(r.wins), 0);

  const championships = (leagues as any[]).reduce((s, lg) => {
    const r = myRosterByLeagueId.get(lg.id);
    if (!r) return s;
    const fallbackChampion = lg.winnerRosterId != null && safeNum(lg.winnerRosterId) === safeNum(r.rosterId);
    return s + ((r.isChampion || fallbackChampion) ? 1 : 0);
  }, 0);

  const league_history = (leagues as any[]).map((lg) => {
    const r = myRosterByLeagueId.get(lg.id);

    const wins = safeNum(r?.wins, 0);
    const losses = safeNum(r?.losses, 0);
    const ties = safeNum(r?.ties, 0);

    const fallbackChampion =
      r && lg.winnerRosterId != null && safeNum(lg.winnerRosterId) === safeNum(r.rosterId);
    const isChampion = !!r?.isChampion || !!fallbackChampion;

    const playoffTeams = safeNum((lg as any).playoffTeams, 0);
    const finalStanding = r?.finalStanding != null ? safeNum(r.finalStanding, 0) : null;
    const playoffSeed = r?.playoffSeed != null ? safeNum(r.playoffSeed, 0) : null;

    const madePlayoffs =
      (playoffSeed != null && playoffSeed > 0) ||
      isChampion ||
      (playoffTeams > 0 && finalStanding != null && finalStanding > 0 && finalStanding <= playoffTeams);

    return {
      season: lg.season,
      sport: lg.sport,
      type: lg.leagueType,
      scoring: lg.scoringType,
      team_count: lg.teamCount,

      wins,
      losses,
      ties,

      made_playoffs: !!madePlayoffs,
      is_champion: !!isChampion,
    };
  });

  if (league_history.length === 0) {
    return NextResponse.json(
      { error: "No leagues found yet. Import your Sleeper history first." },
      { status: 404 }
    );
  }

  const playoffAppearances = league_history.reduce((s, lg) => s + (lg.made_playoffs ? 1 : 0), 0);

  const preview = computeLegacyRankPreview({
    totals: {
      seasons_imported: seasonsPlayed,
      leagues_played: myRosters.length,
      wins: totalWins,
      playoffs: playoffAppearances,
      championships,
    },
    leagueHistory: league_history as any,
  });

  // Keep DB caching for fast loads and "stale" detection
  await prisma.$executeRaw`
    INSERT INTO legacy_user_rank_cache (
      legacy_user_id,
      career_xp, career_level, career_tier, career_tier_name,
      baseline_year_xp, ai_low_year_xp, ai_mid_year_xp, ai_high_year_xp,
      assumptions_json,
      last_calculated_at,
      last_refresh_at
    )
    VALUES (
      ${legacyUser.id},
      ${preview.career.xp}, ${preview.career.level}, ${preview.career.tier}, ${preview.career.tier_name},
      ${preview.yearly_projection.baseline_year_xp},
      ${preview.yearly_projection.ai_low_year_xp},
      ${preview.yearly_projection.ai_mid_year_xp},
      ${preview.yearly_projection.ai_high_year_xp},
      ${JSON.stringify(preview.yearly_projection.assumptions)}::jsonb,
      now(),
      now()
    )
    ON CONFLICT (legacy_user_id)
    DO UPDATE SET
      career_xp = EXCLUDED.career_xp,
      career_level = EXCLUDED.career_level,
      career_tier = EXCLUDED.career_tier,
      career_tier_name = EXCLUDED.career_tier_name,
      baseline_year_xp = EXCLUDED.baseline_year_xp,
      ai_low_year_xp = EXCLUDED.ai_low_year_xp,
      ai_mid_year_xp = EXCLUDED.ai_mid_year_xp,
      ai_high_year_xp = EXCLUDED.ai_high_year_xp,
      assumptions_json = EXCLUDED.assumptions_json,
      last_calculated_at = now(),
      last_refresh_at = now()
  `;

  // Track tool usage
  trackLegacyToolUsage('rank_refresh', legacyUser.id)

  return NextResponse.json({
    ok: true,
    ranking_preview: preview,
    rate_limit: { remaining: rl.remaining, retryAfterSec: rl.retryAfterSec },
  });
})
