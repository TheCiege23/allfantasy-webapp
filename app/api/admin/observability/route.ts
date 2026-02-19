import { NextRequest, NextResponse } from "next/server"
import { runObservabilityChecks } from "@/lib/telemetry/observability"
import { cookies } from "next/headers"
import { createHmac } from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function verifyAdmin(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const secret = process.env.ADMIN_SESSION_SECRET
    if (secret && token === secret) return true
  }

  const cookieStore = cookies()
  const sessionCookie = cookieStore.get("admin_session")?.value
  if (sessionCookie) {
    const secret = process.env.ADMIN_SESSION_SECRET
    if (secret) {
      try {
        const [payload, sig] = sessionCookie.split(".")
        const expected = createHmac("sha256", secret).update(payload).digest("hex")
        if (sig === expected) return true
      } catch {}
    }
  }

  return false
}

export async function GET(req: NextRequest) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const alerts = await runObservabilityChecks()
    return NextResponse.json({
      status: alerts.length > 0 ? "alerts_active" : "ok",
      alerts,
      checkedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Observability check failed", detail: e.message?.slice(0, 200) },
      { status: 500 }
    )
  }
}
