import { NextRequest, NextResponse } from "next/server"
import { runBracketSync } from "@/lib/bracket-sync"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authenticate(request: NextRequest): boolean {
  const headerSecret =
    request.headers.get("x-cron-secret") ||
    request.headers.get("x-admin-secret")
  const cronSecret = process.env.BRACKET_CRON_SECRET
  const adminSecret = process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!(headerSecret && (
    (cronSecret && headerSecret === cronSecret) ||
    (adminSecret && headerSecret === adminSecret)
  ))
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticate(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const seasonParam = request.nextUrl.searchParams.get("season")
    let season: number

    if (seasonParam) {
      season = parseInt(seasonParam, 10)
      if (isNaN(season)) {
        return NextResponse.json({ error: "Invalid season parameter" }, { status: 400 })
      }
    } else {
      const now = new Date()
      season = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
    }

    const result = await runBracketSync(season)

    return NextResponse.json({
      ok: true,
      season,
      ...result,
    })
  } catch (err: any) {
    console.error("[BracketCronSync] Error:", err)
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 })
  }
}
