import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const GET = withApiUsage({ endpoint: "/api/admin/usage", tool: "AdminUsage" })(async (req: Request) => {
  const url = new URL(req.url)

  const bucketType = String(url.searchParams.get("bucketType") ?? "day")
  const scope = url.searchParams.get("scope") ? String(url.searchParams.get("scope")) : undefined
  const endpoint = url.searchParams.get("endpoint") ? String(url.searchParams.get("endpoint")) : undefined
  const tool = url.searchParams.get("tool") ? String(url.searchParams.get("tool")) : undefined
  const leagueId = url.searchParams.get("leagueId") ? String(url.searchParams.get("leagueId")) : undefined

  const days = Number(url.searchParams.get("days") ?? 30)
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const rows = await prisma.apiUsageRollup.findMany({
    where: {
      bucketType,
      bucketStart: { gte: since },
      ...(scope ? { scope } : {}),
      ...(endpoint ? { endpoint } : {}),
      ...(tool ? { tool } : {}),
      ...(leagueId ? { leagueId } : {})
    },
    orderBy: [{ bucketStart: "asc" }]
  })

  return NextResponse.json({ bucketType, days, rows })
})
