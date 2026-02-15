import { prisma } from '@/lib/prisma'
import { getCFBPlayerStats, getCFBTeamRoster, type CFBPlayer, type CFBPlayerStats } from '@/lib/cfb-player-data'
import { computeAllDevyIntelMetrics } from '@/lib/devy-intel'

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateDraftEligibleYear(classYear: number | null): number {
  const currentYear = new Date().getFullYear()
  if (!classYear) return currentYear + 3
  const yearsRemaining = Math.max(0, 4 - classYear)
  return currentYear + yearsRemaining
}

function calculateDevyValueFromStats(
  position: string,
  classYear: number | null,
  projectedRound: number | null,
  stats?: { passingYards?: number; rushingYards?: number; receivingYards?: number; receptions?: number; passingTDs?: number; rushingTDs?: number; receivingTDs?: number }
): number {
  const baseValues: Record<string, number> = { QB: 6000, RB: 4500, WR: 5000, TE: 3500 }
  let value = baseValues[position] || 2000

  const classMultipliers: Record<number, number> = { 1: 1.4, 2: 1.3, 3: 1.1, 4: 1.0, 5: 0.9 }
  value *= classMultipliers[classYear || 4] || 1.0

  if (projectedRound) {
    const roundMults: Record<number, number> = { 1: 1.8, 2: 1.4, 3: 1.1, 4: 0.9, 5: 0.7, 6: 0.5, 7: 0.3 }
    value *= roundMults[projectedRound] || 0.5
  }

  if (stats) {
    if (position === 'QB') {
      value += Math.min((stats.passingYards || 0) / 100, 1500)
      value += (stats.passingTDs || 0) * 30
    }
    if (position === 'RB') {
      value += Math.min((stats.rushingYards || 0) / 50, 1200)
      value += (stats.rushingTDs || 0) * 40
    }
    if (position === 'WR' || position === 'TE') {
      value += Math.min((stats.receivingYards || 0) / 50, 1200)
      value += (stats.receivingTDs || 0) * 40
      value += Math.min((stats.receptions || 0) * 5, 400)
    }
  }

  return Math.round(value)
}

export function computeAvailabilityPct(
  devyValue: number,
  draftEligibleYear: number,
  pickNumber: number,
  totalTeams: number
): number {
  const currentYear = new Date().getFullYear()
  const yearsOut = draftEligibleYear - currentYear
  const pickPosition = pickNumber / totalTeams

  const valuePercentile = Math.min(1, Math.max(0, devyValue / 10000))
  const baseDraftProb = 1 - valuePercentile

  let availability = baseDraftProb * 100

  if (yearsOut >= 2) availability = Math.min(95, availability + 15)
  else if (yearsOut === 1) availability = availability
  else availability = Math.max(5, availability - 20)

  availability *= (0.5 + pickPosition * 0.5)

  return Math.round(Math.min(95, Math.max(5, availability)))
}

export interface DevySyncResult {
  ingested: number
  graduated: number
  classified: number
  errors: string[]
}

const TOP_CFB_TEAMS = [
  'Alabama', 'Ohio State', 'Georgia', 'Texas', 'Michigan', 'USC', 'Oregon',
  'Penn State', 'LSU', 'Clemson', 'Notre Dame', 'Florida State', 'Tennessee',
  'Oklahoma', 'Florida', 'Texas A&M', 'Wisconsin', 'Iowa', 'Miami',
  'Ole Miss', 'Colorado', 'Auburn', 'Nebraska', 'Kentucky', 'Arkansas',
  'North Carolina', 'Missouri', 'Utah', 'Washington', 'UCLA',
  'Oklahoma State', 'Kansas State', 'Baylor', 'Duke', 'Pittsburgh',
  'Louisville', 'Virginia Tech', 'West Virginia', 'South Carolina',
  'Mississippi State', 'Arizona', 'Arizona State', 'Stanford', 'California',
  'TCU', 'SMU', 'BYU', 'Boise State', 'Memphis', 'Tulane',
]

const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE'])

