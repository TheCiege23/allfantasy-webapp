import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const leagueId = req.nextUrl.searchParams.get("leagueId")
    if (!leagueId) {
      return NextResponse.json({ error: "Missing leagueId" }, { status: 400 })
    }

    const league = await (prisma as any).bracketLeague.findUnique({
      where: { id: leagueId },
      select: { tournamentId: true, scoringRules: true },
    })

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 })
    }

    const rules = (league.scoringRules || {}) as any

    if (!rules.isPaidLeague) {
      return NextResponse.json({
        isPaidLeague: false,
        hasPaidFirstBracket: true,
        hasUnlimitedUnlock: true,
        bracketCount: 0,
        freeLimit: 3,
      })
    }

    const payments = await (prisma as any).bracketPayment.findMany({
      where: {
        userId: session.user.id,
        leagueId,
        tournamentId: league.tournamentId,
        status: "completed",
      },
      select: { paymentType: true },
    })

    const hasPaidFirstBracket = payments.some((p: any) => p.paymentType === "first_bracket_fee")
    const hasUnlimitedUnlock = payments.some((p: any) => p.paymentType === "unlimited_unlock")

    const bracketCount = await (prisma as any).bracketEntry.count({
      where: { leagueId, userId: session.user.id },
    })

    return NextResponse.json({
      isPaidLeague: true,
      hasPaidFirstBracket,
      hasUnlimitedUnlock,
      bracketCount,
      freeLimit: 3,
    })
  } catch (err: any) {
    console.error("Payment status error:", err)
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 })
  }
}
