import { NextResponse } from "next/server"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { computeHealthScore } from "@/lib/brackets/intelligence/data-engine"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))
  const entryId = String(body.entryId || "")

  if (!entryId) {
    return NextResponse.json({ error: "Missing entryId" }, { status: 400 })
  }

  const entry = await prisma.bracketEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, league: { select: { tournamentId: true } } },
  })

  if (!entry || entry.userId !== auth.userId) {
    return NextResponse.json({ error: "Entry not found or forbidden" }, { status: 403 })
  }

  const health = await computeHealthScore(entryId, entry.league.tournamentId)

  const status = health.alivePct >= 0.7
    ? "healthy"
    : health.alivePct >= 0.4
    ? "wounded"
    : health.alivePct >= 0.2
    ? "critical"
    : "eliminated"

  return NextResponse.json({
    ok: true,
    entryId,
    health: {
      ...health,
      status,
      label: status === "healthy"
        ? "Your bracket is in great shape"
        : status === "wounded"
        ? "Some damage, but still alive"
        : status === "critical"
        ? "Hanging by a thread"
        : "Down but not out — upside remains",
    },
  })
}
