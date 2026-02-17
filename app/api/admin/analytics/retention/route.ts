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

    const now = new Date()
    const cohorts: {
      label: string
      from: string
      to: string
      totalUsers: number
      returnedUsers: number
      retentionRate: number
    }[] = []

    for (let i = 0; i < cohortsCount; i++) {
      const cohortEnd = new Date(now)
      cohortEnd.setUTCDate(cohortEnd.getUTCDate() - i * cohortSizeDays)
      cohortEnd.setUTCHours(23, 59, 59, 999)

      const cohortStart = new Date(cohortEnd)
      cohortStart.setUTCDate(cohortStart.getUTCDate() - (cohortSizeDays - 1))
      cohortStart.setUTCHours(0, 0, 0, 0)

      const retentionDeadline = new Date(cohortStart)
      retentionDeadline.setUTCDate(retentionDeadline.getUTCDate() + windowDays)

      const usersInCohort = await prisma.legacyUser.findMany({
        where: {
          createdAt: {
            gte: cohortStart,
            lte: cohortEnd,
          },
        },
        select: { id: true, createdAt: true },
      })

      const totalUsers = usersInCohort.length
      let returnedUsers = 0

      if (totalUsers > 0) {
        const userIds = usersInCohort.map((u) => u.id)

        const returnedResult = await prisma.userEvent.groupBy({
          by: ["userId"],
          where: {
            userId: { in: userIds },
            eventType: "user_login",
            createdAt: {
              gt: cohortStart,
              lte: retentionDeadline,
            },
          },
        })

        returnedUsers = returnedResult.length
      }

      cohorts.push({
        label: `${cohortStart.toISOString().slice(0, 10)} – ${cohortEnd.toISOString().slice(0, 10)}`,
        from: cohortStart.toISOString(),
        to: cohortEnd.toISOString(),
        totalUsers,
        returnedUsers,
        retentionRate: totalUsers > 0 ? Math.round((returnedUsers / totalUsers) * 1000) / 10 : 0,
      })
    }

    const totalUsersAllCohorts = cohorts.reduce((s, c) => s + c.totalUsers, 0)
    const totalReturnedAllCohorts = cohorts.reduce((s, c) => s + c.returnedUsers, 0)
    const overallRetention = totalUsersAllCohorts > 0
      ? Math.round((totalReturnedAllCohorts / totalUsersAllCohorts) * 1000) / 10
      : 0

    const eventBreakdown = await prisma.userEvent.groupBy({
      by: ["eventType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    })

    const totalEvents = await prisma.userEvent.count()
    const uniqueActiveUsers = await prisma.userEvent.groupBy({
      by: ["userId"],
    })

    return NextResponse.json({
      ok: true,
      windowDays,
      cohortSizeDays,
      cohorts: cohorts.reverse(),
      overall: {
        totalUsers: totalUsersAllCohorts,
        returnedUsers: totalReturnedAllCohorts,
        retentionRate: overallRetention,
      },
      activity: {
        totalEvents,
        uniqueActiveUsers: uniqueActiveUsers.length,
        breakdown: eventBreakdown.map((e) => ({
          eventType: e.eventType,
          count: e._count.id,
        })),
      },
    })
  } catch (e) {
    console.error("Retention API error:", e)
    return NextResponse.json({ error: "Failed to compute retention" }, { status: 500 })
  }
})
