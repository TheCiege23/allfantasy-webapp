import { prisma } from "@/lib/prisma"
import { getV2Rankings } from "./v2-adapter"

function toLetter(score: number) {
  if (score >= 97) return "A+"
  if (score >= 93) return "A"
  if (score >= 90) return "A-"
  if (score >= 87) return "B+"
  if (score >= 83) return "B"
  if (score >= 80) return "B-"
  if (score >= 77) return "C+"
  if (score >= 73) return "C"
  if (score >= 70) return "C-"
  if (score >= 65) return "D"
  return "F"
}

type GradeDisplay = {
  letter: string
  title: string
  color: string
  notes: string[]
}

export function calculateGrade(team: any, results: any[]): GradeDisplay {
  const picks = results.filter((p: any) => p.manager === team.teamName || p.rosterId === team.rosterId)
  let score = 80

  const hasEliteQB = picks.some((p: any) => p.position === 'QB' && (p.confidence ?? 0) > 90)
  const hasEliteRB = picks.some((p: any) => p.position === 'RB' && (p.confidence ?? 0) > 85)
  const hasEliteWR = picks.some((p: any) => p.position === 'WR' && (p.confidence ?? 0) > 85)
  const youngPicks = picks.filter((p: any) => (p.age ?? 30) <= 24)
  const totalValue = picks.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)

  if (hasEliteQB) score += 15
  if (hasEliteRB) score += 10
  if (hasEliteWR) score += 10
  if (youngPicks.length >= 3) score += 5
  if (totalValue > 20000) score += 10
  else if (totalValue > 10000) score += 5

  score = Math.min(100, Math.max(0, score))

  const letter = toLetter(score)

  const notes: string[] = []
  if (hasEliteQB) notes.push('Elite QB acquisition')
  if (hasEliteRB) notes.push('Strong RB foundation')
  if (hasEliteWR) notes.push('Deep WR corps')
  if (youngPicks.length >= 3) notes.push('Strong future core')
  if (totalValue > 10000) notes.push('Good value picks')
  if (notes.length === 0) notes.push('Balanced approach')

  const titleMap: Record<string, string> = {
    'A+': 'Elite Haul', 'A': 'Excellent Class', 'A-': 'Great Class',
    'B+': 'Solid Class', 'B': 'Above Average', 'B-': 'Decent Class',
    'C+': 'Average Class', 'C': 'Needs Work', 'C-': 'Below Average',
    'D': 'Poor Class', 'F': 'Rough Draft',
  }

  const colorMap: Record<string, string> = {
    'A+': '#22c55e', 'A': '#4ade80', 'A-': '#86efac',
    'B+': '#eab308', 'B': '#facc15', 'B-': '#fde047',
    'C+': '#f97316', 'C': '#fb923c', 'C-': '#fdba74',
    'D': '#ef4444', 'F': '#dc2626',
  }

  return {
    letter,
    title: titleMap[letter] || 'Solid Class',
    color: colorMap[letter] || '#eab308',
    notes,
  }
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0
  return Math.max(0, Math.min(1, x))
}

export async function computeDraftGrades(args: { leagueId: string; week: number }) {
  const v2 = await getV2Rankings(args)

  if (v2.phase !== "post_draft") {
    return {
      leagueId: v2.leagueId,
      leagueName: v2.leagueName,
      season: v2.season,
      week: v2.week,
      phase: v2.phase,
      grades: [],
      note: "Draft grades are only computed in post_draft phase."
    }
  }

  const teams = v2.teams.map((t: any) => ({
    rosterId: String(t.rosterId),
    name: String(t.name ?? t.teamName ?? `Roster ${t.rosterId}`),
    marketValueScore: Number(t.marketValueScore ?? 0),
    powerScore: Number(t.powerScore ?? 0),
    rosterExposure: Number(t.rosterExposure ?? 0),
    composite: Number(t.composite ?? 0),
    explanation: t.explanation ?? null
  }))

  const byComposite = [...teams].sort((a, b) => b.composite - a.composite)
  const n = byComposite.length || 1

  const grades = byComposite.map((t, idx) => {
    const percentile = 1 - idx / Math.max(1, n - 1)
    const score =
      60 * percentile +
      20 * clamp01((t.marketValueScore + 1) / 2) +
      20 * clamp01((t.powerScore + 1) / 2)

    const score100 = Math.round(score)
    return {
      rosterId: t.rosterId,
      name: t.name,
      score: score100,
      grade: toLetter(score100),
      breakdown: {
        percentileRank: percentile,
        marketValueScore: t.marketValueScore,
        powerScore: t.powerScore,
        composite: t.composite,
        note:
          "Draft grade V1 is percentile-based using post_draft composite + market/power components. Plug pre-draft baselines later for true delta grading."
      }
    }
  })

  return {
    leagueId: v2.leagueId,
    leagueName: v2.leagueName,
    season: v2.season,
    week: v2.week,
    phase: v2.phase,
    grades
  }
}

export async function upsertDraftGrades(args: {
  leagueId: string
  season: string
  grades: Array<{ rosterId: string; grade: string; score: number; breakdown: any }>
}) {
  await prisma.$transaction(
    args.grades.map((g) =>
      prisma.draftGrade.upsert({
        where: {
          uniq_draft_grade_league_season_roster: {
            leagueId: args.leagueId,
            season: args.season,
            rosterId: g.rosterId
          }
        },
        update: {
          grade: g.grade,
          score: g.score,
          breakdown: g.breakdown
        },
        create: {
          leagueId: args.leagueId,
          season: args.season,
          rosterId: g.rosterId,
          grade: g.grade,
          score: g.score,
          breakdown: g.breakdown
        }
      })
    )
  )
}

export async function getDraftGrades(args: { leagueId: string; season: string }) {
  return prisma.draftGrade.findMany({
    where: { leagueId: args.leagueId, season: args.season },
    orderBy: [{ score: "desc" }, { rosterId: "asc" }]
  })
}
