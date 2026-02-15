const SLEEPER_HEADSHOT_BASE = 'https://sleepercdn.com/content/nfl/players/thumb'
const ESPN_LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500'

const ESPN_TEAM_MAP: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BUF: 'buf',
  CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gb',
  HOU: 'hou', IND: 'ind', JAX: 'jax', KC: 'kc',
  LAC: 'lac', LAR: 'lar', LV: 'lv', MIA: 'mia',
  MIN: 'min', NE: 'ne', NO: 'no', NYG: 'nyg',
  NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea',
  SF: 'sf', TB: 'tb', TEN: 'ten', WAS: 'was',
}

export interface PlayerMedia {
  headshotUrl: string | null
  teamLogoUrl: string | null
}

export interface StandardPlayer {
  playerId: string
  fullName: string
  position: string
  teamAbbr: string | null
  sport: 'nfl'
  media: PlayerMedia
}

export function buildPlayerMedia(sleeperId: string | null, teamAbbr: string | null): PlayerMedia {
  return {
    headshotUrl: sleeperId ? `${SLEEPER_HEADSHOT_BASE}/${sleeperId}.jpg` : null,
    teamLogoUrl: teamAbbr ? getTeamLogoUrl(teamAbbr) : null,
  }
}

export function toStandardPlayer(
  playerId: string,
  fullName: string,
  position: string,
  teamAbbr: string | null,
): StandardPlayer {
  return {
    playerId,
    fullName,
    position,
    teamAbbr,
    sport: 'nfl',
    media: buildPlayerMedia(playerId, teamAbbr),
  }
}

function getTeamLogoUrl(team: string): string | null {
  const upper = team.toUpperCase()
  const key = ESPN_TEAM_MAP[upper]
  return key ? `${ESPN_LOGO_BASE}/${key}.png` : null
}
