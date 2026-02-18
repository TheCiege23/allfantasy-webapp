import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardContent from "./DashboardContent"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  if (!session?.user?.id || !session?.user?.email) {
    redirect("/login?callbackUrl=/dashboard")
  }

  const userId = session.user.id
  const email = session.user.email

  const appUser = await (prisma as any).appUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      emailVerified: true,
      avatarUrl: true,
    },
  }).catch(() => null)

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId },
    select: {
      sleeperUsername: true,
      sleeperUserId: true,
      sleeperLinkedAt: true,
      ageConfirmedAt: true,
      phoneVerifiedAt: true,
      profileComplete: true,
    },
  }).catch(() => null)

  const leagues = await (prisma as any).bracketLeagueMember.findMany({
    where: { userId },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          tournamentId: true,
          joinCode: true,
          _count: { select: { members: true } },
        },
      },
    },
  }).catch(() => [])

  const entriesRaw = await (prisma as any).bracketEntry.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      league: {
        select: { tournamentId: true },
      },
      picks: {
        select: { points: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  }).catch(() => [])

  const entries = entriesRaw.map((e: any) => ({
    id: e.id,
    name: e.name,
    tournamentId: e.league?.tournamentId || "",
    score: (e.picks || []).reduce((sum: number, p: any) => sum + (p.points || 0), 0),
  }))

  const isVerified = !!appUser?.emailVerified || !!profile?.phoneVerifiedAt
  const isAgeConfirmed = !!profile?.ageConfirmedAt

  return (
    <DashboardContent
      user={{
        id: appUser?.id || userId,
        username: appUser?.username || null,
        displayName: appUser?.displayName || null,
        email: email,
        emailVerified: !!appUser?.emailVerified,
        avatarUrl: appUser?.avatarUrl || null,
      }}
      profile={{
        sleeperUsername: profile?.sleeperUsername || null,
        isVerified,
        isAgeConfirmed,
        profileComplete: profile?.profileComplete || false,
      }}
      leagues={leagues.map((m: any) => ({
        id: m.league.id,
        name: m.league.name,
        tournamentId: m.league.tournamentId,
        memberCount: m.league._count?.members || 0,
      }))}
      entries={entries.map((e: any) => ({
        id: e.id,
        name: e.name,
        tournamentId: e.tournamentId,
        score: e.score || 0,
      }))}
    />
  )
}
