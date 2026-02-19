import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  { params }: { params: { entryId: string } }
) {
  try {
    const auth = await requireVerifiedUser()
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { gameId, winnerTeam } = body as {
      gameId: string
      winnerTeam: string
    }

    if (!gameId || !winnerTeam) {
      return NextResponse.json(
        { error: "Missing gameId/winnerTeam" },
        { status: 400 }
      )
    }

    const entry = await prisma.bracketEntry.findUnique({
      where: { id: params.entryId },
      select: {
        id: true,
        userId: true,
        leagueId: true,
        league: {
          select: {
            tournament: { select: { lockAt: true } },
          },
        },
      },
    })
    if (!entry || entry.userId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tournamentLockAt = (entry as any).league?.tournament?.lockAt
    if (tournamentLockAt && new Date(tournamentLockAt) <= new Date()) {
      return NextResponse.json(
        { error: "Picks are locked for the tournament" },
        { status: 409 }
      )
    }

    const game = await (prisma as any).marchMadnessGame.findUnique({
      where: { id: gameId },
    })
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    if (
      winnerTeam !== game.team1 &&
      winnerTeam !== game.team2
    ) {
      return NextResponse.json(
        { error: "Invalid team selection" },
        { status: 400 }
      )
    }

    await (prisma as any).marchMadnessPick.upsert({
      where: {
        bracketId_gameId: { bracketId: entry.id, gameId },
      },
      update: { winnerTeam },
      create: { bracketId: entry.id, gameId, winnerTeam },
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
