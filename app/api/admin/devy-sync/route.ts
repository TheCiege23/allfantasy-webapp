import { NextResponse } from 'next/server'
import { runFullDevySync } from '@/lib/devy-classification'
import { isAuthorizedRequest, adminUnauthorized } from "@/lib/adminAuth"

export async function POST(request: Request) {
  try {
    if (!isAuthorizedRequest(request)) return adminUnauthorized()

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
