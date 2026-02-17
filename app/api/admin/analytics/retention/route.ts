import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/adminAuth"

export const dynamic = "force-dynamic"

const CORE_EVENTS = [
  'trade_analysis_completed',
  'rankings_analysis_completed',
  'waiver_analysis_completed',
]
const CORE_LIST = CORE_EVENTS.map((e) => `'${e}'`).join(",")

function formatTTFV(minutes: number | null) {
  if (minutes === null) return null
  if (minutes < 1) return "< 1 min"
  if (minutes < 60) return `${Math.round(minutes)} min`
  if (minutes < 1440) return `${Math.round(minutes / 60 * 10) / 10} hrs`
  return `${Math.round(minutes / 1440 * 10) / 10} days`
}

export const GET = withApiUsage({ endpoint: "/api/admin/analytics/retention", tool: "AdminRetention" })(async (request: NextRequest) => {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.res

  try {
    const { searchParams } = new URL(request.url)
    const windowDays = Math.min(90, Math.max(1, Number(searchParams.get("window") || "7")))
    const cohortsCount = Math.min(12, Math.max(1, Number(searchParams.get("cohorts") || "8")))
    const cohortSizeDays = Math.min(30, Math.max(1, Number(searchParams.get("cohortSize") || "7")))

    const [cohortRows, valueCohortRows] = await Promise.all([
      prisma.$queryRawUnsafe<{
        cohort_start: Date
        cohort_end: Date
        total_users: bigint
        returned_users: bigint
      }[]>(`
        WITH cohort_bounds AS (
          SELECT generate_series(0, $1 - 1) AS idx
        ),
        cohorts AS (
          SELECT
            (CURRENT_DATE - (idx * $2 + $2 - 1) * INTERVAL '1 day')::date AS cohort_start,
            (CURRENT_DATE - idx * $2 * INTERVAL '1 day')::date AS cohort_end
          FROM cohort_bounds
        )
        SELECT
          c.cohort_start, c.cohort_end,
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT e."userId") AS returned_users
        FROM cohorts c
        LEFT JOIN "LegacyUser" u ON u."createdAt"::date BETWEEN c.cohort_start AND c.cohort_end
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
          SELECT generate_series(0, $1 - 1) AS idx
        ),
        cohorts AS (
          SELECT
            (CURRENT_DATE - (idx * $2 + $2 - 1) * INTERVAL '1 day')::date AS cohort_start,
            (CURRENT_DATE - idx * $2 * INTERVAL '1 day')::date AS cohort_end
          FROM cohort_bounds
        )
        SELECT
          c.cohort_start, c.cohort_end,
          COUNT(DISTINCT u.id) AS total_users,
          COUNT(DISTINCT e."userId") AS returned_users
        FROM cohorts c
        LEFT JOIN "LegacyUser" u ON u."createdAt"::date BETWEEN c.cohort_start AND c.cohort_end
        LEFT JOIN "UserEvent" e
          ON e."userId" = u.id
          AND e."eventType" IN (${CORE_LIST})
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
        SELECT COUNT(*) AS total_events, COUNT(DISTINCT "userId") AS unique_users
        FROM "UserEvent"
      `),
    ])

    const summary = summaryRow[0] || { total_events: BigInt(0), unique_users: BigInt(0) }

    const [activationRows, ttfvRows] = await Promise.all([
      prisma.$queryRawUnsafe<{
        cohort_users: bigint
        activated_24h: bigint
        activated_24h_rate_pct: number | null
        activated_7d: bigint
        activated_7d_rate_pct: number | null
      }[]>(`
        WITH cohort AS (
          SELECT u.id, u."createdAt" AS signup_at
          FROM "LegacyUser" u
          WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
        ),
        first_core AS (
          SELECT c.id AS "userId",
                 c.signup_at,
                 MIN(e."createdAt") AS first_core_at
          FROM cohort c
          LEFT JOIN "UserEvent" e
            ON e."userId" = c.id
            AND e."eventType" IN (${CORE_LIST})
          GROUP BY c.id, c.signup_at
        )
        SELECT
          COUNT(*) AS cohort_users,
          COUNT(*) FILTER (WHERE first_core_at IS NOT NULL AND first_core_at <= signup_at + INTERVAL '24 hours') AS activated_24h,
          ROUND(100.0 * COUNT(*) FILTER (WHERE first_core_at IS NOT NULL AND first_core_at <= signup_at + INTERVAL '24 hours') / NULLIF(COUNT(*),0), 1) AS activated_24h_rate_pct,
          COUNT(*) FILTER (WHERE first_core_at IS NOT NULL AND first_core_at <= signup_at + INTERVAL '7 days') AS activated_7d,
          ROUND(100.0 * COUNT(*) FILTER (WHERE first_core_at IS NOT NULL AND first_core_at <= signup_at + INTERVAL '7 days') / NULLIF(COUNT(*),0), 1) AS activated_7d_rate_pct
        FROM first_core
      `),

      prisma.$queryRawUnsafe<{
        median_minutes: number | null
        sample_size: bigint
      }[]>(`
        WITH cohort AS (
          SELECT u.id, u."createdAt" AS signup_at
          FROM "LegacyUser" u
          WHERE u."createdAt" >= NOW() - INTERVAL '30 days'
        ),
        first_core AS (
          SELECT c.id AS "userId",
                 c.signup_at,
                 MIN(e."createdAt") AS first_core_at
          FROM cohort c
          JOIN "UserEvent" e
            ON e."userId" = c.id
            AND e."eventType" IN (${CORE_LIST})
          GROUP BY c.id, c.signup_at
        )
        SELECT
          ROUND(
            percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_core_at - signup_at))) / 60.0, 1
          ) AS median_minutes,
          COUNT(*) AS sample_size
        FROM first_core
      `),
    ])

    const act = activationRows[0] || { cohort_users: BigInt(0), activated_24h: BigInt(0), activated_24h_rate_pct: 0, activated_7d: BigInt(0), activated_7d_rate_pct: 0 }
    const cohortUsers = Number(act.cohort_users)
    const activated24 = Number(act.activated_24h)
    const activated24Rate = Number(act.activated_24h_rate_pct ?? 0)
    const activated7 = Number(act.activated_7d)
    const activated7Rate = Number(act.activated_7d_rate_pct ?? 0)

    const ttfv = ttfvRows[0] || { median_minutes: null, sample_size: BigInt(0) }
    const medianTTFV = ttfv.median_minutes !== null ? Number(ttfv.median_minutes) : null
    const ttfvSampleSize = Number(ttfv.sample_size)

    const [dauRow, wauRow, mauRow] = await Promise.all([
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(DISTINCT "userId") AS cnt FROM "UserEvent" WHERE "createdAt" >= NOW() - INTERVAL '1 day'`),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(DISTINCT "userId") AS cnt FROM "UserEvent" WHERE "createdAt" >= NOW() - INTERVAL '7 days'`),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(`SELECT COUNT(DISTINCT "userId") AS cnt FROM "UserEvent" WHERE "createdAt" >= NOW() - INTERVAL '30 days'`),
    ])

    const dau = Number(dauRow[0]?.cnt ?? 0)
    const wau = Number(wauRow[0]?.cnt ?? 0)
    const mau = Number(mauRow[0]?.cnt ?? 0)

    const [valueRetention7dRows, depthRows, chatAmplifierRows, toolBreakdownRows, oneAndDoneRows] = await Promise.all([
      prisma.$queryRawUnsafe<{
        activated_week0: bigint
        value_retained_7d: bigint
        value_retention_7d_pct: number | null
      }[]>(`
        WITH cohort AS (
          SELECT u.id, u."createdAt" AS signup_at
          FROM "LegacyUser" u
          WHERE u."createdAt" >= NOW() - INTERVAL '60 days'
        ),
        core AS (
          SELECT e."userId", e."createdAt"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${CORE_LIST})
        ),
        flags AS (
          SELECT
            c.id AS "userId",
            BOOL_OR(core."createdAt" >= c.signup_at AND core."createdAt" < c.signup_at + INTERVAL '7 days') AS did_core_week0,
            BOOL_OR(core."createdAt" >= c.signup_at + INTERVAL '7 days' AND core."createdAt" < c.signup_at + INTERVAL '14 days') AS did_core_week1
          FROM cohort c
          LEFT JOIN core ON core."userId" = c.id
          GROUP BY c.id
        )
        SELECT
          COUNT(*) FILTER (WHERE did_core_week0) AS activated_week0,
          COUNT(*) FILTER (WHERE did_core_week0 AND did_core_week1) AS value_retained_7d,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE did_core_week0 AND did_core_week1)
            / NULLIF(COUNT(*) FILTER (WHERE did_core_week0), 0), 1
          ) AS value_retention_7d_pct
        FROM flags
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
          WHERE e."eventType" IN (${CORE_LIST})
            AND e."createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY e."userId", e."eventType"
        ),
        user_agg AS (
          SELECT "userId", SUM(cnt) AS total_runs, COUNT(DISTINCT "eventType") AS distinct_tools
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
        WITH cohort AS (
          SELECT u.id, u."createdAt" AS signup_at
          FROM "LegacyUser" u
          WHERE u."createdAt" >= NOW() - INTERVAL '60 days'
        ),
        activated_30d AS (
          SELECT DISTINCT e."userId"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${CORE_LIST})
            AND e."createdAt" >= NOW() - INTERVAL '30 days'
        ),
        core AS (
          SELECT e."userId", e."createdAt"
          FROM "UserEvent" e
          WHERE e."eventType" IN (${CORE_LIST})
        ),
        chat AS (
          SELECT e."userId", e."createdAt"
          FROM "UserEvent" e
          WHERE e."eventType" = 'ai_chat_used'
        ),
        flags AS (
          SELECT
            c.id AS "userId",
            BOOL_OR(core."createdAt" >= c.signup_at AND core."createdAt" < c.signup_at + INTERVAL '7 days') AS did_core_week0,
            BOOL_OR(core."createdAt" >= c.signup_at + INTERVAL '7 days' AND core."createdAt" < c.signup_at + INTERVAL '14 days') AS did_core_week1,
            BOOL_OR(chat."createdAt" >= c.signup_at AND chat."createdAt" < c.signup_at + INTERVAL '7 days') AS did_chat_week0
          FROM cohort c
          LEFT JOIN core ON core."userId" = c.id
          LEFT JOIN chat ON chat."userId" = c.id
          GROUP BY c.id
        )
        SELECT
          (SELECT COUNT(*) FROM activated_30d) AS activated_users,
          (SELECT COUNT(*) FROM activated_30d a WHERE EXISTS (SELECT 1 FROM "UserEvent" e2 WHERE e2."userId" = a."userId" AND e2."eventType" = 'ai_chat_used' AND e2."createdAt" >= NOW() - INTERVAL '30 days')) AS chat_users,
          COUNT(*) FILTER (WHERE did_core_week0 AND did_core_week1 AND did_chat_week0) AS chat_retained,
          COUNT(*) FILTER (WHERE did_core_week0 AND did_core_week1 AND NOT COALESCE(did_chat_week0, false)) AS no_chat_retained,
          COUNT(*) FILTER (WHERE did_core_week0 AND did_chat_week0) AS chat_activated,
          COUNT(*) FILTER (WHERE did_core_week0 AND NOT COALESCE(did_chat_week0, false)) AS no_chat_activated
        FROM flags
      `),

      prisma.$queryRawUnsafe<{
        event_type: string
        total_uses_7d: bigint
        unique_users_7d: bigint
        users_1x: bigint
        users_2_3x: bigint
        users_4_9x: bigint
        users_10x_plus: bigint
      }[]>(`
        WITH recent AS (
          SELECT e."userId", e."eventType"
          FROM "UserEvent" e
          WHERE e."createdAt" >= NOW() - INTERVAL '7 days'
            AND e."eventType" IN (${CORE_LIST})
        ),
        counts AS (
          SELECT "eventType", "userId", COUNT(*) AS uses
          FROM recent
          GROUP BY "eventType", "userId"
        )
        SELECT
          "eventType" AS event_type,
          SUM(uses) AS total_uses_7d,
          COUNT(*) AS unique_users_7d,
          COUNT(*) FILTER (WHERE uses = 1) AS users_1x,
          COUNT(*) FILTER (WHERE uses BETWEEN 2 AND 3) AS users_2_3x,
          COUNT(*) FILTER (WHERE uses BETWEEN 4 AND 9) AS users_4_9x,
          COUNT(*) FILTER (WHERE uses >= 10) AS users_10x_plus
        FROM counts
        GROUP BY "eventType"
        ORDER BY total_uses_7d DESC
      `),

      prisma.$queryRawUnsafe<{
        user_id: string
        username: string
        display_name: string | null
        signup_at: Date
      }[]>(`
        SELECT
          u.id AS user_id,
          u."sleeperUsername" AS username,
          u."displayName" AS display_name,
          u."createdAt" AS signup_at
        FROM "LegacyUser" u
        WHERE u."createdAt" >= NOW() - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1 FROM "UserEvent" e
            WHERE e."userId" = u.id
              AND e."eventType" IN (${CORE_LIST})
          )
        ORDER BY u."createdAt" DESC
        LIMIT 20
      `),
    ])

    const vr7 = valueRetention7dRows[0] || { activated_week0: BigInt(0), value_retained_7d: BigInt(0), value_retention_7d_pct: 0 }
    const week0Users = Number(vr7.activated_week0)
    const retainedUsers = Number(vr7.value_retained_7d)
    const retentionRate7d = Number(vr7.value_retention_7d_pct ?? 0)

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

    const toolLabels: Record<string, string> = {
      'trade_analysis_completed': 'Trade Analyzer',
      'rankings_analysis_completed': 'Rankings',
      'waiver_analysis_completed': 'Waiver AI',
    }

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
        WHERE e."eventType" IN (${CORE_LIST})
        GROUP BY e."userId", e."eventType"
      ),
      user_agg AS (
        SELECT "userId", COUNT(DISTINCT "eventType") AS distinct_tools, MAX(cnt) AS max_single_tool
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
        retentionRate: totalUsersAll > 0 ? Math.round((totalReturnedAll / totalUsersAll) * 1000) / 10 : 0,
        valueReturnedUsers: totalValueReturnedAll,
        valueRetentionRate: totalUsersAll > 0 ? Math.round((totalValueReturnedAll / totalUsersAll) * 1000) / 10 : 0,
      },
      activation: {
        coreEvents: CORE_EVENTS,
        rate24h: activated24Rate,
        rate7d: activated7Rate,
        activated24h: activated24,
        activated7d: activated7,
        totalUsers: cohortUsers,
        timeToFirstValue: {
          medianMinutes: medianTTFV,
          medianFormatted: formatTTFV(medianTTFV),
          sampleSize: ttfvSampleSize,
        },
      },
      stickiness: {
        dau, wau, mau,
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
        newUsers30d: cohortUsers,
        activation24h: { rate: activated24Rate, activated: activated24, total: cohortUsers },
        activation7d: { rate: activated7Rate, activated: activated7, total: cohortUsers },
        timeToFirstValue: {
          medianMinutes: medianTTFV,
          medianFormatted: formatTTFV(medianTTFV),
          sampleSize: ttfvSampleSize,
        },
        valueRetention7d: {
          week0Users,
          retainedUsers,
          rate: retentionRate7d,
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
        toolBreakdown7d: toolBreakdownRows.map((t) => ({
          tool: toolLabels[t.event_type] || t.event_type,
          eventType: t.event_type,
          totalUses: Number(t.total_uses_7d),
          uniqueUsers: Number(t.unique_users_7d),
          users1x: Number(t.users_1x),
          users2_3x: Number(t.users_2_3x),
          users4_9x: Number(t.users_4_9x),
          users10xPlus: Number(t.users_10x_plus),
        })),
        oneAndDone: oneAndDoneRows.map((u) => ({
          userId: u.user_id,
          username: u.username,
          displayName: u.display_name,
          signupAt: u.signup_at.toISOString(),
        })),
      },
    })
  } catch (err: unknown) {
    console.error("Retention API error:", err)
    return NextResponse.json({ error: "Failed to compute retention" }, { status: 500 })
  }
})
