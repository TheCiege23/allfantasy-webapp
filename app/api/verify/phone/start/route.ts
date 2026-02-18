import { NextResponse } from "next/server"
import { getSessionAndProfile } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const { userId, profile } = await getSessionAndProfile()
  if (!userId) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })

  const ip = getClientIp(req)
  const rl = rateLimit(`phone-start:${userId}:${ip}`, 3, 120_000)
  if (!rl.success) {
    return NextResponse.json({ error: "RATE_LIMITED", message: "Please wait before requesting another code." }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  let phone = String(body?.phone || profile?.phone || "").trim()
  if (!phone) return NextResponse.json({ error: "MISSING_PHONE" }, { status: 400 })

  phone = phone.replace(/[\s()-]/g, "")
  if (!phone.startsWith("+")) phone = "+1" + phone
  if (!/^\+\d{10,15}$/.test(phone)) {
    return NextResponse.json({ error: "INVALID_PHONE", message: "Please enter a valid phone number with country code." }, { status: 400 })
  }

  await (prisma as any).userProfile.update({
    where: { userId },
    data: { phone },
  }).catch(() => null)

  try {
    const { getTwilioClient } = await import("@/lib/twilio-client")
    const client = await getTwilioClient()

    const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID
    if (!verifySid) {
      return NextResponse.json({ error: "PHONE_VERIFY_NOT_CONFIGURED" }, { status: 500 })
    }

    await client.verify.v2.services(verifySid).verifications.create({
      to: phone,
      channel: "sms",
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[phone/start] error:", err?.message || err)
    return NextResponse.json({ error: "SEND_FAILED", message: "Failed to send verification code." }, { status: 500 })
  }
}
