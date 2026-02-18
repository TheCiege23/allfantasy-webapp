import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { decrypt } from '@/lib/league-auth-crypto';
import { XMLParser } from 'fast-xml-parser';

interface LeaguePayload {
  name: string;
  leagueSize: number;
  scoring: string;
  isDynasty: boolean;
  settings: any;
  rosters: {
    platformUserId: string;
    playerData: string[];
    faabRemaining: number | null;
  }[];
}

function detectScoring(leagueData: any): string {
  const rec = leagueData.scoring_settings?.rec;
  if (rec === 1) return 'ppr';
  if (rec === 0.5) return 'half';
  return 'standard';
}

function detectDynasty(leagueData: any): boolean {
  return leagueData.settings?.type === 2 || leagueData.settings?.type === 'dynasty';
}

async function fetchSleeperLeague(platformLeagueId: string): Promise<LeaguePayload> {
  const [leagueRes, rostersRes] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}`),
    fetch(`https://api.sleeper.app/v1/league/${platformLeagueId}/rosters`),
  ]);

  if (!leagueRes.ok) throw new Error('Failed to fetch league from Sleeper');
  if (!rostersRes.ok) throw new Error('Failed to fetch rosters from Sleeper');

  const leagueData = await leagueRes.json();
  const rostersData = await rostersRes.json();

  return {
    name: leagueData.name || 'Unknown League',
    leagueSize: leagueData.total_rosters || 12,
    scoring: detectScoring(leagueData),
    isDynasty: detectDynasty(leagueData),
    settings: leagueData.settings || {},
    rosters: (Array.isArray(rostersData) ? rostersData : [])
      .filter((r: any) => !!r.owner_id)
      .map((r: any) => ({
        platformUserId: r.owner_id,
        playerData: r.players || [],
        faabRemaining: r.settings?.waiver_budget_used != null
          ? Math.max(0, 100 - r.settings.waiver_budget_used)
          : null,
      })),
  };
}

async function fetchMflLeague(platformLeagueId: string, apiKey: string): Promise<LeaguePayload> {
  const year = new Date().getFullYear();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  const [leagueRes, rostersRes] = await Promise.all([
    fetch(`https://api.myfantasyleague.com/${year}/export?TYPE=league&L=${platformLeagueId}&APIKEY=${apiKey}&JSON=1`),
    fetch(`https://api.myfantasyleague.com/${year}/export?TYPE=rosters&L=${platformLeagueId}&APIKEY=${apiKey}&JSON=1`),
  ]);

  if (!leagueRes.ok) throw new Error('Failed to fetch league from MFL — check your API key');

  const leagueText = await leagueRes.text();
  let leagueData: any;

  try {
    leagueData = JSON.parse(leagueText);
  } catch {
    const parsed = parser.parse(leagueText);
    leagueData = parsed;
  }

  const league = leagueData?.league || leagueData;
  const franchises = league?.franchises?.franchise || [];
  const franchiseList = Array.isArray(franchises) ? franchises : [franchises];

  let rosters: LeaguePayload['rosters'] = [];
  if (rostersRes.ok) {
    const rostersText = await rostersRes.text();
    try {
      const rostersData = JSON.parse(rostersText);
      const rosterList = rostersData?.rosters?.franchise || [];
      const rosterArray = Array.isArray(rosterList) ? rosterList : [rosterList];

      rosters = rosterArray
        .filter((r: any) => r.id)
        .map((r: any) => {
          const players = r.player || [];
          const playerArray = Array.isArray(players) ? players : [players];
          return {
            platformUserId: r.id,
            playerData: playerArray.map((p: any) => p.id || p).filter(Boolean),
            faabRemaining: null,
          };
        });
    } catch {
      rosters = [];
    }
  }

  const scoringType = league?.scoring_type || '';
  let scoring = 'standard';
  if (scoringType.toLowerCase().includes('ppr')) scoring = 'ppr';
  else if (scoringType.toLowerCase().includes('half')) scoring = 'half';

  return {
    name: league?.name || 'MFL League',
    leagueSize: franchiseList.length || 12,
    scoring,
    isDynasty: league?.keeper === 'yes' || league?.type === 'dynasty' || false,
    settings: league,
    rosters,
  };
}

