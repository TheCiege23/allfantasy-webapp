import { NextResponse } from 'next/server'
import { runFullDevySync } from '@/lib/devy-classification'

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword || authHeader !== `Bearer ${adminPassword}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runFullDevySync()

    return NextResponse.json({
      success: true,
      ...result,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 20),
    })
  } catch (error: any) {
    console.error('[DevySync] Error:', error)
    return NextResponse.json(
      { error: 'Devy sync failed', message: error.message },
      { status: 500 }
    )
  }
}
