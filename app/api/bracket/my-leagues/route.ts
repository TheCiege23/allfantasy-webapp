import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ leagues: [] })
  }

  const memberships = await (prisma as any).bracketLeagueMember.findMany({
    where: { userId: session.user.id },
    select: {
      league: {
        select: {
          id: true,
          name: true,
          joinCode: true,
          tournamentId: true,
          _count: {
            select: {
              members: true,
              entries: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const leagues = memberships.map((m: any) => m.league)

  return NextResponse.json({ leagues })
}
