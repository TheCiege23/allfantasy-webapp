import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import bcrypt from "bcryptjs"

export const runtime = "nodejs"

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function isStrongPassword(pw: string) {
  if (pw.length < 8) return false
  const hasLetter = /[A-Za-z]/.test(pw)
  const hasNumber = /[0-9]/.test(pw)
  return hasLetter && hasNumber
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = String(body?.token || "")
  const newPassword = String(body?.newPassword || "")

  if (!token || !newPassword) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
  }
  if (!isStrongPassword(newPassword)) {
    return NextResponse.json({ error: "WEAK_PASSWORD" }, { status: 400 })
  }

  const tokenHash = sha256Hex(token)

  const row = await (prisma as any).passwordResetToken.findUnique({
    where: { tokenHash },
  }).catch(() => null)

  if (!row) {
    return NextResponse.json({ error: "INVALID_OR_USED_TOKEN" }, { status: 400 })
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await (prisma as any).passwordResetToken.delete({ where: { tokenHash } }).catch(() => {})
    return NextResponse.json({ error: "EXPIRED_TOKEN" }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await (prisma as any).appUser.update({
    where: { id: row.userId },
    data: { passwordHash },
  })

  await (prisma as any).passwordResetToken.delete({
    where: { tokenHash },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
