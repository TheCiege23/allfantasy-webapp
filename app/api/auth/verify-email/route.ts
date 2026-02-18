import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const target = token
    ? `/verify/email?token=${encodeURIComponent(token)}`
    : "/verify"
  return NextResponse.redirect(new URL(target, url.origin), 308)
}