async function fetchEspnLeague(platformLeagueId: string, swid: string, s2: string): Promise<LeaguePayload> {
  const year = new Date().getFullYear();
  const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${platformLeagueId}?view=mRoster&view=mTeam&view=mSettings`;

  const res = await fetch(url, {
    headers: {
      Cookie: `SWID=${swid}; espn_s2=${s2}`,
    },
  });

  if (!res.ok) throw new Error('Failed to fetch ESPN league — check your SWID and ESPN_S2 cookies');

  const data = await res.json();
  const settings = data.settings || {};
  const teams = data.teams || [];

  const scoringId = settings.scoringSettings?.scoringType;
  let scoring = 'standard';
  if (scoringId === 'PPR' || scoringId === 1) scoring = 'ppr';
  else if (scoringId === 'HALF_PPR') scoring = 'half';

  return {
    name: settings.name || 'ESPN League',
    leagueSize: settings.size || teams.length || 12,
    scoring,
    isDynasty: settings.keeperCount > 0 || settings.draftSettings?.keeperCount > 0 || false,
    settings: settings,
    rosters: teams.map((t: any) => {
      const players = (t.roster?.entries || []).map((e: any) =>
        String(e.playerId || e.playerPoolEntry?.id || '')
      ).filter(Boolean);

      return {
        platformUserId: String(t.id),
        playerData: players,
        faabRemaining: t.waiverBudgetRemaining ?? null,
      };
    }),
  };
}

async function fetchYahooLeague(_platformLeagueId: string, _oauthToken: string): Promise<LeaguePayload> {
  throw new Error('Yahoo sync requires OAuth2 refresh flow — full implementation coming soon. Your credentials have been saved securely.');
}

async function fetchFantraxLeague(_platformLeagueId: string): Promise<LeaguePayload> {
  throw new Error('Fantrax sync is under development — check back soon.');
}

async function getDecryptedAuth(userId: string, platform: string) {
  const auth = await (prisma as any).leagueAuth.findUnique({
    where: { userId_platform: { userId, platform } },
  });

  if (!auth) return null;

  return {
    apiKey: auth.apiKey ? decrypt(auth.apiKey) : null,
    oauthToken: auth.oauthToken ? decrypt(auth.oauthToken) : null,
    oauthSecret: auth.oauthSecret ? decrypt(auth.oauthSecret) : null,
    espnSwid: auth.espnSwid ? decrypt(auth.espnSwid) : null,
    espnS2: auth.espnS2 ? decrypt(auth.espnS2) : null,
  };
}

export async function POST(req: NextRequest) {
  let userId: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit(`league-sync:${ip}`, 5, 60_000);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { platform, platformLeagueId } = await req.json();

    if (!platform || !platformLeagueId) {
      return NextResponse.json({ error: 'Missing required fields: platform and platformLeagueId' }, { status: 400 });
    }

    const normalizedPlatform = platform.toLowerCase();
    let leaguePayload: LeaguePayload;

    switch (normalizedPlatform) {
      case 'sleeper':
        leaguePayload = await fetchSleeperLeague(platformLeagueId);
        break;

      case 'mfl': {
        const auth = await getDecryptedAuth(userId, 'mfl');
        if (!auth?.apiKey) {
          return NextResponse.json(
            { error: 'MFL API key required. Save your credentials in League Settings first.', authRequired: true, platform: 'mfl' },
            { status: 403 }
          );
        }
        leaguePayload = await fetchMflLeague(platformLeagueId, auth.apiKey);
        break;
      }

      case 'espn': {
        const auth = await getDecryptedAuth(userId, 'espn');
        if (!auth?.espnSwid || !auth?.espnS2) {
          return NextResponse.json(
            { error: 'ESPN requires SWID and ESPN_S2 cookies. Save your credentials in League Settings first.', authRequired: true, platform: 'espn' },
            { status: 403 }
          );
        }
        leaguePayload = await fetchEspnLeague(platformLeagueId, auth.espnSwid, auth.espnS2);
        break;
      }

      case 'yahoo': {
        const auth = await getDecryptedAuth(userId, 'yahoo');
        if (!auth?.oauthToken) {
          return NextResponse.json(
            { error: 'Yahoo requires OAuth credentials. Save your credentials in League Settings first.', authRequired: true, platform: 'yahoo' },
            { status: 403 }
          );
        }
        leaguePayload = await fetchYahooLeague(platformLeagueId, auth.oauthToken);
        break;
      }

      case 'fantrax':
        leaguePayload = await fetchFantraxLeague(platformLeagueId);
        break;

      default:
        return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    const league = await (prisma as any).league.upsert({
      where: {
        userId_platform_platformLeagueId: {
          userId,
          platform: normalizedPlatform,
          platformLeagueId,
        },
      },
      update: {
        name: leaguePayload.name,
        leagueSize: leaguePayload.leagueSize,
        scoring: leaguePayload.scoring,
        isDynasty: leaguePayload.isDynasty,
        settings: leaguePayload.settings,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
        syncError: null,
        updatedAt: new Date(),
      },
      create: {
        platform: normalizedPlatform,
        platformLeagueId,
        userId,
        name: leaguePayload.name,
        leagueSize: leaguePayload.leagueSize,
        scoring: leaguePayload.scoring,
        isDynasty: leaguePayload.isDynasty,
        settings: leaguePayload.settings,
        lastSyncedAt: new Date(),
        syncStatus: 'success',
      },
    });

    let rosterCount = 0;
    for (const roster of leaguePayload.rosters) {
      await (prisma as any).roster.upsert({
        where: {
          leagueId_platformUserId: { leagueId: league.id, platformUserId: roster.platformUserId },
        },
        update: {
          playerData: roster.playerData,
          faabRemaining: roster.faabRemaining,
          updatedAt: new Date(),
        },
        create: {
          leagueId: league.id,
          platformUserId: roster.platformUserId,
          playerData: roster.playerData,
          faabRemaining: roster.faabRemaining,
        },
      });
      rosterCount++;
    }

    return NextResponse.json({
      success: true,
      leagueId: league.id,
      leagueName: league.name,
      platform: normalizedPlatform,
      rostersSync: rosterCount,
      scoring: leaguePayload.scoring,
      isDynasty: leaguePayload.isDynasty,
      lastSyncedAt: league.lastSyncedAt,
    });
  } catch (error: any) {
    console.error('[League Sync]', error);

    try {
      if (userId) {
        await (prisma as any).league.updateMany({
          where: { userId, syncStatus: 'pending' },
          data: {
            syncStatus: 'error',
            syncError: (error.message || 'Unknown error').slice(0, 500),
          },
        });
      }
    } catch {}

    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
