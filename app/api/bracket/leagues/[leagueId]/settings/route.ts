import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { db } from "@/lib/db"
import { bracketLeagues } from "@/lib/schema"
import { eq } from "drizzle-orm"

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

    const [league] = await db
      .select()
      .from(bracketLeagues)
      .where(eq(bracketLeagues.id, leagueId))
      .limit(1)

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
    ]

    const updatedRules = { ...currentRules }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updatedRules[field] = body[field]
      }
    }

    await db
      .update(bracketLeagues)
      .set({ scoringRules: updatedRules })
      .where(eq(bracketLeagues.id, leagueId))

    return NextResponse.json({ ok: true, scoringRules: updatedRules })
  } catch (err: any) {
    console.error("PATCH /api/bracket/leagues/[leagueId]/settings error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
