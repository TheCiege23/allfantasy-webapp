import { prisma } from "@/lib/prisma"

export async function getActiveTournament(): Promise<{
  id: string
  name: string
  season: number
  sport: string
} | null> {
  const currentYear = new Date().getFullYear()

  const tournament = await (prisma as any).bracketTournament.findFirst({
    where: { sport: "ncaam", season: currentYear },
    select: { id: true, name: true, season: true, sport: true },
  }).catch(() => null)

  if (tournament) return tournament

  const latest = await (prisma as any).bracketTournament.findFirst({
    where: { sport: "ncaam" },
    orderBy: { season: "desc" },
    select: { id: true, name: true, season: true, sport: true },
  }).catch(() => null)

  return latest ?? null
}
