import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

function classifySource(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "Direct"

  const utm = String(metadata.utm_source || "").toLowerCase()
  const ref = String(metadata.referrer || "").toLowerCase()

  if (utm === "google" || ref.includes("google.com")) return "Google"
  if (utm === "facebook" || utm === "fb" || utm === "meta" || ref.includes("facebook.com") || ref.includes("fb.com") || ref.includes("instagram.com")) return "Meta"
  if (utm === "twitter" || utm === "x" || ref.includes("twitter.com") || ref.includes("x.com") || ref.includes("t.co")) return "X / Twitter"
  if (utm === "reddit" || ref.includes("reddit.com")) return "Reddit"
  if (utm === "youtube" || ref.includes("youtube.com") || ref.includes("youtu.be")) return "YouTube"
  if (utm === "tiktok" || ref.includes("tiktok.com")) return "TikTok"
  if (utm === "discord" || ref.includes("discord.com") || ref.includes("discord.gg")) return "Discord"
  if (utm === "sleeper" || ref.includes("sleeper.com") || ref.includes("sleeper.app")) return "Sleeper"
  if (utm === "email" || utm === "newsletter") return "Email"

  if (utm && utm !== "null" && utm !== "undefined") return `UTM: ${metadata.utm_source}`
  if (ref && ref !== "null" && ref !== "undefined" && ref.length > 0) {
    try {
      const host = new URL(ref).hostname.replace("www.", "")
      return host || "Referral"
    } catch {
      return "Referral"
    }
  }

  return "Direct"
}

const coreEvents = [
  'trade_analysis_completed',
  'rankings_analysis_completed',
  'waiver_analysis_completed',
  'ai_chat_used',
]

export const GET = withApiUsage({ endpoint: "/api/admin/analytics/source-quality", tool: "AdminSourceQuality" })(async (_request: NextRequest) => {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  try {
    const loginEvents = await prisma.$queryRawUnsafe<{
      userId: string
      metadata: Record<string, unknown> | null
      createdAt: Date
    }[]>(`
      SELECT "userId", metadata, "createdAt"
      FROM "UserEvent"
      WHERE "eventType" = 'user_login'
      ORDER BY "createdAt" ASC
    `)

    const userFirstSource: Record<string, { source: string; firstLogin: Date }> = {}
    for (const ev of loginEvents) {
      if (userFirstSource[ev.userId]) continue
      userFirstSource[ev.userId] = {
        source: classifySource(ev.metadata),
        firstLogin: ev.createdAt,
      }
    }

    const users = await prisma.$queryRawUnsafe<{ id: string; createdAt: Date }[]>(`
      SELECT id, "createdAt" FROM "LegacyUser"
    `)

    for (const u of users) {
      if (!userFirstSource[u.id]) {
        userFirstSource[u.id] = { source: "Direct", firstLogin: u.createdAt }
      }
    }

    const coreList = coreEvents.map(e => `'${e}'`).join(",")
    const coreEventRows = await prisma.$queryRawUnsafe<{
      userId: string
      createdAt: Date
    }[]>(`
      SELECT "userId", "createdAt"
      FROM "UserEvent"
      WHERE "eventType" IN (${coreList})
      ORDER BY "createdAt" ASC
    `)

    const userCoreData: Record<string, { count: number; events: Date[] }> = {}
    for (const ev of coreEventRows) {
      if (!userCoreData[ev.userId]) {
        userCoreData[ev.userId] = { count: 0, events: [] }
      }
      userCoreData[ev.userId].count++
      userCoreData[ev.userId].events.push(ev.createdAt)
    }

    const sourceStats: Record<string, {
      users: number
      activated7d: number
      valueRetained7d: number
      totalCoreEvents: number
    }> = {}

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const oneDayMs = 24 * 60 * 60 * 1000

    for (const [userId, info] of Object.entries(userFirstSource)) {
      const src = info.source
      if (!sourceStats[src]) {
        sourceStats[src] = { users: 0, activated7d: 0, valueRetained7d: 0, totalCoreEvents: 0 }
      }
      sourceStats[src].users++

      const coreData = userCoreData[userId]
      if (coreData) {
        sourceStats[src].totalCoreEvents += coreData.count

        const firstCore = coreData.events[0]
        if (firstCore) {
          const timeDiff = firstCore.getTime() - info.firstLogin.getTime()
          if (timeDiff <= sevenDaysMs) {
            sourceStats[src].activated7d++
          }
        }

        const laterCore = coreData.events.some((d: Date) => {
          const diff = d.getTime() - info.firstLogin.getTime()
          return diff > oneDayMs && diff <= sevenDaysMs
        })
        if (laterCore) {
          sourceStats[src].valueRetained7d++
        }
      }
    }

    const sources = Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        users: stats.users,
        activated7d: stats.activated7d,
        activationRate7d: stats.users > 0 ? Math.round((stats.activated7d / stats.users) * 1000) / 10 : 0,
        valueRetained7d: stats.valueRetained7d,
        valueRetentionRate7d: stats.users > 0 ? Math.round((stats.valueRetained7d / stats.users) * 1000) / 10 : 0,
        avgCoreEvents: stats.users > 0 ? Math.round((stats.totalCoreEvents / stats.users) * 10) / 10 : 0,
        totalCoreEvents: stats.totalCoreEvents,
      }))
      .sort((a, b) => b.users - a.users)

    return NextResponse.json({
      ok: true,
      coreEvents,
      sources,
      totalUsers: Object.keys(userFirstSource).length,
    })
  } catch (err: unknown) {
    console.error("Source quality API error:", err)
    return NextResponse.json({ error: "Failed to compute source quality" }, { status: 500 })
  }
})
