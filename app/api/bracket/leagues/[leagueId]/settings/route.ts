import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { leagueId } = params
    const body = await req.json()

    const league = await (prisma as any).bracketLeague.findUnique({
      where: { id: leagueId },
      select: { ownerId: true, scoringRules: true },
    })

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    if (league.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Only the pool owner can update settings" }, { status: 403 })
    }

    const currentRules = (league.scoringRules || {}) as Record<string, any>

    const allowedFields = [
      "scoringMode",
      "entriesPerUserFree",
      "maxEntriesPerUser",
      "isPaidLeague",
      "allowCopyBracket",
      "pickVisibility",
      "insuranceEnabled",
      "insurancePerEntry",
    ]

    const updatedRules = { ...currentRules }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatedRules[field] = body[field]
      }
    }
    if (body.scoringMode) {
      updatedRules.mode = body.scoringMode
    }

    await (prisma as any).bracketLeague.update({
      where: { id: leagueId },
      data: { scoringRules: updatedRules },
    })

    return NextResponse.json({ ok: true, scoringRules: updatedRules })
  } catch (err: any) {
    console.error("PATCH /api/bracket/leagues/[leagueId]/settings error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
