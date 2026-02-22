import { NextResponse } from "next/server"
import { selectBestProvider, listProviders } from "@/lib/brackets/providers"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const available = listProviders()
    const best = await selectBestProvider()
    const caps = await best.capabilities()
    const score = await best.capabilityScore()

    return NextResponse.json({
      ok: true,
      selectedProvider: {
        id: best.id,
        name: best.name,
        capabilities: caps,
        score,
      },
      availableProviders: available,
      playByPlaySupported: caps.play_by_play,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
