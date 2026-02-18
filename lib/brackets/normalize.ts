export function normalizeTeamName(name?: string | null): string {
  if (!name) return ""
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

export function isPlaceholderTeam(name?: string | null): boolean {
  if (!name) return true
  const n = name.toLowerCase()
  return n.startsWith("winner of") || n.startsWith("tbd") || n === "tba"
}
