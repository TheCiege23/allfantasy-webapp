import { NextResponse } from "next/server"
import { runMigrations } from "stripe-replit-sync"
import { getStripeSync } from "@/lib/stripe-client"

let initialized = false

export async function POST() {
  if (initialized) {
    return NextResponse.json({ ok: true, message: "Already initialized" })
  }

  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL not set" }, { status: 500 })
    }

    await runMigrations({ databaseUrl, schema: "stripe" })

    const stripeSync = await getStripeSync()
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/bracket/stripe/webhook`
    )

    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: any) => console.error("Stripe sync error:", err))

    initialized = true
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Stripe init error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
