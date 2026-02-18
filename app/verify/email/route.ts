import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getBaseUrl } from "@/lib/get-base-url"
import crypto from "crypto"

export const runtime = "nodejs"

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function redirectTo(path: string) {
  const base = getBaseUrl()
  if (base) return NextResponse.redirect(`${base}${path}`)
  return NextResponse.redirect(path)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return redirectTo("/verify?error=INVALID_LINK")
  }

  const tokenHash = sha256Hex(token)

  const row = await (prisma as any).emailVerifyToken.findUnique({
    where: { tokenHash },
  }).catch(() => null)

  if (!row) {
    return redirectTo("/verify?error=INVALID_LINK")
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await (prisma as any).emailVerifyToken.delete({ where: { tokenHash } }).catch(() => {})
    return redirectTo("/verify?error=EXPIRED_LINK")
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

  return redirectTo("/verify?verified=email")
}
