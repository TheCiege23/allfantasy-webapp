import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUncachableStripeClient, getStripeSecretKey } from "@/lib/stripe-client"
import Stripe from "stripe"

export const runtime = "nodejs"

async function getWebhookSecret(): Promise<string | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
    const xReplitToken = process.env.REPL_IDENTITY
      ? "repl " + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
        ? "depl " + process.env.WEB_REPL_RENEWAL
        : null

    if (!xReplitToken || !hostname) return null

    const isProduction = process.env.REPLIT_DEPLOYMENT === "1"
    const targetEnvironment = isProduction ? "production" : "development"

    const url = new URL(`https://${hostname}/api/v2/connection`)
    url.searchParams.set("include_secrets", "true")
    url.searchParams.set("connector_names", "stripe")
    url.searchParams.set("environment", targetEnvironment)

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    })

    const data = await response.json()
    return data.items?.[0]?.settings?.webhook_secret ?? null
  } catch {
    return null
  }
}

async function recordPayment(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId
  const purchaseType = session.metadata?.purchase_type

  if (!userId || !purchaseType) {
    console.warn("[Stripe Webhook] Missing metadata on session:", session.id)
    return
  }

  const amountCents = session.amount_total ?? 0

  if (purchaseType === "lab" && amountCents !== 999) {
    console.warn(`[Stripe Webhook] Lab pass with unexpected amount: ${amountCents} (expected 999)`)
    return
  }

  if (purchaseType === "donate" && (amountCents < 100 || amountCents > 50000)) {
    console.warn(`[Stripe Webhook] Donation with invalid amount: ${amountCents}`)
    return
  }

  const existing = await (prisma as any).bracketPayment.findFirst({
    where: { stripeSessionId: session.id },
  })

  if (existing) {
    if (existing.status !== "completed") {
      await (prisma as any).bracketPayment.update({
        where: { id: existing.id },
        data: { status: "completed", completedAt: new Date() },
      })
    }
    return
  }

  await (prisma as any).bracketPayment.create({
    data: {
      userId,
      leagueId: "global",
      tournamentId: session.metadata?.tournamentId || "global",
      paymentType: purchaseType === "lab" ? "bracket_lab_pass" : "donation",
      stripeSessionId: session.id,
      stripePaymentIntent: typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
      status: "completed",
      amountCents,
      completedAt: new Date(),
    },
  })

  console.log(
    `[Stripe Webhook] Recorded ${purchaseType} payment for user ${userId} ($${(amountCents / 100).toFixed(2)})`
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  const webhookSecret = await getWebhookSecret()

  let event: Stripe.Event

  if (!sig) {
    console.error("[Stripe Webhook] Missing stripe-signature header")
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  if (!webhookSecret) {
    console.error("[Stripe Webhook] No webhook secret configured — cannot verify events")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  try {
    const stripe = await getUncachableStripeClient()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      await recordPayment(session)
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
