import { prisma } from "@/lib/prisma"

export async function recordDriftMetrics(args: {
  leagueId?: string | null
  day: Date
  mode: string
  segmentKey?: string
  nOffers?: number
  nLabeled?: number
  nAccepted?: number
  meanPred?: number
  meanObs?: number
  ece?: number | null
  brier?: number | null
  auc?: number | null
  psiJson?: any
  narrativeFailRate?: number | null
}) {
  const normalizedDay = new Date(Date.UTC(
    args.day.getUTCFullYear(),
    args.day.getUTCMonth(),
    args.day.getUTCDate()
  ))

  const segmentKey = args.leagueId
    ? `league:${args.leagueId}`
    : (args.segmentKey ?? "global")

  return prisma.modelMetricsDaily.create({
    data: {
      day: normalizedDay,
      mode: args.mode as any,
      segmentKey,
      nOffers: args.nOffers ?? 0,
      nLabeled: args.nLabeled ?? 0,
      nAccepted: args.nAccepted ?? 0,
      meanPred: args.meanPred ?? 0,
      meanObs: args.meanObs ?? 0,
      ece: args.ece ?? 0,
      brier: args.brier ?? 0,
      auc: args.auc ?? null,
      psiJson: args.psiJson ?? null,
      narrativeFailRate: args.narrativeFailRate ?? 0
    }
  })
}

export async function getDriftSeries(args: {
  leagueId?: string | null
  days?: number
}) {
  const days = args.days ?? 60
  const since = new Date(Date.now() - days * 24 * 3600 * 1000)

  const where: any = { day: { gte: since } }
  if (args.leagueId) {
    where.segmentKey = `league:${args.leagueId}`
  }

  return prisma.modelMetricsDaily.findMany({
    where,
    orderBy: [{ day: "asc" }]
  })
}
