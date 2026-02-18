import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawToken = searchParams.get("token")
  const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`

  if (!rawToken) {
    return NextResponse.redirect(`${baseUrl}/verify?status=invalid`)
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

  try {
    const record = await (prisma as any).emailVerifyToken.findUnique({
      where: { tokenHash },
    })

    if (!record) {
      return NextResponse.redirect(`${baseUrl}/verify?status=invalid`)
    }

    if (new Date() > record.expiresAt) {
      await (prisma as any).emailVerifyToken.delete({ where: { id: record.id } }).catch(() => {})
      return NextResponse.redirect(`${baseUrl}/verify?status=expired`)
    }

    const now = new Date()

    await (prisma as any).appUser.update({
      where: { id: record.userId },
      data: { emailVerified: now },
    })

    await (prisma as any).userProfile.upsert({
      where: { userId: record.userId },
      update: { emailVerifiedAt: now, profileComplete: true },
      create: { userId: record.userId, emailVerifiedAt: now, profileComplete: true },
    }).catch(() => null)

    await (prisma as any).emailVerifyToken.deleteMany({
      where: { userId: record.userId },
    }).catch(() => {})

    return NextResponse.redirect(`${baseUrl}/verify?status=success`)
  } catch (err) {
    console.error("[verify-email] error:", err)
    return NextResponse.redirect(`${baseUrl}/verify?status=error`)
  }
}
