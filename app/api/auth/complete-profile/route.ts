import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { displayName, phone } = body as {
    displayName?: string
    phone?: string
  }

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 })
  }

  const userId = session.user.id
  const email = session.user.email

  const existingProfile = await (prisma as any).userProfile.findUnique({
    where: { userId },
  }).catch(() => null)

  const isVerified = !!existingProfile?.emailVerifiedAt || !!existingProfile?.phoneVerifiedAt
  if (!isVerified) {
    return NextResponse.json({ error: "VERIFICATION_REQUIRED" }, { status: 403 })
  }

  await (prisma as any).userProfile.upsert({
    where: { userId },
    update: {
      displayName: displayName.trim(),
      phone: phone?.trim() || null,
      profileComplete: true,
    },
    create: {
      userId,
      displayName: displayName.trim(),
      phone: phone?.trim() || null,
      profileComplete: true,
    },
  })

  await (prisma as any).appUser.update({
    where: { id: userId },
    data: { displayName: displayName.trim() },
  }).catch(() => {})

  if (email) {
    await (prisma as any).pendingSignup.delete({
      where: { email },
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
