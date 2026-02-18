import { NextResponse } from "next/server"
import { getBaseUrl } from "@/lib/get-base-url"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const base = getBaseUrl() || url.origin
  const target = token
    ? `${base}/verify/email?token=${encodeURIComponent(token)}`
    : `${base}/verify`
  return NextResponse.redirect(target, 308)
}
