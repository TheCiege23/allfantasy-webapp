import { NextRequest, NextResponse } from "next/server"
import { getStripeSync } from "@/lib/stripe-client"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
    }

    const body = await req.arrayBuffer()
    const payload = Buffer.from(body)

    const sync = await getStripeSync()
    const event = await sync.processWebhook(payload, signature)

    if (event?.type === "checkout.session.completed") {
      const session = event.data.object as any
      const metadata = session.metadata || {}
      const paymentType = metadata.paymentType
      const userId = metadata.userId
      const leagueId = metadata.leagueId
      const tournamentId = metadata.tournamentId

      if (paymentType && userId && leagueId && tournamentId) {
        await (prisma as any).bracketPayment.updateMany({
          where: {
            stripeSessionId: session.id,
            status: "pending",
          },
          data: {
            status: "completed",
            stripePaymentIntent: session.payment_intent,
            completedAt: new Date(),
          },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error("Stripe webhook error:", err.message)
    return NextResponse.json({ error: "Webhook error" }, { status: 400 })
  }
}
