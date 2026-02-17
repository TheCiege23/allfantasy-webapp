import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export const GET = withApiUsage({ endpoint: "/api/admin/analytics/stickiness", tool: "AdminStickiness" })(async (request: NextRequest) => {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, Number(searchParams.get("days") || "7")))
    const eventFilter = (searchParams.get("event") || "").trim()

    const eventCondition = eventFilter
      ? `AND "eventType" = $2`
      : ""

    const params: (string | number)[] = [days]
    if (eventFilter) params.push(eventFilter)

    const perUserRows = await prisma.$queryRawUnsafe<{
      user_id: string
      username: string
      display_name: string | null
      uses: bigint
      distinct_days: bigint
      first_use: Date
      last_use: Date
    }[]>(`
      SELECT
        e."userId" AS user_id,
        u."sleeperUsername" AS username,
        u."displayName" AS display_name,
        COUNT(*) AS uses,
        COUNT(DISTINCT e."createdAt"::date) AS distinct_days,
        MIN(e."createdAt") AS first_use,
        MAX(e."createdAt") AS last_use
      FROM "UserEvent" e
      JOIN "LegacyUser" u ON u.id = e."userId"
      WHERE e."createdAt" >= NOW() - ($1 || ' days')::interval
      ${eventCondition}
      GROUP BY e."userId", u."sleeperUsername", u."displayName"
      ORDER BY uses DESC
    `, ...params)

    const users = perUserRows.map((r) => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      uses: Number(r.uses),
      distinctDays: Number(r.distinct_days),
      firstUse: r.first_use.toISOString(),
      lastUse: r.last_use.toISOString(),
    }))

    const totalUses = users.reduce((s, u) => s + u.uses, 0)
    const totalUsers = users.length
    const avgUsesPerUser = totalUsers > 0 ? Math.round((totalUses / totalUsers) * 10) / 10 : 0

    const powerUsers = users.filter((u) => u.uses >= 5)
    const regularUsers = users.filter((u) => u.uses >= 2 && u.uses < 5)
    const oneAndDone = users.filter((u) => u.uses === 1)

    const eventTypeBreakdown = await prisma.$queryRawUnsafe<{
      event_type: string
      cnt: bigint
      unique_users: bigint
    }[]>(`
      SELECT
        "eventType" AS event_type,
        COUNT(*) AS cnt,
        COUNT(DISTINCT "userId") AS unique_users
      FROM "UserEvent"
      WHERE "createdAt" >= NOW() - ($1 || ' days')::interval
      GROUP BY "eventType"
      ORDER BY cnt DESC
    `, days)

    const dailyActivity = await prisma.$queryRawUnsafe<{
      day: Date
      cnt: bigint
      unique_users: bigint
    }[]>(`
      SELECT
        "createdAt"::date AS day,
        COUNT(*) AS cnt,
        COUNT(DISTINCT "userId") AS unique_users
      FROM "UserEvent"
      WHERE "createdAt" >= NOW() - ($1 || ' days')::interval
      GROUP BY "createdAt"::date
      ORDER BY day ASC
    `, days)

    const toolDistRows = await prisma.$queryRawUnsafe<{
      event_type: string
      bucket: string
      user_count: bigint
    }[]>(`
      WITH per_user AS (
        SELECT "eventType", "userId", COUNT(*) AS uses
        FROM "UserEvent"
        WHERE "createdAt" >= NOW() - ($1 || ' days')::interval
        GROUP BY "eventType", "userId"
      )
      SELECT
        "eventType" AS event_type,
        CASE
          WHEN uses = 1 THEN '1'
          WHEN uses BETWEEN 2 AND 3 THEN '2-3'
          WHEN uses BETWEEN 4 AND 9 THEN '4-9'
          ELSE '10+'
        END AS bucket,
        COUNT(*) AS user_count
      FROM per_user
      GROUP BY "eventType", bucket
      ORDER BY "eventType", bucket
    `, days)

    const toolDistribution: Record<string, { bucket: string; userCount: number }[]> = {}
    for (const r of toolDistRows) {
      if (!toolDistribution[r.event_type]) toolDistribution[r.event_type] = []
      toolDistribution[r.event_type].push({
        bucket: r.bucket,
        userCount: Number(r.user_count),
      })
    }

    const toolRepeatRate: { eventType: string; totalUsers: number; repeatUsers: number; repeatRate: number }[] = []
    for (const [eventType, buckets] of Object.entries(toolDistribution)) {
      const total = buckets.reduce((s, b) => s + b.userCount, 0)
      const oneUse = buckets.find((b) => b.bucket === "1")?.userCount || 0
      const repeat = total - oneUse
      toolRepeatRate.push({
        eventType,
        totalUsers: total,
        repeatUsers: repeat,
        repeatRate: total > 0 ? Math.round((repeat / total) * 1000) / 10 : 0,
      })
    }
    toolRepeatRate.sort((a, b) => b.repeatRate - a.repeatRate)

    return NextResponse.json({
      ok: true,
      days,
      eventFilter: eventFilter || null,
      summary: {
        totalUses,
        totalUsers,
        avgUsesPerUser,
        powerUsers: powerUsers.length,
        regularUsers: regularUsers.length,
        oneAndDone: oneAndDone.length,
      },
      users,
      eventTypeBreakdown: eventTypeBreakdown.map((e) => ({
        eventType: e.event_type,
        count: Number(e.cnt),
        uniqueUsers: Number(e.unique_users),
      })),
      dailyActivity: dailyActivity.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        events: Number(d.cnt),
        uniqueUsers: Number(d.unique_users),
      })),
      toolDistribution,
      toolRepeatRate,
    })
  } catch (err: unknown) {
    console.error("Stickiness API error:", err)
    return NextResponse.json({ error: "Failed to compute stickiness" }, { status: 500 })
  }
})
