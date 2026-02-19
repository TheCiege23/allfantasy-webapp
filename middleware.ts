import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const REDIRECT_LOOP_COOKIE = "af_redirect_count"
const MAX_REDIRECTS = 5
const WINDOW_SECONDS = 30

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/login") {
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || ""
    const cookieVal = request.cookies.get(REDIRECT_LOOP_COOKIE)?.value
    let count = 0
    let lastPath = ""

    if (cookieVal) {
      try {
        const parsed = JSON.parse(cookieVal)
        count = parsed.c || 0
        lastPath = parsed.p || ""
      } catch {}
    }

    if (callbackUrl && callbackUrl === lastPath) {
      count++
    } else {
      count = 1
      lastPath = callbackUrl
    }

    if (count >= MAX_REDIRECTS) {
      console.error(
        `[REDIRECT_LOOP] Detected redirect loop: ${count} redirects to /login with callbackUrl=${callbackUrl}`
      )
      const response = NextResponse.next()
      response.cookies.delete(REDIRECT_LOOP_COOKIE)
      return response
    }

    const response = NextResponse.next()
    response.cookies.set(REDIRECT_LOOP_COOKIE, JSON.stringify({ c: count, p: lastPath }), {
      maxAge: WINDOW_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login"],
}
