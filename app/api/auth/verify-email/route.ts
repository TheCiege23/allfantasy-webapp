import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")

  if (!token) {
    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
    return NextResponse.redirect(`${baseUrl}/verify?status=invalid`)
  }

  try {
    const record = await (prisma as any).emailVerificationToken.findUnique({
      where: { token },
    })

    if (!record) {
      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
      return NextResponse.redirect(`${baseUrl}/verify?status=invalid`)
    }

    if (new Date() > record.expiresAt) {
      await (prisma as any).emailVerificationToken.delete({ where: { id: record.id } }).catch(() => {})
      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
      return NextResponse.redirect(`${baseUrl}/verify?status=expired`)
    }

    await (prisma as any).appUser.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    })

    const profile = await (prisma as any).userProfile.findUnique({
      where: { userId: record.userId },
    })
    if (profile) {
      await (prisma as any).userProfile.update({
        where: { userId: record.userId },
        data: {
          emailVerifiedAt: new Date(),
          profileComplete: true,
        },
      })
    }

    await (prisma as any).emailVerificationToken.delete({ where: { id: record.id } }).catch(() => {})

    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
    return NextResponse.redirect(`${baseUrl}/verify?status=success`)
  } catch (err) {
    console.error("[verify-email] error:", err)
    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
    return NextResponse.redirect(`${baseUrl}/verify?status=error`)
  }
}
