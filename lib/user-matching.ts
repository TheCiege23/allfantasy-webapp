export interface PartyLike {
  userId?: string
  teamName?: string
  displayName?: string
  rosterId?: number
}

export function isUserParty(
  p: PartyLike,
  username: string,
  sleeperUserId?: string
): boolean {
  if (!p) return false
  const uLower = username?.toLowerCase() || ''

  if (sleeperUserId && p.userId === sleeperUserId) return true
  if (p.userId === username) return true

  if (p.displayName?.toLowerCase() === uLower) return true
  if (p.teamName?.toLowerCase() === uLower) return true

  if (uLower.length > 2) {
    if (p.displayName?.toLowerCase().includes(uLower)) return true
    if (p.teamName?.toLowerCase().includes(uLower)) return true
  }

  return false
}

export function isWinnerUser(
  winner: string | undefined | null,
  username: string,
  sleeperUserId?: string,
  userPartyDisplayName?: string
): boolean {
  if (!winner || winner === 'Even') return false
  const winnerLower = winner.toLowerCase()
  const userLower = username.toLowerCase()
  const partyLower = userPartyDisplayName?.toLowerCase()

  if (winnerLower === userLower) return true
  if (partyLower && winnerLower === partyLower) return true
  if (sleeperUserId && winnerLower === sleeperUserId) return true

  if (userLower.length > 2 && winnerLower.includes(userLower)) return true
  if (partyLower && partyLower.length > 2 && winnerLower.includes(partyLower)) return true
  if (userLower.length > 2 && userLower.includes(winnerLower)) return true
  if (partyLower && partyLower.length > 2 && partyLower.includes(winnerLower)) return true

  return false
}
