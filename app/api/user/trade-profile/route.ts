import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTradeProfileFull } from '@/lib/trade-feedback-profile'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ summary: null, error: 'Not authenticated' }, { status: 401 })
    }

    const profile = await getUserTradeProfileFull(userId)
    return NextResponse.json(profile)
  } catch (err) {
    console.error('[trade-profile] GET error:', err)
    return NextResponse.json({ summary: null, voteCount: 0, version: 0, lastUpdated: null, error: 'Failed to load profile' }, { status: 500 })
  }
}
