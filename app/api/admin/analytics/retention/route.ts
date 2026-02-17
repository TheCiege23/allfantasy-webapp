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

    const coreValueEvents = [
      'trade_analysis_completed',
      'rankings_analysis_completed',
      'waiver_analysis_completed',
    ]
    const coreValueList = coreValueEvents.map((e) => `'${e}'`).join(",")

    const [cohortRows, valueCohortRows] = await Promise.all([
      prisma.$queryRawUnsafe<{
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
      `, cohortsCount, cohortSizeDays, String(windowDays)),

      prisma.$queryRawUnsafe<{
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
          AND e."eventType" IN (${coreValueList})
          AND e."createdAt" > u."createdAt"
          AND e."createdAt" <= u."createdAt" + ($3 || ' days')::interval
        GROUP BY c.cohort_start, c.cohort_end
        ORDER BY c.cohort_start ASC
      `, cohortsCount, cohortSizeDays, String(windowDays)),
    ])

    function buildCohorts(rows: typeof cohortRows) {
      return rows.map((r) => {
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
    }

    const cohorts = buildCohorts(cohortRows)
    const valueCohorts = buildCohorts(valueCohortRows)

    const totalUsersAll = cohorts.reduce((s, c) => s + c.totalUsers, 0)
    const totalReturnedAll = cohorts.reduce((s, c) => s + c.returnedUsers, 0)
    const totalValueReturnedAll = valueCohorts.reduce((s, c) => s + c.returnedUsers, 0)

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

    const coreList = coreValueList

    const [activation24h, activation7d, ttfvRows] = await Promise.all([
      prisma.$queryRawUnsafe<{ total_users: bigint; activated_users: bigint }[]>(`
        SELECT
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT e."userId") AS activated_users
        FROM "LegacyUser" u
        LEFT JOIN "UserEvent" e
          ON e."userId" = u.id
          AND e."eventType" IN (${coreList})
          AND e."createdAt" <= u."createdAt" + INTERVAL '24 hours'
      `),
      prisma.$queryRawUnsafe<{ total_users: bigint; activated_users: bigint }[]>(`
        SELECT
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT e."userId") AS activated_users
        FROM "LegacyUser" u
        LEFT JOIN "UserEvent" e
          ON e."userId" = u.id
          AND e."eventType" IN (${coreList})
          AND e."createdAt" <= u."createdAt" + INTERVAL '7 days'
      `),
      prisma.$queryRawUnsafe<{ minutes_to_value: number }[]>(`
        SELECT
          EXTRACT(EPOCH FROM (MIN(e."createdAt") - u."createdAt")) / 60.0 AS minutes_to_value
        FROM "LegacyUser" u
        JOIN "UserEvent" e
          ON e."userId" = u.id
          AND e."eventType" IN (${coreList})
        GROUP BY u.id
        ORDER BY minutes_to_value ASC
      `),
    ])

    const act24 = activation24h[0] || { total_users: BigInt(0), activated_users: BigInt(0) }
    const act7 = activation7d[0] || { total_users: BigInt(0), activated_users: BigInt(0) }

    const total24 = Number(act24.total_users)
    const activated24 = Number(act24.activated_users)
    const total7 = Number(act7.total_users)
    const activated7 = Number(act7.activated_users)

    const [dauRow, wauRow, mauRow] = await Promise.all([
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`
        SELECT COUNT(DISTINCT "userId") AS cnt
        FROM "UserEvent"
        WHERE "createdAt" >= NOW() - INTERVAL '1 day'
      `),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`
        SELECT COUNT(DISTINCT "userId") AS cnt
        FROM "UserEvent"
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      `),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`
        SELECT COUNT(DISTINCT "userId") AS cnt
        FROM "UserEvent"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      `),
    ])

    const dau = Number(dauRow[0]?.cnt ?? 0)
    const wau = Number(wauRow[0]?.cnt ?? 0)
    const mau = Number(mauRow[0]?.cnt ?? 0)

    const ttfvMinutes = ttfvRows.map((r) => r.minutes_to_value).filter((m) => m >= 0)
    const medianTTFV = ttfvMinutes.length > 0
      ? ttfvMinutes[Math.floor(ttfvMinutes.length / 2)]
      : null

    function formatTTFV(minutes: number | null) {
      if (minutes === null) return null
      if (minutes < 1) return "< 1 min"
      if (minutes < 60) return `${Math.round(minutes)} min`
      if (minutes < 1440) return `${Math.round(minutes / 60 * 10) / 10} hrs`
      return `${Math.round(minutes / 1440 * 10) / 10} days`
    }

    const [valueRetention7dRows, depthRows, chatAmplifierRows] = await Promise.all([
      prisma.$queryRawUnsafe<{
        week0_users: bigint
        retained_users: bigint
      }[]>(`
        WITH week0_activated AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '14 days'
            AND e."createdAt" < NOW() - INTERVAL '7 days'
        ),
        week1_active AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '7 days'
        )
        SELECT
          (SELECT COUNT(*) FROM week0_activated) AS week0_users,
          (SELECT COUNT(*) FROM week0_activated w0 INNER JOIN week1_active w1 ON w0."userId" = w1."userId") AS retained_users
      `),

      prisma.$queryRawUnsafe<{
        activated_users: bigint
        avg_runs: number
        multi_tool_users: bigint
        power_users: bigint
      }[]>(`
        WITH activated AS (
          SELECT e."userId", e."eventType", COUNT(*) AS cnt
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY e."userId", e."eventType"
        ),
        user_agg AS (
          SELECT
            "userId",
            SUM(cnt) AS total_runs,
            COUNT(DISTINCT "eventType") AS distinct_tools
          FROM activated
          GROUP BY "userId"
        )
        SELECT
          (SELECT COUNT(*) FROM user_agg) AS activated_users,
          (SELECT COALESCE(AVG(total_runs), 0) FROM user_agg) AS avg_runs,
          (SELECT COUNT(*) FROM user_agg WHERE distinct_tools >= 2) AS multi_tool_users,
          (SELECT COUNT(*) FROM user_agg WHERE total_runs >= 3) AS power_users
      `),

      prisma.$queryRawUnsafe<{
        activated_users: bigint
        chat_users: bigint
        chat_retained: bigint
        no_chat_retained: bigint
        chat_activated: bigint
        no_chat_activated: bigint
      }[]>(`
        WITH activated_30d AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '30 days'
        ),
        chat_in_30d AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" = 'ai_chat_used'
            AND e."createdAt" >= NOW() - INTERVAL '30 days'
        ),
        week0_activated AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '14 days'
            AND e."createdAt" < NOW() - INTERVAL '7 days'
        ),
        week1_active AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${coreList})
            AND e."createdAt" >= NOW() - INTERVAL '7 days'
        ),
        chat_in_week0 AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" = 'ai_chat_used'
            AND e."createdAt" >= NOW() - INTERVAL '14 days'
            AND e."createdAt" < NOW() - INTERVAL '7 days'
        )
        SELECT
          (SELECT COUNT(*) FROM activated_30d) AS activated_users,
          (SELECT COUNT(*) FROM activated_30d a INNER JOIN chat_in_30d c ON a."userId" = c."userId") AS chat_users,
          (SELECT COUNT(*) FROM week0_activated w0 INNER JOIN week1_active w1 ON w0."userId" = w1."userId" INNER JOIN chat_in_week0 c ON w0."userId" = c."userId") AS chat_retained,
          (SELECT COUNT(*) FROM week0_activated w0 INNER JOIN week1_active w1 ON w0."userId" = w1."userId" WHERE w0."userId" NOT IN (SELECT "userId" FROM chat_in_week0)) AS no_chat_retained,
          (SELECT COUNT(*) FROM week0_activated w0 INNER JOIN chat_in_week0 c ON w0."userId" = c."userId") AS chat_activated,
          (SELECT COUNT(*) FROM week0_activated w0 WHERE w0."userId" NOT IN (SELECT "userId" FROM chat_in_week0)) AS no_chat_activated
      `),
    ])

    const vr7 = valueRetention7dRows[0] || { week0_users: BigInt(0), retained_users: BigInt(0) }
    const week0Users = Number(vr7.week0_users)
    const retainedUsers = Number(vr7.retained_users)

    const depth = depthRows[0] || { activated_users: BigInt(0), avg_runs: 0, multi_tool_users: BigInt(0), power_users: BigInt(0) }
    const activatedUsers30d = Number(depth.activated_users)
    const avgRuns = Math.round(Number(depth.avg_runs) * 10) / 10
    const multiToolUsers = Number(depth.multi_tool_users)
    const powerUsers3Plus = Number(depth.power_users)

    const chatAmp = chatAmplifierRows[0] || { activated_users: BigInt(0), chat_users: BigInt(0), chat_retained: BigInt(0), no_chat_retained: BigInt(0), chat_activated: BigInt(0), no_chat_activated: BigInt(0) }
    const chatUsersCount = Number(chatAmp.chat_users)
    const activatedTotal = Number(chatAmp.activated_users)
    const chatRetained = Number(chatAmp.chat_retained)
    const noChatRetained = Number(chatAmp.no_chat_retained)
    const chatActivatedW0 = Number(chatAmp.chat_activated)
    const noChatActivatedW0 = Number(chatAmp.no_chat_activated)
    const chatRetentionRate = chatActivatedW0 > 0 ? Math.round((chatRetained / chatActivatedW0) * 1000) / 10 : 0
    const noChatRetentionRate = noChatActivatedW0 > 0 ? Math.round((noChatRetained / noChatActivatedW0) * 1000) / 10 : 0
    const retentionMultiplier = noChatRetentionRate > 0 ? Math.round((chatRetentionRate / noChatRetentionRate) * 10) / 10 : 0

    const funnelRows = await prisma.$queryRawUnsafe<{
      new_users: bigint
      did_core: bigint
      did_repeat: bigint
      did_breadth: bigint
    }[]>(`
      WITH recent_users AS (
        SELECT id FROM "LegacyUser"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      ),
      user_core AS (
        SELECT e."userId", e."eventType", COUNT(*) AS cnt
        FROM "UserEvent" e
        INNER JOIN recent_users ru ON ru.id = e."userId"
        WHERE e."eventType" IN (${coreList})
        GROUP BY e."userId", e."eventType"
      ),
      user_agg AS (
        SELECT
          "userId",
          COUNT(DISTINCT "eventType") AS distinct_tools,
          MAX(cnt) AS max_single_tool
        FROM user_core
        GROUP BY "userId"
      )
      SELECT
        (SELECT COUNT(*) FROM recent_users) AS new_users,
        (SELECT COUNT(DISTINCT "userId") FROM user_core) AS did_core,
        (SELECT COUNT(*) FROM user_agg WHERE max_single_tool >= 2) AS did_repeat,
        (SELECT COUNT(*) FROM user_agg WHERE distinct_tools >= 2) AS did_breadth
    `)

    const funnel = funnelRows[0] ? {
      newUsers: Number(funnelRows[0].new_users),
      didCore: Number(funnelRows[0].did_core),
      didRepeat: Number(funnelRows[0].did_repeat),
      didBreadth: Number(funnelRows[0].did_breadth),
    } : { newUsers: 0, didCore: 0, didRepeat: 0, didBreadth: 0 }

    return NextResponse.json({
      ok: true,
      windowDays,
      cohortSizeDays,
      cohorts,
      valueCohorts,
      funnel,
      overall: {
        totalUsers: totalUsersAll,
        returnedUsers: totalReturnedAll,
        retentionRate: totalUsersAll > 0
          ? Math.round((totalReturnedAll / totalUsersAll) * 1000) / 10
          : 0,
        valueReturnedUsers: totalValueReturnedAll,
        valueRetentionRate: totalUsersAll > 0
          ? Math.round((totalValueReturnedAll / totalUsersAll) * 1000) / 10
          : 0,
      },
      activation: {
        coreEvents: coreValueEvents,
        rate24h: total24 > 0 ? Math.round((activated24 / total24) * 1000) / 10 : 0,
        rate7d: total7 > 0 ? Math.round((activated7 / total7) * 1000) / 10 : 0,
        activated24h: activated24,
        activated7d: activated7,
        totalUsers: total24,
        timeToFirstValue: {
          medianMinutes: medianTTFV !== null ? Math.round(medianTTFV * 10) / 10 : null,
          medianFormatted: formatTTFV(medianTTFV),
          sampleSize: ttfvMinutes.length,
        },
      },
      stickiness: {
        dau,
        wau,
        mau,
        dauWau: wau > 0 ? Math.round((dau / wau) * 1000) / 10 : 0,
        wauMau: mau > 0 ? Math.round((wau / mau) * 1000) / 10 : 0,
      },
      activity: {
        totalEvents: Number(summary.total_events),
        uniqueActiveUsers: Number(summary.unique_users),
        breakdown: eventBreakdown.map((e) => ({
          eventType: e.event_type,
          count: Number(e.cnt),
        })),
      },
      productHealth: {
        newUsers30d: funnel.newUsers,
        activation24h: { rate: total24 > 0 ? Math.round((activated24 / total24) * 1000) / 10 : 0, activated: activated24, total: total24 },
        activation7d: { rate: total7 > 0 ? Math.round((activated7 / total7) * 1000) / 10 : 0, activated: activated7, total: total7 },
        timeToFirstValue: {
          medianMinutes: medianTTFV !== null ? Math.round(medianTTFV * 10) / 10 : null,
          medianFormatted: formatTTFV(medianTTFV),
          sampleSize: ttfvMinutes.length,
        },
        valueRetention7d: {
          week0Users: week0Users,
          retainedUsers: retainedUsers,
          rate: week0Users > 0 ? Math.round((retainedUsers / week0Users) * 1000) / 10 : 0,
        },
        depthOfEngagement: {
          activatedUsers: activatedUsers30d,
          avgRunsPerUser: avgRuns,
          multiToolPct: activatedUsers30d > 0 ? Math.round((multiToolUsers / activatedUsers30d) * 1000) / 10 : 0,
          multiToolUsers,
          powerUserPct: activatedUsers30d > 0 ? Math.round((powerUsers3Plus / activatedUsers30d) * 1000) / 10 : 0,
          powerUsers: powerUsers3Plus,
        },
        chatAmplifier: {
          chatAdoptionPct: activatedTotal > 0 ? Math.round((chatUsersCount / activatedTotal) * 1000) / 10 : 0,
          chatUsers: chatUsersCount,
          activatedUsers: activatedTotal,
          chatRetentionRate,
          noChatRetentionRate,
          retentionMultiplier,
        },
      },
    })
  } catch (err: unknown) {
    console.error("Retention API error:", err)
    return NextResponse.json({ error: "Failed to compute retention" }, { status: 500 })
  }
})
