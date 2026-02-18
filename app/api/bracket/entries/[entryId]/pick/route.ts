import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { nodeId, pickedTeamName } = body as {
      nodeId: string
      pickedTeamName: string
    }

    if (!nodeId || !pickedTeamName) {
      return NextResponse.json(
        { error: "Missing nodeId/pickedTeamName" },
        { status: 400 }
      )
    }

    const entry = await prisma.bracketEntry.findUnique({
      where: { id: params.entryId },
      select: { id: true, userId: true, leagueId: true },
    })
    if (!entry || entry.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const node = await prisma.bracketNode.findUnique({
      where: { id: nodeId },
    })
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 })
    }

    const game = node.sportsGameId
      ? await prisma.sportsGame.findUnique({
          where: { id: node.sportsGameId },
        })
      : null

    const locked = game?.startTime
      ? new Date(game.startTime) <= new Date()
      : false

    if (locked) {
      return NextResponse.json(
        { error: "Picks locked for this game" },
        { status: 409 }
      )
    }

    if (
      pickedTeamName !== node.homeTeamName &&
      pickedTeamName !== node.awayTeamName
    ) {
      return NextResponse.json(
        { error: "Invalid team selection" },
        { status: 400 }
      )
    }

    await prisma.bracketPick.upsert({
      where: {
        entryId_nodeId: { entryId: entry.id, nodeId },
      },
      update: { pickedTeamName, lockedAt: null },
      create: { entryId: entry.id, nodeId, pickedTeamName },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[bracket/pick] Error:", err)
    return NextResponse.json(
      { error: "Failed to save pick" },
      { status: 500 }
    )
  }
}
