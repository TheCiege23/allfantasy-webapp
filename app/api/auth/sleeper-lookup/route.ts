import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")

  if (!username || username.trim().length < 2) {
    return NextResponse.json({ error: "Please enter a valid Sleeper username." }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.sleeper.app/v1/user/${encodeURIComponent(username.trim())}`)

    if (!res.ok) {
      return NextResponse.json({ found: false, error: "Sleeper user not found." }, { status: 404 })
    }

    const data = await res.json()

    if (!data || !data.user_id) {
      return NextResponse.json({ found: false, error: "Sleeper user not found." }, { status: 404 })
    }

    return NextResponse.json({
      found: true,
      username: data.username,
      userId: data.user_id,
      displayName: data.display_name || data.username,
      avatar: data.avatar ? `https://sleepercdn.com/avatars/thumbs/${data.avatar}` : null,
    })
  } catch {
    return NextResponse.json({ error: "Failed to look up Sleeper user." }, { status: 500 })
  }
}
