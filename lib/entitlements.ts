export type Entitlements = {
  isSupporter: boolean;
  hasBracketLabPass: boolean;
  bracketLabPassTournamentId?: string;
};

export function canAccessBracketLab(ent: Entitlements, tournamentId: string) {
  return ent.hasBracketLabPass && ent.bracketLabPassTournamentId === tournamentId;
}
