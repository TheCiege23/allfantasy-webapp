import { NextRequest, NextResponse } from "next/server"
export const dynamic = "force-dynamic"
export const POST = async () => {
  return NextResponse.json({ 
    message: "Bracket wiring is no longer needed with the new game-based model" 
  }, { status: 200 })
}
