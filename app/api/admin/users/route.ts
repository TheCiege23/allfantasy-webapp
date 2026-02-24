import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  try {
    const users = await (prisma as any).appUser.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    const profiles = await (prisma as any).userProfile.findMany({
      select: {
        userId: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        verificationMethod: true,
        profileComplete: true,
        sleeperUsername: true,
      },
    })

    const profileMap = new Map<string, any>()
    for (const p of profiles) {
      profileMap.set(p.userId, p)
    }

    const enriched = users.map((u: any) => {
      const p = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        emailVerified: !!u.emailVerified,
        phoneVerified: !!p?.phoneVerifiedAt,
        verificationMethod: p?.verificationMethod || null,
        profileComplete: !!p?.profileComplete,
        sleeperUsername: p?.sleeperUsername || null,
        createdAt: u.createdAt,
      }
    })

    return NextResponse.json({ ok: true, users: enriched })
  } catch (err: any) {
    console.error("[admin/users] GET error:", err)
    return NextResponse.json({ error: err.message || "Failed to load users" }, { status: 500 })
  }
}
