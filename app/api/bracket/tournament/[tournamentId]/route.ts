import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const { tournamentId } = params

    const games = await (prisma as any).marchMadnessGame.findMany({
      where: { tournamentId },
      orderBy: [{ round: "asc" }, { gameNumber: "asc" }],
    })

    return NextResponse.json({ games })
  } catch (err) {
    console.error("[bracket/tournament] Error:", err)
    return NextResponse.json(
      { error: "Failed to fetch bracket" },
      { status: 500 }
    )
  }
}
