import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: { leagueId: string } }
) {
  try {
    const { leagueId } = params

    const entries = await prisma.bracketEntry.findMany({
      where: { leagueId },
      select: {
        id: true,
        name: true,
        user: { select: { name: true, email: true } },
      },
    })

    const sums = await prisma.bracketPick.groupBy({
      by: ["entryId"],
      where: { entryId: { in: entries.map((e) => e.id) } },
      _sum: { points: true },
    })

    const scoreByEntry = new Map(
      sums.map((s) => [s.entryId, s._sum.points ?? 0])
    )

    const standings = entries
      .map((e) => ({
        entryId: e.id,
        entryName: e.name,
        ownerName: e.user?.name ?? e.user?.email ?? "Unknown",
        points: scoreByEntry.get(e.id) ?? 0,
      }))
      .sort((a, b) => b.points - a.points)

    return NextResponse.json({ leagueId, standings })
  } catch (err) {
    console.error("[bracket/standings] Error:", err)
    return NextResponse.json(
      { error: "Failed to fetch standings" },
      { status: 500 }
    )
  }
}
