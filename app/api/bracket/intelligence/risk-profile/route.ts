import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireVerifiedUser } from "@/lib/auth-guard"
import { DEFAULT_RISK_PROFILE, type RiskProfile } from "@/lib/brackets/intelligence/strategy-engine"

export const runtime = "nodejs"

export async function GET() {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const existing = await prisma.bracketRiskProfile.findUnique({
    where: { userId: auth.userId },
  })

  if (!existing) {
    return NextResponse.json({ ok: true, profile: DEFAULT_RISK_PROFILE })
  }

  return NextResponse.json({
    ok: true,
    profile: {
      riskTolerance: existing.riskTolerance,
      poolCount: existing.poolCount,
      poolSizeEstimate: existing.poolSizeEstimate,
      goal: existing.goal,
    } as RiskProfile,
  })
}

export async function POST(req: Request) {
  const auth = await requireVerifiedUser()
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => ({}))

  const validTolerances = ["conservative", "balanced", "chaos"]
  const validGoals = ["mincash", "win_big"]

  const riskTolerance = validTolerances.includes(body.riskTolerance) ? body.riskTolerance : "balanced"
  const goal = validGoals.includes(body.goal) ? body.goal : "mincash"
  const poolCount = Math.max(1, Math.min(50, Number(body.poolCount) || 1))
  const poolSizeEstimate = Math.max(2, Math.min(10000, Number(body.poolSizeEstimate) || 20))

  const profile = await prisma.bracketRiskProfile.upsert({
    where: { userId: auth.userId },
    update: { riskTolerance, poolCount, poolSizeEstimate, goal },
    create: { userId: auth.userId, riskTolerance, poolCount, poolSizeEstimate, goal },
  })

  return NextResponse.json({
    ok: true,
    profile: {
      riskTolerance: profile.riskTolerance,
      poolCount: profile.poolCount,
      poolSizeEstimate: profile.poolSizeEstimate,
      goal: profile.goal,
    },
  })
}
