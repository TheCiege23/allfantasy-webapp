import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { email, displayName, phone } = body as {
    email?: string
    displayName?: string
    phone?: string
  }

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
  }

  await (prisma as any).pendingSignup.upsert({
    where: { email: normalizedEmail },
    update: { displayName: displayName?.trim() || null, phone: phone?.trim() || null },
    create: { email: normalizedEmail, displayName: displayName?.trim() || null, phone: phone?.trim() || null },
  })

  return NextResponse.json({ ok: true })
}
