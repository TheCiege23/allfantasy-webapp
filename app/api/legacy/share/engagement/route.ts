import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sleeper_username, share_type, platform, action, style } = body

    if (!sleeper_username || !share_type || !platform || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await prisma.shareEngagement.create({
      data: {
        sleeperUsername: sleeper_username,
        shareType: share_type,
        platform,
        action,
        style: style || null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Share engagement log error:', e)
    return NextResponse.json({ ok: true })
  }
}

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get('sleeper_username')
    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    const recent = await prisma.shareEngagement.findMany({
      where: { sleeperUsername: username },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        shareType: true,
        platform: true,
        style: true,
        createdAt: true,
      },
    })

    const styleCounts: Record<string, number> = {}
    const platformCounts: Record<string, number> = {}
    for (const r of recent) {
      if (r.style) styleCounts[r.style] = (styleCounts[r.style] || 0) + 1
      platformCounts[r.platform] = (platformCounts[r.platform] || 0) + 1
    }

    const preferredStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null
    const preferredPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

    return NextResponse.json({
      ok: true,
      preferred_style: preferredStyle,
      preferred_platform: preferredPlatform,
      total_shares: recent.length,
    })
  } catch (e) {
    console.error('Share engagement fetch error:', e)
    return NextResponse.json({ ok: true, preferred_style: null, preferred_platform: null })
  }
}
