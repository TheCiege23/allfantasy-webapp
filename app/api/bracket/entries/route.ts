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
  const entriesPerUserFree = Number(rules.entriesPerUserFree ?? 2)
  const maxEntriesPerUser = Number(rules.maxEntriesPerUser ?? 10)
  const isPaidLeague = Boolean(rules.isPaidLeague)
  const commissionerPaymentConfirmedAt = rules.commissionerPaymentConfirmedAt

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

  const needsPayment = count >= entriesPerUserFree
  if (needsPayment && (!isPaidLeague || !commissionerPaymentConfirmedAt)) {
    return NextResponse.json(
      {
        error: "PAYMENT_REQUIRED_FOR_EXTRA_ENTRIES",
        message: "This league allows 2 free entries. Additional entries require commissioner-confirmed FanCred payment.",
      },
      { status: 402 }
    )
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
    freeEntriesRemaining: Math.max(0, entriesPerUserFree - (count + 1)),
  })
}
