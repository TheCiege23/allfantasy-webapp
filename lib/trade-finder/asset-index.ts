import type { Position } from "@/lib/league-decision-context";

export type TradeAsset = {
  id: string;
  label: string;
  kind: "PLAYER" | "PICK";
  value?: number;
  tier?: string;
  position?: Position | string;
};

type PricedPlayer = {
  id: string;
  name: string;
  position?: Position | string;
  value: number;
  tier?: string;
};

type PricedPick = {
  id: string;
  label: string;
  value: number;
  tier?: string;
  season: number;
  round: number;
  originalRosterId?: string;
  ownerRosterId?: string;
};

export function buildAssetIndex(args: {
  pricedPlayers?: PricedPlayer[];
  pricedPicks?: PricedPick[];
  rosters: Array<{
    roster_id: number | string;
    players?: string[];
    starters?: string[];
  }>;
  picks: Array<{
    season: number;
    round: number;
    owner_id: number | string;
    roster_id?: number | string;
    original_owner_id?: number | string;
  }>;
  rosterIdToName?: Record<string, string>;
  formatPickLabel?: (p: {
    season: number;
    round: number;
    ownerId: string;
    originalId?: string;
  }) => string;
}): Record<string, TradeAsset> {
  const {
    pricedPlayers = [],
    pricedPicks = [],
    rosters,
    picks,
    rosterIdToName = {},
    formatPickLabel,
  } = args;

  const index: Record<string, TradeAsset> = {};

  for (const p of pricedPlayers) {
    index[p.id] = {
      id: p.id,
      label: p.name,
      kind: "PLAYER",
      value: p.value,
      tier: p.tier,
      position: p.position,
    };
  }

  for (const raw of picks) {
    const ownerId = String(raw.owner_id);
    const originalId =
      raw.original_owner_id != null ? String(raw.original_owner_id) : undefined;

    const pickId = makeSleeperPickId({
      season: raw.season,
      round: raw.round,
      ownerId,
      originalId,
    });

    const priced = pricedPicks.find((pp) => pp.id === pickId);

    const label =
      priced?.label ??
      (formatPickLabel
        ? formatPickLabel({
            season: raw.season,
            round: raw.round,
            ownerId,
            originalId,
          })
        : defaultPickLabel({
            season: raw.season,
            round: raw.round,
            ownerId,
            originalId,
            rosterIdToName,
          }));

    index[pickId] = {
      id: pickId,
      label,
      kind: "PICK",
      value: priced?.value,
      tier: priced?.tier,
    };
  }

  for (const r of rosters) {
    const all = new Set([...(r.players ?? []), ...(r.starters ?? [])]);
    for (const playerId of all) {
      if (!index[playerId]) {
        index[playerId] = {
          id: playerId,
          label: `Player ${playerId}`,
          kind: "PLAYER",
        };
      }
    }
  }

  return index;
}

export function makeSleeperPickId(args: {
  season: number;
  round: number;
  ownerId: string;
  originalId?: string;
}): string {
  const { season, round, ownerId, originalId } = args;
  return originalId && originalId !== ownerId
    ? `pick_${season}_r${round}_own${ownerId}_orig${originalId}`
    : `pick_${season}_r${round}_own${ownerId}`;
}

function defaultPickLabel(args: {
  season: number;
  round: number;
  ownerId: string;
  originalId?: string;
  rosterIdToName: Record<string, string>;
}): string {
  const { season, round, ownerId, originalId, rosterIdToName } = args;
  const ownerName = rosterIdToName[ownerId] ?? `Team ${ownerId}`;
  const rnd = ordinal(round);
  const origName = originalId
    ? (rosterIdToName[originalId] ?? `Team ${originalId}`)
    : null;

  if (origName && originalId !== ownerId) {
    return `${season} ${rnd} (via ${origName})`;
  }
  return `${season} ${rnd} (${ownerName})`;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}
