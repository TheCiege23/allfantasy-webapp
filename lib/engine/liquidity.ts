export function computeLiquidity(metrics?: {
  tradesLast30?: number
  activeManagers?: number
  totalManagers?: number
  avgAssetsPerTrade?: number
}) {
  if (!metrics) return { score: 50, confidence: 'LEARNING' as const }

  const tradesLast30 = metrics.tradesLast30 ?? 0
  const activeManagers = metrics.activeManagers ?? 0
  const totalManagers = metrics.totalManagers ?? 0
  const avgAssetsPerTrade = metrics.avgAssetsPerTrade ?? 0

  const tradeComponent = Math.min(1, tradesLast30 / 20)
  const participationComponent = totalManagers > 0 ? activeManagers / totalManagers : 0.5
  const sizeComponent = Math.min(1, avgAssetsPerTrade / 5)

  const score = Math.round((tradeComponent * 0.4 + participationComponent * 0.3 + sizeComponent * 0.3) * 100)

  const confidence =
    tradesLast30 >= 10 && totalManagers > 0 ? ('MODERATE' as const) : ('LEARNING' as const)

  return { score: Math.max(0, Math.min(100, score)), confidence }
}
