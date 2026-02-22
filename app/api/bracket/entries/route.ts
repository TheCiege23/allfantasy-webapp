import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const leagueId = String(body?.leagueId || "")
  const name = String(body?.name || "").trim()

  if (!leagueId) {
    return NextResponse.json({ error: "MISSING_LEAGUE_ID" }, { status: 400 })
  }

  if (!name) {
    return NextResponse.json({ error: "MISSING_NAME" }, { status: 400 })
  }

  const member = await (prisma as any).bracketLeagueMember.findUnique({
    where: {
      leagueId_userId: { leagueId, userId: auth.userId },
    },
    select: { leagueId: true },
  }).catch(() => null)

  if (!member) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const league = await (prisma as any).bracketLeague.findUnique({
    where: { id: leagueId },
    select: {
      tournamentId: true,
      scoringRules: true,
      ownerId: true,
    },
  })

  if (!league) {
    return NextResponse.json({ error: "LEAGUE_NOT_FOUND" }, { status: 404 })
  }

  const rules = (league.scoringRules || {}) as any
  const isPaidLeague = Boolean(rules.isPaidLeague)
  const maxEntriesPerUser = Number(rules.maxEntriesPerUser ?? 10)

  const count = await (prisma as any).bracketEntry.count({
    where: { leagueId, userId: auth.userId },
  })

  if (count >= maxEntriesPerUser) {
    return NextResponse.json(
      {
        error: "ENTRY_LIMIT_REACHED",
        message: `You have reached the maximum of ${maxEntriesPerUser} entries in this league.`,
      },
      { status: 409 }
    )
  }

  if (isPaidLeague) {
    const payments = await (prisma as any).bracketPayment.findMany({
      where: {
        userId: auth.userId,
        leagueId,
        tournamentId: league.tournamentId,
        status: "completed",
      },
      select: { paymentType: true },
    })

    const hasPaidFirstBracket = payments.some((p: any) => p.paymentType === "first_bracket_fee")
    const hasUnlimitedUnlock = payments.some((p: any) => p.paymentType === "unlimited_unlock")

    if (count === 0 && !hasPaidFirstBracket) {
      return NextResponse.json(
        {
          error: "PAYMENT_REQUIRED",
          paymentType: "first_bracket_fee",
          message: "A $2 hosting fee is required to create your first bracket in this paid league.",
        },
        { status: 402 }
      )
    }

    if (count >= 3 && !hasUnlimitedUnlock) {
      return NextResponse.json(
        {
          error: "PAYMENT_REQUIRED",
          paymentType: "unlimited_unlock",
          message: "You've used your 3 included brackets. Unlock unlimited brackets for $3.",
        },
        { status: 402 }
      )
    }
  }

  const entry = await (prisma as any).bracketEntry.create({
    data: {
      leagueId,
      userId: auth.userId,
      name,
    },
    select: { id: true },
  })

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    tournamentId: league.tournamentId,
    entryCountForUser: count + 1,
  })
}
