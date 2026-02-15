// app/api/legacy/snapshots/latest/route.ts
import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { readLatestSnapshot } from '@/lib/trade-engine/snapshots'

export const POST = withApiUsage({ endpoint: "/api/legacy/snapshots/latest", tool: "LegacySnapshotsLatest" })(async (req: NextRequest) => {
  try {
    const body = await req.json()

    const leagueId = String(body?.league_id || '').trim()
    const sleeperUsername = String(body?.sleeper_username || '').trim().toLowerCase()
    const snapshotType = String(body?.snapshot_type || '').trim() as 'league_analyze' | 'rankings_analyze' | 'otb_packages'
    const contextKey = body?.context_key ? String(body.context_key).trim() : null

    if (!leagueId || !sleeperUsername || !snapshotType) {
      return NextResponse.json(
        { ok: false, error: 'Missing: league_id, sleeper_username, snapshot_type' },
        { status: 400 }
      )
    }

    const snap = await readLatestSnapshot({ leagueId, sleeperUsername, snapshotType, contextKey })
    if (!snap) {
      return NextResponse.json(
        { ok: false, error: 'Snapshot not found. Run league-analyze / otb-packages first.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ok: true,
      snapshot: {
        id: snap.id,
        snapshotType,
        contextKey: snap.contextKey,
        createdAt: snap.createdAt,
        season: snap.season,
      },
      payload: snap.payload,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'Failed to load snapshot', message: String(e?.message || e) },
      { status: 500 }
    )
  }
})