export async function ingestCFBDRosters(season?: number): Promise<{ ingested: number; errors: string[] }> {
  const year = season || new Date().getFullYear()
  let ingested = 0
  const errors: string[] = []

  for (const team of TOP_CFB_TEAMS) {
    try {
      const roster = await getCFBTeamRoster(team, year)
      const fantasyPlayers = roster.filter(p => FANTASY_POSITIONS.has(p.position))

      for (const p of fantasyPlayers) {
        const normalizedName = normalizeName(p.fullName)
        if (!normalizedName || normalizedName.length < 3) continue

        const draftEligibleYear = calculateDraftEligibleYear(p.year)

        try {
          await prisma.devyPlayer.upsert({
            where: {
              uniq_devy_player: {
                normalizedName,
                position: p.position,
                school: team,
              },
            },
            create: {
              name: p.fullName,
              normalizedName,
              position: p.position,
              school: team,
              classYear: p.year,
              heightInches: p.height,
              weightLbs: p.weight,
              cfbdId: p.id ? String(p.id) : null,
              draftEligibleYear,
              league: 'NCAA',
              devyEligible: true,
              graduatedToNFL: false,
              source: 'cfbd',
              lastSyncedAt: new Date(),
            },
            update: {
              classYear: p.year,
              heightInches: p.height,
              weightLbs: p.weight,
              cfbdId: p.id ? String(p.id) : null,
              draftEligibleYear,
              lastSyncedAt: new Date(),
            },
          })
          ingested++
        } catch (dbErr: any) {
          errors.push(`DB upsert failed for ${p.fullName}: ${dbErr.message?.slice(0, 100)}`)
        }
      }

      await new Promise(r => setTimeout(r, 200))
    } catch (err: any) {
      errors.push(`Team ${team} fetch failed: ${err.message?.slice(0, 100)}`)
    }
  }

  return { ingested, errors }
}

export async function ingestCFBDStats(season?: number): Promise<{ updated: number; errors: string[] }> {
  const year = season || new Date().getFullYear() - 1
  let updated = 0
  const errors: string[] = []

  for (const team of TOP_CFB_TEAMS.slice(0, 25)) {
    try {
      const stats = await getCFBPlayerStats(year, team)

      for (const s of stats) {
        if (!s.playerName) continue
        const normalizedName = normalizeName(s.playerName)

        try {
          const existing = await prisma.devyPlayer.findFirst({
            where: { normalizedName, school: team },
          })
          if (!existing) continue

          const devyValue = calculateDevyValueFromStats(
            existing.position,
            existing.classYear,
            existing.draftRound,
            {
              passingYards: s.passingYards,
              passingTDs: s.passingTDs,
              rushingYards: s.rushingYards,
              rushingTDs: s.rushingTDs,
              receivingYards: s.receivingYards,
              receivingTDs: s.receivingTDs,
              receptions: s.receptions,
            }
          )

          await prisma.devyPlayer.update({
            where: { id: existing.id },
            data: {
              passingYards: s.passingYards || null,
              passingTDs: s.passingTDs || null,
              rushingYards: s.rushingYards || null,
              rushingTDs: s.rushingTDs || null,
              receivingYards: s.receivingYards || null,
              receivingTDs: s.receivingTDs || null,
              receptions: s.receptions || null,
              statSeason: year,
              devyValue,
              lastSyncedAt: new Date(),
            },
          })
          updated++
        } catch (dbErr: any) {
          errors.push(`Stats update failed for ${s.playerName}: ${dbErr.message?.slice(0, 100)}`)
        }
      }

      await new Promise(r => setTimeout(r, 200))
    } catch (err: any) {
      errors.push(`Team ${team} stats failed: ${err.message?.slice(0, 100)}`)
    }
  }

  return { updated, errors }
}

