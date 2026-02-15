import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE_NAME = 'af_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('Missing SESSION_SECRET environment variable')
  return secret
}

export type UserSessionPayload = {
  sleeperUsername: string

  sleeperId?: string
  createdAt: number
  expiresAt: number
}

export function signUserSession(payload: Omit<UserSessionPayload, 'createdAt' | 'expiresAt'>): string {
  const secret = getSessionSecret()
  const now = Date.now()
  
  const fullPayload: UserSessionPayload = {
    ...payload,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
  
  return `${payloadB64}.${signature}`
}

export function verifyUserSession(token: string): UserSessionPayload | null {
  try {
    const secret = getSessionSecret()
    const [payloadB64, signature] = token.split('.')
    
    if (!payloadB64 || !signature) return null
    
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url')
    
    const sigBuffer = Buffer.from(signature, 'base64url')
    const expectedBuffer = Buffer.from(expectedSig, 'base64url')
    
    if (sigBuffer.length !== expectedBuffer.length) return null
    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null
    
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as UserSessionPayload
    
    if (Date.now() > payload.expiresAt) return null
    
    return payload
  } catch {
    return null
  }
}

export function setUserSessionCookie(payload: Omit<UserSessionPayload, 'createdAt' | 'expiresAt'>): string {
  const token = signUserSession(payload)
  
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  })
  
  return token
}

export function getUserSessionFromCookie(): UserSessionPayload | null {
  try {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value
    if (!token) return null
    return verifyUserSession(token)
  } catch {
    return null
  }
}

export function clearUserSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME)
}

const ALLOWED_ORIGINS = [
  'https://allfantasy.ai',
  'https://www.allfantasy.ai',
  'https://allfantasy.app',
  'https://www.allfantasy.app',
]

function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function validateRequestOrigin(req: NextRequest): boolean {
  if (isDevelopment()) return true
  
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  
  if (origin) {
    if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) return true
    if (origin.includes('.replit.dev') || origin.includes('.repl.co')) return true
  }
  
  if (referer) {
    if (ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed))) return true
    if (referer.includes('.replit.dev') || referer.includes('.repl.co')) return true
  }
  
  return false
}

export type AuthResult = {
  authenticated: boolean
  user: UserSessionPayload | null
  error?: string
}

export function requireAuth(req: NextRequest): AuthResult {
  if (!validateRequestOrigin(req)) {
    return {
      authenticated: false,
      user: null,
      error: 'Invalid request origin',
    }
  }
  
  const user = getUserSessionFromCookie()
  
  if (!user) {
    return {
      authenticated: false,
      user: null,
      error: 'Authentication required',
    }
  }
  
  return {
    authenticated: true,
    user,
  }
}

export function requireAuthOrOrigin(req: NextRequest): AuthResult {
  if (!validateRequestOrigin(req)) {
    return {
      authenticated: false,
      user: null,
      error: 'Invalid request origin',
    }
  }
  
  const user = getUserSessionFromCookie()
  
  return {
    authenticated: true,
    user,
  }
}

export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}
