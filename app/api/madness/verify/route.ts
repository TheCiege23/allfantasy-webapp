import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sha256Hex } from "@/lib/tokens"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 })
  }

  const tokenHash = sha256Hex(token)

  const record = await (prisma as any).emailVerifyToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, emailVerified: true } } },
  })

  if (!record) {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 400 })
  }

  if (new Date() > new Date(record.expiresAt)) {
    await (prisma as any).emailVerifyToken.delete({ where: { id: record.id } })
    return NextResponse.json({ success: false, error: "Token expired" }, { status: 400 })
  }

  if (!record.user.emailVerified) {
    await (prisma as any).appUser.update({
      where: { id: record.userId },
      data: { emailVerified: new Date() },
    })
  }

  await (prisma as any).emailVerifyToken.delete({ where: { id: record.id } })

  return NextResponse.json({ success: true })
}
