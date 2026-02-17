import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

export const GET = withApiUsage({ endpoint: "/api/admin/analytics/retention", tool: "AdminRetention" })(async (request: NextRequest) => {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  try {
    const { searchParams } = new URL(request.url)
    const windowDays = Math.min(90, Math.max(1, Number(searchParams.get("window") || "7")))
    const cohortsCount = Math.min(12, Math.max(1, Number(searchParams.get("cohorts") || "8")))
    const cohortSizeDays = Math.min(30, Math.max(1, Number(searchParams.get("cohortSize") || "7")))

    const cohortRows = await prisma.$queryRawUnsafe<{
      cohort_start: Date
      cohort_end: Date
      total_users: bigint
      returned_users: bigint
    }[]>(`
      WITH cohort_bounds AS (
        SELECT
          generate_series(0, $1 - 1) AS idx
      ),
      cohorts AS (
        SELECT
          (CURRENT_DATE - (idx * $2 + $2 - 1) * INTERVAL '1 day')::date AS cohort_start,
          (CURRENT_DATE - idx * $2 * INTERVAL '1 day')::date AS cohort_end
        FROM cohort_bounds
      )
      SELECT
        c.cohort_start,
        c.cohort_end,
        COUNT(DISTINCT u.id) AS total_users,
        COUNT(DISTINCT e."userId") AS returned_users
      FROM cohorts c
      LEFT JOIN "LegacyUser" u
        ON u."createdAt"::date BETWEEN c.cohort_start AND c.cohort_end
      LEFT JOIN "UserEvent" e
        ON e."userId" = u.id
        AND e."eventType" = 'user_login'
        AND e."createdAt" > u."createdAt"
        AND e."createdAt" <= u."createdAt" + ($3 || ' days')::interval
      GROUP BY c.cohort_start, c.cohort_end
      ORDER BY c.cohort_start ASC
    `, cohortsCount, cohortSizeDays, String(windowDays))

    const cohorts = cohortRows.map((r) => {
      const total = Number(r.total_users)
      const returned = Number(r.returned_users)
      return {
        label: `${r.cohort_start.toISOString().slice(0, 10)} – ${r.cohort_end.toISOString().slice(0, 10)}`,
        from: r.cohort_start.toISOString(),
        to: r.cohort_end.toISOString(),
        totalUsers: total,
        returnedUsers: returned,
        retentionRate: total > 0 ? Math.round((returned / total) * 1000) / 10 : 0,
      }
    })

    const totalUsersAll = cohorts.reduce((s, c) => s + c.totalUsers, 0)
    const totalReturnedAll = cohorts.reduce((s, c) => s + c.returnedUsers, 0)

    const [eventBreakdown, summaryRow] = await Promise.all([
      prisma.$queryRawUnsafe<{ event_type: string; cnt: bigint }[]>(`
        SELECT "eventType" AS event_type, COUNT(*) AS cnt
        FROM "UserEvent"
        GROUP BY "eventType"
        ORDER BY cnt DESC
      `),
      prisma.$queryRawUnsafe<{ total_events: bigint; unique_users: bigint }[]>(`
        SELECT
          COUNT(*) AS total_events,
          COUNT(DISTINCT "userId") AS unique_users
        FROM "UserEvent"
      `),
    ])

    const summary = summaryRow[0] || { total_events: BigInt(0), unique_users: BigInt(0) }

    return NextResponse.json({
      ok: true,
      windowDays,
      cohortSizeDays,
      cohorts,
      overall: {
        totalUsers: totalUsersAll,
        returnedUsers: totalReturnedAll,
        retentionRate: totalUsersAll > 0
          ? Math.round((totalReturnedAll / totalUsersAll) * 1000) / 10
          : 0,
      },
      activity: {
        totalEvents: Number(summary.total_events),
        uniqueActiveUsers: Number(summary.unique_users),
        breakdown: eventBreakdown.map((e) => ({
          eventType: e.event_type,
          count: Number(e.cnt),
        })),
      },
    })
  } catch (err: unknown) {
    console.error("Retention API error:", err)
    return NextResponse.json({ error: "Failed to compute retention" }, { status: 500 })
  }
})
