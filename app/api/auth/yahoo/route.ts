import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID
const APP_URL = process.env.APP_URL || 'https://allfantasy.ai'
// Use the exact redirect URI as configured in Yahoo Developer Console
const YAHOO_REDIRECT_URI = 'https://allfantasy.ai/api/auth/yahoo/callback'

export const GET = withApiUsage({ endpoint: "/api/auth/yahoo", tool: "AuthYahoo" })(async (request: NextRequest) => {
  if (!YAHOO_CLIENT_ID) {
    console.error('YAHOO_CLIENT_ID is not configured')
    return NextResponse.redirect(`${APP_URL}/af-legacy?yahoo_error=not_configured`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  
  // Build OAuth URL - Yahoo requires minimal parameters
  const params = new URLSearchParams()
  params.append('client_id', YAHOO_CLIENT_ID)
  params.append('redirect_uri', YAHOO_REDIRECT_URI)
  params.append('response_type', 'code')
  params.append('state', state)
  
  const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`
  
  console.log('Yahoo OAuth - Client ID (first 20):', YAHOO_CLIENT_ID.substring(0, 20))
  console.log('Yahoo OAuth - Redirect URI:', YAHOO_REDIRECT_URI)
  console.log('Yahoo OAuth - Full URL:', authUrl)
  
  const response = NextResponse.redirect(authUrl)
  
  response.cookies.set('yahoo_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  
  return response
})
