import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const GET = withApiUsage({ endpoint: "/api/auth/me", tool: "AuthMe" })(async (request: NextRequest) => {
  const cookieStore = cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession?.value) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  try {
    const sessionData = JSON.parse(adminSession.value)
    
    if (!sessionData.authenticated || !sessionData.email) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: sessionData.id || 'admin',
        email: sessionData.email,
        name: sessionData.name || 'Admin',
        role: sessionData.role || 'admin',
      }
    })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
})
