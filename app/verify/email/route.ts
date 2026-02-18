import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export const runtime = "nodejs"

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function redirectTo(req: Request, path: string) {
  const origin = new URL(req.url).origin
  return NextResponse.redirect(new URL(path, origin))
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) return redirectTo(req, "/verify?error=INVALID_LINK")

  const tokenHash = sha256Hex(token)

  const row = await (prisma as any).emailVerifyToken.findUnique({
    where: { tokenHash },
  }).catch(() => null)

  if (!row) return redirectTo(req, "/verify?error=INVALID_LINK")

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await (prisma as any).emailVerifyToken.delete({ where: { tokenHash } }).catch(() => {})
    return redirectTo(req, "/verify?error=EXPIRED_LINK")
  }

  const now = new Date()

  await (prisma as any).appUser.updateMany({
    where: { id: row.userId },
    data: { emailVerified: now },
  })

  await (prisma as any).userProfile.updateMany({
    where: { userId: row.userId },
    data: { emailVerifiedAt: now },
  }).catch(() => {})

  await (prisma as any).emailVerifyToken.delete({
    where: { tokenHash },
  }).catch(() => {})

  return redirectTo(req, "/verify?verified=email")
}
