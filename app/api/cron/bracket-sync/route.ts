import { NextResponse } from "next/server"
import { runBracketSync } from "@/lib/bracket-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function requireCron(req: Request): boolean {
  const provided =
    req.headers.get("x-cron-secret") ?? req.headers.get("x-admin-secret") ?? ""
  const cronSecret = process.env.BRACKET_CRON_SECRET
  const adminSecret =
    process.env.BRACKET_ADMIN_SECRET || process.env.ADMIN_PASSWORD
  return !!(
    provided &&
    ((cronSecret && provided === cronSecret) ||
      (adminSecret && provided === adminSecret))
  )
}

export async function POST(req: Request) {
  if (!requireCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const seasonParam = url.searchParams.get("season")
  let season: number

  if (seasonParam) {
    season = parseInt(seasonParam, 10)
    if (isNaN(season)) {
      return NextResponse.json(
        { error: "Invalid season parameter" },
        { status: 400 }
      )
    }
  } else {
    const now = new Date()
    season = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear()
  }

  try {
    const result = await runBracketSync(season)
    const status = result.ok ? 200 : 409
    return NextResponse.json(result, { status })
  } catch (err: any) {
    console.error("[BracketCronSync] Error:", err)
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
