import { readFile } from 'fs/promises'
import { join } from 'path'

export interface CompositeWeightProfile {
  win: number
  power: number
  luck: number
  market: number
  skill: number
  draftGain: number
  futureCapital: number
}

export interface CompositeWeightConfig {
  version: string
  calibratedAt: string
  profiles: {
    inseason: { redraft: CompositeWeightProfile; dynasty: CompositeWeightProfile }
    offseason: { redraft: CompositeWeightProfile; dynasty: CompositeWeightProfile }
    postDraft: { redraft: CompositeWeightProfile; dynasty: CompositeWeightProfile }
    postSeason: { redraft: CompositeWeightProfile; dynasty: CompositeWeightProfile }
  }
}

const DEFAULT_WEIGHTS: CompositeWeightConfig = {
  version: '1.0.0',
  calibratedAt: '2025-01-01T00:00:00Z',
  profiles: {
    inseason: {
      redraft: { win: 0.30, power: 0.45, luck: 0.15, market: 0.00, skill: 0.10, draftGain: 0.00, futureCapital: 0.00 },
      dynasty: { win: 0.20, power: 0.30, luck: 0.08, market: 0.17, skill: 0.15, draftGain: 0.00, futureCapital: 0.10 },
    },
    offseason: {
      redraft: { win: 0.10, power: 0.50, luck: 0.00, market: 0.20, skill: 0.20, draftGain: 0.00, futureCapital: 0.00 },
      dynasty: { win: 0.00, power: 0.25, luck: 0.10, market: 0.45, skill: 0.10, draftGain: 0.00, futureCapital: 0.10 },
    },
    postDraft: {
      redraft: { win: 0.00, power: 0.55, luck: 0.00, market: 0.10, skill: 0.15, draftGain: 0.20, futureCapital: 0.00 },
      dynasty: { win: 0.00, power: 0.25, luck: 0.00, market: 0.35, skill: 0.15, draftGain: 0.15, futureCapital: 0.10 },
    },
    postSeason: {
      redraft: { win: 0.55, power: 0.20, luck: 0.00, market: 0.15, skill: 0.10, draftGain: 0.00, futureCapital: 0.00 },
      dynasty: { win: 0.50, power: 0.20, luck: 0.00, market: 0.10, skill: 0.10, draftGain: 0.00, futureCapital: 0.10 },
    },
  },
}

let cachedConfig: CompositeWeightConfig | null = null
let cacheTimestamp = 0
const CACHE_TTL = 10 * 60 * 1000

export async function getCompositeWeightConfig(): Promise<CompositeWeightConfig> {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedConfig
  }

  try {
    const configPath = join(process.cwd(), 'data', 'composite-weights.json')
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as CompositeWeightConfig
    if (parsed?.version && parsed?.profiles) {
      cachedConfig = parsed
      cacheTimestamp = Date.now()
      return cachedConfig
    }
  } catch {}

  cachedConfig = DEFAULT_WEIGHTS
  cacheTimestamp = Date.now()
  return cachedConfig
}

export function resolveWeightProfile(
  config: CompositeWeightConfig,
  phase: string,
  isDynasty: boolean,
): CompositeWeightProfile {
  let phaseKey: keyof typeof config.profiles
  switch (phase) {
    case 'offseason': phaseKey = 'offseason'; break
    case 'post_draft': phaseKey = 'postDraft'; break
    case 'post_season': phaseKey = 'postSeason'; break
    default: phaseKey = 'inseason'
  }
  const phaseProfiles = config.profiles[phaseKey]
  return isDynasty ? phaseProfiles.dynasty : phaseProfiles.redraft
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function computeCompositeFromWeights(
  ws: number,
  ps: number,
  ls: number,
  mvs: number,
  mss: number,
  draftGainP: number,
  phase: string,
  isDynasty: boolean,
  futureCapitalScore: number,
  weightProfile: CompositeWeightProfile,
): number {
  const w = ws / 100
  const p = ps / 100
  const m = mvs / 100
  const s = mss / 100
  const dg = draftGainP / 100
  const fc = futureCapitalScore / 100

  const luckTerm = 1 - Math.abs((ls / 100) - 0.5) * 2

  const raw =
    weightProfile.win * w +
    weightProfile.power * p +
    weightProfile.luck * luckTerm +
    weightProfile.market * m +
    weightProfile.skill * s +
    weightProfile.draftGain * dg +
    weightProfile.futureCapital * fc

  return Math.round(100 * clamp01(raw))
}

export function clearWeightCache(): void {
  cachedConfig = null
  cacheTimestamp = 0
}

export { DEFAULT_WEIGHTS }
