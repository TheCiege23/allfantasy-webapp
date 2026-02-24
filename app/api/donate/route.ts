import { NextResponse } from "next/server"
import { getUncachableStripeClient } from "@/lib/stripe-client"

export async function POST(req: Request) {
  try {
    const APP_URL =
      process.env.APP_URL ||
      `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`

    const body = await req.json()
    const amountCents = Math.round(Number(body.amountCents))

    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 50000) {
      return NextResponse.json(
        { error: "Amount must be between $1 and $500" },
        { status: 400 }
      )
    }

    const stripe = await getUncachableStripeClient()

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL}/support/success`,
      cancel_url: `${APP_URL}/support`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: "AllFantasy Donation",
              description: "Support AllFantasy development — servers, data, and new features.",
            },
            unit_amount: amountCents,
          },
        },
      ],
      metadata: {
        purchase_type: "donation",
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (e: any) {
    console.error("Donate checkout error:", e)
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    )
  }
}
