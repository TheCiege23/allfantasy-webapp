import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { runRetrospective } from '@/lib/mock-draft/retrospective'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const leagueId = String(body?.leagueId || '')
    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      include: {
        teams: { select: { externalId: true, ownerName: true, teamName: true } },
      },
    })
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    const season = league.season || new Date().getFullYear()
    const teamMapping = new Map<string, string>()
    for (const t of league.teams) {
      teamMapping.set(t.externalId, t.ownerName || t.teamName || `Team ${t.externalId}`)
    }

    const result = await runRetrospective(
      leagueId,
      session.user.id,
      league.platformLeagueId,
      season,
      teamMapping
    )

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (err: any) {
    console.error('[mock-draft/retrospective] POST error', err)
    return NextResponse.json({ error: err?.message || 'Failed to run retrospective' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const leagueId = req.nextUrl.searchParams.get('leagueId')
    if (!leagueId) return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })

    const league = await prisma.league.findFirst({
      where: { id: leagueId, userId: session.user.id },
      select: { id: true, season: true },
    })
    if (!league) return NextResponse.json({ error: 'League not found' }, { status: 404 })

    const season = league.season || new Date().getFullYear()

    const retro = await prisma.draftRetrospective.findFirst({
      where: { leagueId, season },
      orderBy: { createdAt: 'desc' },
    })

    const cal = await prisma.leagueDraftCalibration.findUnique({
      where: { leagueId_season: { leagueId, season } },
    })

    if (!retro) {
      return NextResponse.json({
        ok: true,
        hasRetrospective: false,
        calibration: cal ? {
          adp: cal.adpWeight,
          need: cal.needWeight,
          tendency: cal.tendencyWeight,
          news: cal.newsWeight,
          rookie: cal.rookieWeight,
          sampleSize: cal.sampleSize,
        } : null,
      })
    }

    return NextResponse.json({
      ok: true,
      hasRetrospective: true,
      retrospective: {
        id: retro.id,
        overallAccuracy: retro.overallAccuracy,
        top3HitRate: retro.top3HitRate,
        managerAccuracy: retro.managerAccuracyJson,
        biggestMisses: retro.biggestMissesJson,
        calibrationDeltas: retro.calibrationDeltaJson,
        draftId: retro.draftId,
        createdAt: retro.createdAt,
      },
      calibration: cal ? {
        adp: cal.adpWeight,
        need: cal.needWeight,
        tendency: cal.tendencyWeight,
        news: cal.newsWeight,
        rookie: cal.rookieWeight,
        sampleSize: cal.sampleSize,
      } : null,
    })
  } catch (err: any) {
    console.error('[mock-draft/retrospective] GET error', err)
    return NextResponse.json({ error: err?.message || 'Failed to fetch retrospective' }, { status: 500 })
  }
}
