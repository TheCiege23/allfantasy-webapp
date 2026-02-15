export interface SleeperUserIdentity {
  username: string
  userId: string
}

export function buildSleeperUser(
  username: string,
  profile: { sleeper_user_id?: string | null } | null
): SleeperUserIdentity {
  return {
    username,
    userId: profile?.sleeper_user_id || '',
  }
}
