export interface GuardMeta {
  fallbackMode: boolean
  rankingSource: string
  rankingSourceNote: string
  warnings: string[]
}

export function buildBaselineMeta(
  source: string,
  note: string
): GuardMeta {
  return {
    fallbackMode: true,
    rankingSource: source,
    rankingSourceNote: note,
    warnings: [],
  }
}

export function ensureArray<T>(value: any): T[] {
  return Array.isArray(value) ? value : []
}

export function ensureNumber(value: any, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function ensureObject(value: any): Record<string, any> {
  return value && typeof value === "object" ? value : {}
}

export function safeDivide(a: number, b: number): number {
  if (!b || b === 0) return 0
  return a / b
}
