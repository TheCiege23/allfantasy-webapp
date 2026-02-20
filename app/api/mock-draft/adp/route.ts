import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLiveADP } from '@/lib/adp-data'
import { resolveSleeperIds } from '@/lib/sleeper/players-cache'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const type = (req.nextUrl.searchParams.get('type') || 'redraft') as 'dynasty' | 'redraft'
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '300'), 500)

    const entries = await getLiveADP(type, limit)

    let sleeperIdMap: Record<string, string> = {}
    try {
      sleeperIdMap = await resolveSleeperIds(entries.map(e => e.name))
    } catch {}

    return NextResponse.json({
      entries: entries.map(e => ({
        name: e.name,
        position: e.position,
        team: e.team,
        adp: e.adp,
        adpTrend: e.adpTrend,
        value: e.value,
        sleeperId: sleeperIdMap[e.name] || null,
      })),
      count: entries.length,
      type,
    })
  } catch (err: any) {
    console.error('[mock-draft/adp] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch ADP' }, { status: 500 })
  }
}
