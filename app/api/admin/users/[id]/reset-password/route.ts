import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"
import { sha256Hex, makeToken } from "@/lib/tokens"

export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  const userId = params.id
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 })
  }

  try {
    const user = await (prisma as any).appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.email) {
      return NextResponse.json({ error: "User has no email" }, { status: 400 })
    }

    const rawToken = makeToken(32)
    const tokenHash = sha256Hex(rawToken)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await (prisma as any).passwordResetToken.deleteMany({
      where: { userId: user.id },
    }).catch(() => {})

    await (prisma as any).passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    })

    const { getBaseUrl } = await import("@/lib/get-base-url")
    const baseUrl = getBaseUrl()
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`

    const { getResendClient } = await import("@/lib/resend-client")
    const { client, fromEmail } = await getResendClient()

    await client.emails.send({
      from: fromEmail || "AllFantasy.ai <noreply@allfantasy.ai>",
      to: user.email,
      subject: "Reset your AllFantasy.ai password",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 520px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 32px; border: 1px solid #334155; }
    .logo { font-size: 24px; font-weight: 700; background: linear-gradient(90deg, #22d3ee, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .btn { display: inline-block; background: linear-gradient(90deg, #22d3ee, #a855f7); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; margin-top: 20px; }
    .muted { color:#94a3b8; }
    .footer { text-align:center; margin-top: 24px; font-size: 12px; color:#64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;">
      <div class="logo">AllFantasy.ai</div>
      <h2 style="margin:16px 0 8px;color:#f1f5f9;">Reset your password</h2>
      <p class="muted">An admin has sent you a password reset link. Click the button below to set a new password.</p>
      <a href="${resetUrl}" class="btn">Reset Password</a>
      <p class="muted" style="font-size:13px;margin-top:16px;">This link expires in 1 hour.</p>
    </div>
    <div class="footer">
      <p>If you didn't expect this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
    })

    return NextResponse.json({ ok: true, message: `Reset link sent to ${user.email}` })
  } catch (err: any) {
    console.error("[admin/users/reset-password] Error:", err)
    return NextResponse.json({ error: err.message || "Failed to send reset link" }, { status: 500 })
  }
}
