export type Side = "HOME" | "AWAY";

export type GameSpec = {
  round: number;
  gameNumber: number;
  region: string | null;
  team1Seed?: number | null;
  team2Seed?: number | null;
};

export type BracketNodeSeedSpec = GameSpec;

export type FirstFourMapping = {
  ff16A: { nextSlot: string; nextSide: Side };
  ff16B: { nextSlot: string; nextSide: Side };
  ff11A: { nextSlot: string; nextSide: Side };
  ff11B: { nextSlot: string; nextSide: Side };
};

export type FinalFourMapping = {
  semi1: { regionA: RegionKey; regionB: RegionKey };
  semi2: { regionA: RegionKey; regionB: RegionKey };
};

export type RegionKey = "E" | "W" | "S" | "M";
export type RegionName = "East" | "West" | "South" | "Midwest";

const REGION_NAME: Record<RegionKey, RegionName> = {
  E: "East",
  W: "West",
  S: "South",
  M: "Midwest",
};

const R64_MATCHUPS: Array<[number, number]> = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

export function defaultFirstFourMapping(): FirstFourMapping {
  return {
    ff16A: { nextSlot: "E-R64-1", nextSide: "AWAY" },
    ff16B: { nextSlot: "W-R64-1", nextSide: "AWAY" },
    ff11A: { nextSlot: "S-R64-5", nextSide: "AWAY" },
    ff11B: { nextSlot: "M-R64-5", nextSide: "AWAY" },
  };
}

export function defaultFinalFourMapping(): FinalFourMapping {
  return {
    semi1: { regionA: "E", regionB: "W" },
    semi2: { regionA: "S", regionB: "M" },
  };
}

export function generateNcaamBracketStructure(params: {
  season: number;
  firstFour?: FirstFourMapping;
  finalFour?: FinalFourMapping;
}): { name: string; sport: string; season: number; games: GameSpec[] } {
  const games: GameSpec[] = [];
  let gameCounter = 0;

  games.push(
    { round: 0, gameNumber: ++gameCounter, region: null, team1Seed: 16, team2Seed: 16 },
    { round: 0, gameNumber: ++gameCounter, region: null, team1Seed: 16, team2Seed: 16 },
    { round: 0, gameNumber: ++gameCounter, region: null, team1Seed: 11, team2Seed: 11 },
    { round: 0, gameNumber: ++gameCounter, region: null, team1Seed: 11, team2Seed: 11 }
  );

  const regions: RegionKey[] = ["E", "W", "S", "M"];

  for (const r of regions) {
    const regionName = REGION_NAME[r];

    for (let i = 0; i < 8; i++) {
      const [seedHome, seedAway] = R64_MATCHUPS[i];
      games.push({
        round: 1,
        gameNumber: ++gameCounter,
        region: regionName,
        team1Seed: seedHome,
        team2Seed: seedAway,
      });
    }

    for (let i = 0; i < 4; i++) {
      games.push({
        round: 2,
        gameNumber: ++gameCounter,
        region: regionName,
        team1Seed: null,
        team2Seed: null,
      });
    }

    for (let i = 0; i < 2; i++) {
      games.push({
        round: 3,
        gameNumber: ++gameCounter,
        region: regionName,
        team1Seed: null,
        team2Seed: null,
      });
    }

    games.push({
      round: 4,
      gameNumber: ++gameCounter,
      region: regionName,
      team1Seed: null,
      team2Seed: null,
    });
  }

  games.push(
    { round: 5, gameNumber: ++gameCounter, region: null, team1Seed: null, team2Seed: null },
    { round: 5, gameNumber: ++gameCounter, region: null, team1Seed: null, team2Seed: null }
  );

  games.push({
    round: 6,
    gameNumber: ++gameCounter,
    region: null,
    team1Seed: null,
    team2Seed: null,
  });

  return {
    name: "NCAA Men's Tournament",
    sport: "ncaam",
    season: params.season,
    games,
  };
}
