import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { leagueId, results, draftId } = await req.json()
    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId is required' }, { status: 400 })
    }
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ error: 'results must be a non-empty array' }, { status: 400 })
    }

    let draft = draftId
      ? await prisma.mockDraft.findFirst({
          where: { id: draftId, userId: session.user.id, leagueId },
        })
      : await prisma.mockDraft.findFirst({
          where: { leagueId, userId: session.user.id },
          orderBy: { createdAt: 'desc' },
        })

    if (draft?.shareId) {
      await prisma.mockDraft.update({
        where: { id: draft.id },
        data: { results },
      })
      return NextResponse.json({ shareId: draft.shareId })
    }

    const shareId = crypto.randomBytes(8).toString('base64url')

    if (draft) {
      await prisma.mockDraft.update({
        where: { id: draft.id },
        data: { shareId, results },
      })
    } else {
      await prisma.mockDraft.create({
        data: {
          leagueId,
          userId: session.user.id,
          rounds: Math.max(...results.map((p: any) => p.round || 0), 1),
          results,
          shareId,
        },
      })
    }

    return NextResponse.json({ shareId })
  } catch (err: any) {
    console.error('[mock-draft/share]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
