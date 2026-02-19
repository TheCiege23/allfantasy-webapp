import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const games = await (prisma as any).marchMadnessGame.findMany({
    orderBy: [{ round: "asc" }, { gameNumber: "asc" }],
  })

  return NextResponse.json(games)
}
