import { NextResponse } from 'next/server'
import { autoGraduateOnDraft } from '@/lib/devy-classifier'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { draftedPlayers } = body

    if (!Array.isArray(draftedPlayers) || draftedPlayers.length === 0) {
      return NextResponse.json(
        { error: 'draftedPlayers array is required with at least one entry' },
        { status: 400 }
      )
    }

    for (const p of draftedPlayers) {
      if (!p.name || !p.team || !p.round || !p.pick || !p.draftYear || !p.position) {
        return NextResponse.json(
          { error: 'Each drafted player must have: name, position, team, round, pick, draftYear' },
          { status: 400 }
        )
      }
    }

    const result = await autoGraduateOnDraft(draftedPlayers)

    return NextResponse.json({
      success: true,
      graduated: result.graduated,
      skipped: result.skipped,
      total: draftedPlayers.length,
      errors: result.errors.slice(0, 20),
    })
  } catch (error: any) {
    console.error('[DevyGraduate] Error:', error)
    return NextResponse.json(
      { error: 'Draft graduation failed', message: error.message },
      { status: 500 }
    )
  }
}
