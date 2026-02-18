import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, email, password, displayName, phone, sleeperUsername, ageConfirmed, verificationMethod } = body

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Username, email, and password are required." }, { status: 400 })
    }

    if (!ageConfirmed) {
      return NextResponse.json({ error: "You must confirm you are 18 or older." }, { status: 400 })
    }

    const cleanUsername = username.toLowerCase().trim()
    const cleanEmail = email.toLowerCase().trim()

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return NextResponse.json({ error: "Username must be 3-30 characters." }, { status: 400 })
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    if (!cleanEmail.includes("@")) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 })
    }

    const existingEmail = await (prisma as any).appUser.findUnique({ where: { email: cleanEmail } })
    if (existingEmail) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 })
    }

    const existingUsername = await (prisma as any).appUser.findUnique({ where: { username: cleanUsername } })
    if (existingUsername) {
      return NextResponse.json({ error: "This username is already taken." }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    let sleeperData: { sleeperUsername?: string; sleeperUserId?: string; sleeperLinkedAt?: Date } = {}
    if (sleeperUsername) {
      try {
        const sleeperRes = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(sleeperUsername.trim())}`)
        if (sleeperRes.ok) {
          const sleeperUser = await sleeperRes.json()
          if (sleeperUser && sleeperUser.user_id) {
            sleeperData = {
              sleeperUsername: sleeperUser.username || sleeperUsername.trim(),
              sleeperUserId: sleeperUser.user_id,
              sleeperLinkedAt: new Date(),
            }
          }
        }
      } catch {
      }
    }

    const user = await (prisma as any).appUser.create({
      data: {
        email: cleanEmail,
        username: cleanUsername,
        passwordHash,
        displayName: displayName?.trim() || cleanUsername,
      },
    })

    await (prisma as any).userProfile.create({
      data: {
        userId: user.id,
        displayName: displayName?.trim() || cleanUsername,
        phone: phone?.trim() || null,
        ageConfirmedAt: new Date(),
        verificationMethod: verificationMethod || "email",
        ...sleeperData,
        profileComplete: false,
      },
    })

    const rawToken = crypto.randomBytes(32).toString("base64url")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await (prisma as any).emailVerifyToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    try {
      const { getResendClient } = await import("@/lib/resend-client")
      const { client, fromEmail } = await getResendClient()

      const baseUrl = process.env.NEXTAUTH_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`
      const verifyUrl = `${baseUrl}/verify/email?token=${encodeURIComponent(rawToken)}`

      await client.emails.send({
        from: fromEmail || "AllFantasy.ai <noreply@allfantasy.ai>",
        to: cleanEmail,
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
      <p style="color:#94a3b8;">Welcome, ${displayName?.trim() || cleanUsername}! Click the button below to verify your email address.</p>
      <a href="${verifyUrl}" class="btn">Verify Email</a>
      <p style="color:#64748b;font-size:13px;margin-top:16px;">This link expires in 24 hours.</p>
    </div>
    <div class="footer">
      <p>If you didn't create this account, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (emailErr) {
      console.error("[register] Failed to send verification email:", emailErr)
    }

    return NextResponse.json({
      ok: true,
      userId: user.id,
      message: "Account created. Please check your email to verify.",
    })
  } catch (err: any) {
    console.error("[register] error:", err)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