export async function classifyGraduations(): Promise<{ graduated: number; errors: string[] }> {
  let graduated = 0
  const errors: string[] = []

  try {
    const sleeperPlayersRes = await fetch('https://api.sleeper.app/v1/players/nfl')
    if (!sleeperPlayersRes.ok) {
      errors.push('Failed to fetch Sleeper NFL players')
      return { graduated, errors }
    }
    const nflPlayers: Record<string, any> = await sleeperPlayersRes.json()

    const nflNameMap = new Map<string, { id: string; team: string; position: string }>()
    for (const [id, p] of Object.entries(nflPlayers)) {
      if (!p) continue
      const name = normalizeName(`${p.first_name || ''} ${p.last_name || ''}`)
      if (name.length < 3) continue
      nflNameMap.set(name, {
        id,
        team: p.team || '',
        position: p.position || '',
      })
    }

    const eligiblePlayers = await prisma.devyPlayer.findMany({
      where: { devyEligible: true, graduatedToNFL: false },
    })

    for (const devy of eligiblePlayers) {
      const nflMatch = nflNameMap.get(devy.normalizedName)
      if (!nflMatch) continue

      if (devy.position !== nflMatch.position) continue

      try {
        await prisma.devyPlayer.update({
          where: { id: devy.id },
          data: {
            devyEligible: false,
            graduatedToNFL: true,
            league: 'NFL',
            sleeperId: nflMatch.id,
            nflTeam: nflMatch.team,
            lastClassifiedAt: new Date(),
            lastSyncedAt: new Date(),
          },
        })
        graduated++
        console.log(`[DevyClassify] Graduated: ${devy.name} (${devy.school}) → ${nflMatch.team}`)
      } catch (dbErr: any) {
        errors.push(`Graduation update failed for ${devy.name}: ${dbErr.message?.slice(0, 100)}`)
      }
    }
  } catch (err: any) {
    errors.push(`Classification error: ${err.message?.slice(0, 200)}`)
  }

  return { graduated, errors }
}

export async function enrichDevyIntelMetrics(): Promise<{ updated: number; errors: string[] }> {
  let updated = 0
  const errors: string[] = []

  const players = await prisma.devyPlayer.findMany({
    where: { devyEligible: true, graduatedToNFL: false, league: 'NCAA' },
  })

  for (const player of players) {
    try {
      const metrics = computeAllDevyIntelMetrics(player)

      await prisma.devyPlayer.update({
        where: { id: player.id },
        data: {
          recruitingComposite: metrics.recruitingComposite,
          breakoutAge: metrics.breakoutAge,
          draftProjectionScore: metrics.draftProjectionScore,
          projectedDraftRound: metrics.projectedDraftRound,
          projectedDraftPick: metrics.projectedDraftPick,
          athleticProfileScore: metrics.athleticProfileScore,
          productionIndex: metrics.productionIndex,
          nilImpactScore: metrics.nilImpactScore,
          injurySeverityScore: metrics.injurySeverityScore,
          volatilityScore: metrics.volatilityScore,
          lastSyncedAt: new Date(),
        },
      })
      updated++
    } catch (err: any) {
      errors.push(`Intel enrichment failed for ${player.name}: ${err.message?.slice(0, 100)}`)
    }
  }

  return { updated, errors }
}

export async function runFullDevySync(season?: number): Promise<DevySyncResult> {
  console.log('[DevySync] Starting full devy sync...')

  const roster = await ingestCFBDRosters(season)
  console.log(`[DevySync] Ingested ${roster.ingested} players from ${TOP_CFB_TEAMS.length} teams`)

  const stats = await ingestCFBDStats(season)
  console.log(`[DevySync] Updated stats for ${stats.updated} players`)

  const grad = await classifyGraduations()
  console.log(`[DevySync] Graduated ${grad.graduated} players to NFL`)

  const intel = await enrichDevyIntelMetrics()
  console.log(`[DevySync] Enriched intel metrics for ${intel.updated} players`)

  return {
    ingested: roster.ingested,
    graduated: grad.graduated,
    classified: roster.ingested + stats.updated,
    errors: [...roster.errors, ...stats.errors, ...grad.errors, ...intel.errors],
  }
}

export async function getEligibleDevyPlayers(opts?: {
  position?: string
  limit?: number
  minValue?: number
  draftEligibleYear?: number
}): Promise<any[]> {
  const where: any = {
    devyEligible: true,
    graduatedToNFL: false,
    league: 'NCAA',
  }
  if (opts?.position) where.position = opts.position
  if (opts?.minValue) where.devyValue = { gte: opts.minValue }
  if (opts?.draftEligibleYear) where.draftEligibleYear = opts.draftEligibleYear

  return prisma.devyPlayer.findMany({
    where,
    orderBy: { devyValue: 'desc' },
    take: opts?.limit || 100,
  })
}
