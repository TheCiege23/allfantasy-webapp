import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required." }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const record = await (prisma as any).passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!record) {
      return NextResponse.json({ error: "Invalid or expired reset link." }, { status: 400 })
    }

    if (new Date() > record.expiresAt) {
      await (prisma as any).passwordResetToken.delete({ where: { id: record.id } }).catch(() => {})
      return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await (prisma as any).appUser.update({
      where: { id: record.userId },
      data: { passwordHash },
    })

    await (prisma as any).passwordResetToken.deleteMany({
      where: { userId: record.userId },
    }).catch(() => {})

    return NextResponse.json({ ok: true, message: "Password has been reset. You can now sign in." })
  } catch (err) {
    console.error("[password-reset/confirm] error:", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
