import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { leagueId, name, picks } = await req.json()

  if (!leagueId || !picks || typeof picks !== "object") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: leagueId },
  })

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 })
  }

  if (league.deadline && new Date() > new Date(league.deadline)) {
    return NextResponse.json({ error: "Deadline has passed" }, { status: 400 })
  }

  const existingCount = await (prisma as any).bracketEntry.count({
    where: { leagueId, userId: session.user.id },
  })

  if (existingCount >= 3) {
    return NextResponse.json({ error: "Maximum 3 brackets per league" }, { status: 400 })
  }

  const entry = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: session.user.id,
      name: name || `Bracket ${existingCount + 1}`,
    },
  })

  const pickEntries = Object.entries(picks)
  if (pickEntries.length > 0) {
    await (prisma as any).bracketPick.createMany({
      data: pickEntries.map(([nodeId, winner]) => ({
        entryId: entry.id,
        nodeId,
        pickedTeamName: winner as string,
      })),
    })
  }

  return NextResponse.json({ entryId: entry.id })
}
