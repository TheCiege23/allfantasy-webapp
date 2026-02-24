import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sha256Hex } from "@/lib/tokens"

export const runtime = "nodejs"

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

  try {
    await (prisma as any).$transaction(async (tx: any) => {
      await tx.appUser.updateMany({
        where: { id: row.userId },
        data: { emailVerified: now },
      })

      await tx.userProfile.updateMany({
        where: { userId: row.userId },
        data: { emailVerifiedAt: now },
      })

      await tx.emailVerifyToken.delete({
        where: { tokenHash },
      })
    })
  } catch (txErr) {
    console.error("[verify/email] Transaction failed:", txErr)
    return redirectTo(req, "/verify?error=INVALID_LINK")
  }

  return redirectTo(req, "/verify?verified=email")
}
