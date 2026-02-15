const SLEEPER_HEADSHOT_BASE = 'https://sleepercdn.com/content/nfl/players/thumb'
const ESPN_LOGO_BASE = 'https://a.espncdn.com/i/teamlogos/nfl/500'

const NFL_TEAM_MAP: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BUF: 'buf',
  CAR: 'car', CHI: 'chi', CIN: 'cin', CLE: 'cle',
  DAL: 'dal', DEN: 'den', DET: 'det', GB: 'gb',
  HOU: 'hou', IND: 'ind', JAX: 'jax', KC: 'kc',
  LAC: 'lac', LAR: 'lar', LV: 'lv', MIA: 'mia',
  MIN: 'min', NE: 'ne', NO: 'no', NYG: 'nyg',
  NYJ: 'nyj', PHI: 'phi', PIT: 'pit', SEA: 'sea',
  SF: 'sf', TB: 'tb', TEN: 'ten', WAS: 'was',
}

export function headshotUrl(sleeperId?: string | null): string {
  if (!sleeperId) return ''
  return `${SLEEPER_HEADSHOT_BASE}/${sleeperId}.jpg`
}

export function teamLogoUrl(teamAbbr?: string | null): string {
  if (!teamAbbr) return ''
  const key = NFL_TEAM_MAP[teamAbbr.toUpperCase()]
  return key ? `${ESPN_LOGO_BASE}/${key}.png` : ''
}

export interface PlayerMedia {
  headshotUrl: string | null
  teamLogoUrl: string | null
}

export function resolveHeadshot(
  media?: PlayerMedia | null,
  sleeperId?: string | null
): string {
  return media?.headshotUrl || headshotUrl(sleeperId)
}

export function resolveTeamLogo(
  media?: PlayerMedia | null,
  teamAbbr?: string | null
): string {
  return media?.teamLogoUrl || teamLogoUrl(teamAbbr)
}

export { NFL_TEAM_MAP }
