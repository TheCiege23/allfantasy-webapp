import { NextRequest, NextResponse } from "next/server"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({} as any))
  const { entryId } = body

  if (!entryId) {
    return NextResponse.json({ error: "MISSING_ENTRY_ID" }, { status: 400 })
  }

  const source = await prisma.bracketEntry.findUnique({
    where: { id: entryId },
    include: {
      picks: true,
      league: {
        select: {
          id: true,
          tournamentId: true,
          scoringRules: true,
        },
      },
    },
  })

  if (!source) {
    return NextResponse.json({ error: "ENTRY_NOT_FOUND" }, { status: 404 })
  }

  if (source.userId !== auth.userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
  }

  const rules = (source.league.scoringRules || {}) as any

  if (rules.allowCopyBracket === false) {
    return NextResponse.json(
      { error: "COPY_DISABLED", message: "Bracket copying is disabled for this league." },
      { status: 403 }
    )
  }

  const maxEntries = Number(rules.maxEntriesPerUser ?? 10)

  const currentCount = await prisma.bracketEntry.count({
    where: { leagueId: source.leagueId, userId: auth.userId },
  })

  if (currentCount >= maxEntries) {
    return NextResponse.json(
      { error: "ENTRY_LIMIT_REACHED", message: `Maximum ${maxEntries} entries per league.` },
      { status: 409 }
    )
  }

  const isPaidLeague = Boolean(rules.isPaidLeague)
  if (isPaidLeague) {
    const payments = await (prisma as any).bracketPayment.findMany({
      where: {
        userId: auth.userId,
        leagueId: source.leagueId,
        tournamentId: source.league.tournamentId,
        status: "completed",
      },
      select: { paymentType: true },
    })

    const hasPaidFirst = payments.some((p: any) => p.paymentType === "first_bracket_fee")
    const hasUnlimited = payments.some((p: any) => p.paymentType === "unlimited_unlock")

    if (!hasPaidFirst) {
      return NextResponse.json(
        { error: "PAYMENT_REQUIRED", paymentType: "first_bracket_fee" },
        { status: 402 }
      )
    }
    if (currentCount >= 3 && !hasUnlimited) {
      return NextResponse.json(
        { error: "PAYMENT_REQUIRED", paymentType: "unlimited_unlock" },
        { status: 402 }
      )
    }
  }

  const tournament = await prisma.bracketTournament.findUnique({
    where: { id: source.league.tournamentId },
    select: { lockAt: true },
  })

  if (tournament?.lockAt && new Date(tournament.lockAt) <= new Date()) {
    return NextResponse.json(
      { error: "BRACKET_LOCKED", message: "Tournament brackets are locked. Cannot copy." },
      { status: 403 }
    )
  }

  const newEntry = await prisma.bracketEntry.create({
    data: {
      leagueId: source.leagueId,
      userId: auth.userId,
      name: `${source.name} (Copy)`,
    },
  })

  if (source.picks.length > 0) {
    await prisma.bracketPick.createMany({
      data: source.picks.map((p) => ({
        entryId: newEntry.id,
        nodeId: p.nodeId,
        pickedTeamName: p.pickedTeamName,
      })),
    })
  }

  return NextResponse.json({
    ok: true,
    entryId: newEntry.id,
    name: newEntry.name,
    picksCount: source.picks.length,
  })
}
