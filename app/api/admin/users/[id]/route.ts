import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const runtime = "nodejs"

const RELATED_TABLES = [
  "passwordResetToken",
  "emailVerifyToken",
  "bracketEntry",
  "bracketLeagueMember",
  "bracketPayment",
  "bracketRiskProfile",
  "bracketLeagueMessage",
  "bracketMessageReaction",
  "authSession",
  "authAccount",
  "userEvent",
  "analyticsEvent",
  "apiUsageEvent",
  "aIUserFeedback",
  "aIUserProfile",
  "aIMemoryEvent",
  "chatConversation",
  "decisionLog",
  "insightEvent",
  "tradeNotification",
  "tradeShare",
  "tradeFeedback",
  "tradeProfile",
  "tradeSuggestionVote",
  "simulationRun",
  "mockDraft",
  "userProfile",
]

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  const userId = params.id
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 })
  }

  try {
    const user = await (prisma as any).appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    await (prisma as any).$transaction(async (tx: any) => {
      for (const table of RELATED_TABLES) {
        if (tx[table]?.deleteMany) {
          await tx[table].deleteMany({ where: { userId } }).catch(() => {})
        }
      }
      await tx.appUser.delete({ where: { id: userId } })
    }, { timeout: 30000 })

    return NextResponse.json({
      ok: true,
      message: `Deleted user ${user.email || user.username} (${userId})`,
    })
  } catch (err: any) {
    console.error("[admin/users/delete] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to delete user" }, { status: 500 })
  }
}
