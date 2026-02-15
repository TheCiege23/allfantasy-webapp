const CANONICAL_TEAMS: Record<string, { canonical: string; fullName: string; city: string; mascot: string }> = {
  ARI: { canonical: 'ARI', fullName: 'Arizona Cardinals', city: 'Arizona', mascot: 'Cardinals' },
  ATL: { canonical: 'ATL', fullName: 'Atlanta Falcons', city: 'Atlanta', mascot: 'Falcons' },
  BAL: { canonical: 'BAL', fullName: 'Baltimore Ravens', city: 'Baltimore', mascot: 'Ravens' },
  BUF: { canonical: 'BUF', fullName: 'Buffalo Bills', city: 'Buffalo', mascot: 'Bills' },
  CAR: { canonical: 'CAR', fullName: 'Carolina Panthers', city: 'Carolina', mascot: 'Panthers' },
  CHI: { canonical: 'CHI', fullName: 'Chicago Bears', city: 'Chicago', mascot: 'Bears' },
  CIN: { canonical: 'CIN', fullName: 'Cincinnati Bengals', city: 'Cincinnati', mascot: 'Bengals' },
  CLE: { canonical: 'CLE', fullName: 'Cleveland Browns', city: 'Cleveland', mascot: 'Browns' },
  DAL: { canonical: 'DAL', fullName: 'Dallas Cowboys', city: 'Dallas', mascot: 'Cowboys' },
  DEN: { canonical: 'DEN', fullName: 'Denver Broncos', city: 'Denver', mascot: 'Broncos' },
  DET: { canonical: 'DET', fullName: 'Detroit Lions', city: 'Detroit', mascot: 'Lions' },
  GB: { canonical: 'GB', fullName: 'Green Bay Packers', city: 'Green Bay', mascot: 'Packers' },
  HOU: { canonical: 'HOU', fullName: 'Houston Texans', city: 'Houston', mascot: 'Texans' },
  IND: { canonical: 'IND', fullName: 'Indianapolis Colts', city: 'Indianapolis', mascot: 'Colts' },
  JAX: { canonical: 'JAX', fullName: 'Jacksonville Jaguars', city: 'Jacksonville', mascot: 'Jaguars' },
  KC: { canonical: 'KC', fullName: 'Kansas City Chiefs', city: 'Kansas City', mascot: 'Chiefs' },
  LAC: { canonical: 'LAC', fullName: 'Los Angeles Chargers', city: 'Los Angeles', mascot: 'Chargers' },
  LAR: { canonical: 'LAR', fullName: 'Los Angeles Rams', city: 'Los Angeles', mascot: 'Rams' },
  LV: { canonical: 'LV', fullName: 'Las Vegas Raiders', city: 'Las Vegas', mascot: 'Raiders' },
  MIA: { canonical: 'MIA', fullName: 'Miami Dolphins', city: 'Miami', mascot: 'Dolphins' },
  MIN: { canonical: 'MIN', fullName: 'Minnesota Vikings', city: 'Minnesota', mascot: 'Vikings' },
  NE: { canonical: 'NE', fullName: 'New England Patriots', city: 'New England', mascot: 'Patriots' },
  NO: { canonical: 'NO', fullName: 'New Orleans Saints', city: 'New Orleans', mascot: 'Saints' },
  NYG: { canonical: 'NYG', fullName: 'New York Giants', city: 'New York', mascot: 'Giants' },
  NYJ: { canonical: 'NYJ', fullName: 'New York Jets', city: 'New York', mascot: 'Jets' },
  PHI: { canonical: 'PHI', fullName: 'Philadelphia Eagles', city: 'Philadelphia', mascot: 'Eagles' },
  PIT: { canonical: 'PIT', fullName: 'Pittsburgh Steelers', city: 'Pittsburgh', mascot: 'Steelers' },
  SEA: { canonical: 'SEA', fullName: 'Seattle Seahawks', city: 'Seattle', mascot: 'Seahawks' },
  SF: { canonical: 'SF', fullName: 'San Francisco 49ers', city: 'San Francisco', mascot: '49ers' },
  TB: { canonical: 'TB', fullName: 'Tampa Bay Buccaneers', city: 'Tampa Bay', mascot: 'Buccaneers' },
  TEN: { canonical: 'TEN', fullName: 'Tennessee Titans', city: 'Tennessee', mascot: 'Titans' },
  WAS: { canonical: 'WAS', fullName: 'Washington Commanders', city: 'Washington', mascot: 'Commanders' },
}

const ALIAS_MAP: Record<string, string> = {
  JAC: 'JAX',
  WSH: 'WAS',
  GNB: 'GB',
  GBP: 'GB',
  KCC: 'KC',
  NWE: 'NE',
  SFO: 'SF',
  TAM: 'TB',
  TBB: 'TB',
  NOR: 'NO',
  SDG: 'LAC',
  STL: 'LAR',
  LA: 'LAR',
  OAK: 'LV',
  RAI: 'LV',
  RAM: 'LAR',
  CLT: 'IND',
  RAV: 'BAL',
  HTX: 'HOU',
  CRD: 'ARI',
  WFT: 'WAS',
  WST: 'WAS',
}

export function normalizeTeamAbbrev(raw: string | null | undefined): string | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  if (!upper) return null

  if (CANONICAL_TEAMS[upper]) return upper

  const alias = ALIAS_MAP[upper]
  if (alias) return alias

  for (const [canonical, info] of Object.entries(CANONICAL_TEAMS)) {
    if (
      info.fullName.toLowerCase() === upper.toLowerCase() ||
      info.mascot.toLowerCase() === upper.toLowerCase() ||
      info.city.toLowerCase() === upper.toLowerCase()
    ) {
      return canonical
    }
  }

  return upper
}

export function getTeamInfo(abbrev: string | null | undefined) {
  if (!abbrev) return null
  const canonical = normalizeTeamAbbrev(abbrev)
  if (!canonical) return null
  return CANONICAL_TEAMS[canonical] || null
}

export function getAllCanonicalTeams() {
  return Object.entries(CANONICAL_TEAMS).map(([abbrev, info]) => ({
    abbrev,
    ...info,
  }))
}

const POSITION_CANONICAL: Record<string, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  PK: 'K',
  DEF: 'DEF',
  DST: 'DEF',
  DL: 'DL',
  DE: 'DL',
  DT: 'DL',
  LB: 'LB',
  ILB: 'LB',
  OLB: 'LB',
  MLB: 'LB',
  DB: 'DB',
  CB: 'DB',
  S: 'DB',
  SS: 'DB',
  FS: 'DB',
  EDGE: 'EDGE',
  OL: 'OL',
  OT: 'OL',
  OG: 'OL',
  C: 'OL',
  FB: 'RB',
}

export function normalizePosition(raw: string | null | undefined): string | null {
  if (!raw) return null
  const upper = raw.trim().toUpperCase()
  return POSITION_CANONICAL[upper] || upper
}

export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\bjr\.?\b/i, '')
    .replace(/\bsr\.?\b/i, '')
    .replace(/\bii+\b/i, '')
    .replace(/\biii\b/i, '')
    .replace(/\biv\b/i, '')
    .replace(/\bv\b/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function playerNamesMatch(nameA: string, nameB: string): boolean {
  const a = normalizePlayerName(nameA)
  const b = normalizePlayerName(nameB)
  if (a === b) return true

  const partsA = a.split(' ')
  const partsB = b.split(' ')
  if (partsA.length >= 2 && partsB.length >= 2) {
    if (partsA[partsA.length - 1] === partsB[partsB.length - 1] && partsA[0] === partsB[0]) {
      return true
    }
  }
  return false
}
