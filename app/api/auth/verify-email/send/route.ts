import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
  }

  const userId = session.user.id
  const email = session.user.email

  const appUser = await (prisma as any).appUser.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  })

  if (appUser?.emailVerified) {
    return NextResponse.json({ error: "Email is already verified." }, { status: 400 })
  }

  await (prisma as any).emailVerifyToken.deleteMany({
    where: { userId },
  }).catch(() => null)

  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await (prisma as any).emailVerifyToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  try {
    const { getResendClient } = await import("@/lib/resend-client")
    const { client, fromEmail } = await getResendClient()

    const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${rawToken}`

    await client.emails.send({
      from: fromEmail || "AllFantasy.ai <noreply@allfantasy.ai>",
      to: email,
      subject: "Verify your AllFantasy.ai email",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: 700; background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .btn { display: inline-block; background: linear-gradient(90deg, #22d3ee, #a855f7); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;">
      <div class="logo">AllFantasy.ai</div>
      <h2 style="margin:16px 0 8px;color:#f1f5f9;">Verify Your Email</h2>
      <p style="color:#94a3b8;">Click the button below to verify your email address.</p>
      <a href="${verifyUrl}" class="btn">Verify Email</a>
      <p style="color:#64748b;font-size:13px;margin-top:16px;">This link expires in 24 hours.</p>
    </div>
    <div class="footer">
      <p>If you didn't request this, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`,
    })
  } catch (emailErr) {
    console.error("[verify-email/send] Failed to send:", emailErr)
    return NextResponse.json({ error: "Failed to send verification email." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, message: "Verification email sent." })
}
