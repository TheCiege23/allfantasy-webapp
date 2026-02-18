import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export const runtime = "nodejs"

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/verify?error=MISSING_TOKEN", url.origin))
  }

  const tokenHash = sha256Hex(token)

  const row = await (prisma as any).emailVerifyToken.findUnique({
    where: { tokenHash },
  }).catch(() => null)

  if (!row) {
    return NextResponse.redirect(new URL("/verify?error=INVALID_OR_USED_TOKEN", url.origin))
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await (prisma as any).emailVerifyToken.delete({ where: { tokenHash } }).catch(() => {})
    return NextResponse.redirect(new URL("/verify?error=EXPIRED_TOKEN", url.origin))
  }

  await (prisma as any).appUser.update({
    where: { id: row.userId },
    data: { emailVerified: new Date() },
  }).catch(() => null)

  await (prisma as any).userProfile.updateMany({
    where: { userId: row.userId },
    data: { emailVerifiedAt: new Date() },
  }).catch(() => {})

  await (prisma as any).emailVerifyToken.delete({
    where: { tokenHash },
  }).catch(() => {})

  return NextResponse.redirect(new URL("/verify?verified=email", url.origin))
}
