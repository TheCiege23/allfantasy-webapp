import { NextResponse } from "next/server"
import { getStripePublishableKey } from "@/lib/stripe-client"

export async function GET() {
  try {
    const key = await getStripePublishableKey()
    return NextResponse.json({ publishableKey: key })
  } catch (err: any) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }
}
