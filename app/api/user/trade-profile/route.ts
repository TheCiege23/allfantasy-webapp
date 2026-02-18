import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserTradeProfile } from '@/lib/trade-feedback-profile'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id
    if (!userId) {
      return NextResponse.json({ summary: null, error: 'Not authenticated' }, { status: 401 })
    }

    const summary = await getUserTradeProfile(userId)
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[trade-profile] GET error:', err)
    return NextResponse.json({ summary: null, error: 'Failed to load profile' }, { status: 500 })
  }
}
