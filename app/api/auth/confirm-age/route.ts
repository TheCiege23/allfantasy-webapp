import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
  }

  try {
    await (prisma as any).userProfile.upsert({
      where: { userId: session.user.id },
      update: { ageConfirmedAt: new Date() },
      create: { userId: session.user.id, ageConfirmedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[confirm-age] Error:", err)
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
