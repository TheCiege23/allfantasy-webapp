import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLiveADP, fetchFFCADP, fetchAllFFCFormats, FFCScoringFormat } from '@/lib/adp-data'
import { resolveSleeperIds } from '@/lib/sleeper/players-cache'
import { findMultiADP, type ADPFormat } from '@/lib/multi-platform-adp'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const action = req.nextUrl.searchParams.get('action') || 'live'
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '300'), 500)

    if (action === 'ffc') {
      const validFormats: FFCScoringFormat[] = ['standard', 'ppr', 'half-ppr', '2qb', 'dynasty', 'rookie']
      const formatParam = req.nextUrl.searchParams.get('format') || 'standard'
      if (!validFormats.includes(formatParam as FFCScoringFormat)) {
        return NextResponse.json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` }, { status: 400 })
      }
      const format = formatParam as FFCScoringFormat
      const teams = parseInt(req.nextUrl.searchParams.get('teams') || '12')
      const { players, meta } = await fetchFFCADP(format, teams)
      return NextResponse.json({
        entries: players.slice(0, limit),
        count: players.length,
        meta,
        source: 'fantasyfootballcalculator.com',
      })
    }

    if (action === 'ffc-all') {
      const teams = parseInt(req.nextUrl.searchParams.get('teams') || '12')
      const allFormats = await fetchAllFFCFormats(teams)
      const summary: Record<string, { count: number; meta: any }> = {}
      for (const [format, data] of Object.entries(allFormats)) {
        summary[format] = { count: data.players.length, meta: data.meta }
      }
      return NextResponse.json({
        formats: summary,
        source: 'fantasyfootballcalculator.com',
      })
    }

    const type = (req.nextUrl.searchParams.get('type') || 'redraft') as 'dynasty' | 'redraft'
    const pool = req.nextUrl.searchParams.get('pool') || 'all'

    let entries: Awaited<ReturnType<typeof getLiveADP>> = []

    if (pool === 'rookie') {
      const [devyEntries, ffcRookies] = await Promise.all([
        getLiveADP('devy', limit).catch(() => []),
        fetchFFCADP('rookie', 12).then(r => r.players).catch(() => []),
      ])
      const nameSet = new Set<string>()
      for (const e of devyEntries) {
        nameSet.add(e.name.toLowerCase())
        entries.push(e)
      }
      for (const e of ffcRookies) {
        if (!nameSet.has(e.name.toLowerCase())) {
          nameSet.add(e.name.toLowerCase())
          entries.push(e)
        }
      }
      entries.sort((a, b) => a.adp - b.adp)
      entries = entries.slice(0, limit)
    } else if (pool === 'vet') {
      entries = await getLiveADP(type, limit)
      entries = entries.filter(e => e.source !== 'devy' && e.source !== 'rookie-db')
    } else if (pool === 'combined') {
      const [nflEntries, devyEntries] = await Promise.all([
        getLiveADP(type, limit),
        getLiveADP('devy', Math.floor(limit / 2)).catch(() => []),
      ])
      const nameSet = new Set<string>()
      for (const e of nflEntries) {
        nameSet.add(e.name.toLowerCase())
        entries.push(e)
      }
      for (const e of devyEntries) {
        if (!nameSet.has(e.name.toLowerCase())) {
          nameSet.add(e.name.toLowerCase())
          entries.push(e)
        }
      }
      entries.sort((a, b) => a.adp - b.adp)
      entries = entries.slice(0, limit)
    } else {
      entries = await getLiveADP(type, limit)
    }

    let sleeperIdMap: Record<string, string> = {}
    try {
      sleeperIdMap = await resolveSleeperIds(entries.map(e => e.name))
    } catch {}

    const adpFormat: ADPFormat = type === 'dynasty' ? 'dynasty' : 'redraft'

    return NextResponse.json({
      entries: entries.map(e => {
        const isRookie = e.source === 'devy' || e.source === 'rookie-db'
        const mp = !isRookie ? findMultiADP(e.name, e.position, e.team || undefined) : null
        return {
          name: e.name,
          position: e.position,
          team: e.team,
          adp: e.adp,
          adpFormatted: e.adpFormatted,
          adpTrend: e.adpTrend,
          value: e.value,
          sleeperId: sleeperIdMap[e.name] || null,
          ffcPlayerId: e.ffcPlayerId,
          timesDrafted: e.timesDrafted,
          adpHigh: e.adpHigh,
          adpLow: e.adpLow,
          adpStdev: e.adpStdev,
          bye: e.bye,
          isRookie,
          multiPlatformADP: mp ? {
            format: adpFormat,
            consensus: mp.consensus,
            platformCount: mp.platformCount,
            spread: mp.adpSpread,
            redraft: mp.redraft,
            dynastyADP: mp.dynasty.sleeper,
            dynasty2QBADP: mp.dynasty2QB.sleeper,
            aav: mp.aav.mfl ?? mp.aav.espn ?? null,
            health: mp.health.status || mp.health.injury ? mp.health : null,
          } : null,
        }
      }),
      count: entries.length,
      type,
      pool,
    })
  } catch (err: any) {
    console.error('[mock-draft/adp] Error:', err)
    return NextResponse.json({ error: err.message || 'Failed to fetch ADP' }, { status: 500 })
  }
}
