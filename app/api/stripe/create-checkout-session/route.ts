import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUncachableStripeClient } from "@/lib/stripe-client";

type Body = {
  mode: "donate" | "lab";
  amount: number;
  currency: "usd";
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const APP_URL =
      process.env.APP_URL ||
      `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

    const body = (await req.json()) as Body;

    if (!body || !body.amount || body.amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const isLab = body.mode === "lab";
    const amountCents = Math.round(body.amount * 100);

    if (isLab && amountCents !== 999) {
      return NextResponse.json(
        { error: "Invalid Lab Pass amount" },
        { status: 400 }
      );
    }

    if (!isLab && (amountCents < 100 || amountCents > 50000)) {
      return NextResponse.json(
        { error: "Donation must be between $1 and $500" },
        { status: 400 }
      );
    }

    const productName = isLab ? "Bracket Lab Pass (Tournament)" : "Donation";
    const description = isLab
      ? "Access to simulation and strategy exploration tools for this tournament."
      : "Optional support to fund performance, servers, and data costs.";

    const stripe = await getUncachableStripeClient();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${APP_URL}/donate/success?mode=${body.mode}`,
      cancel_url: `${APP_URL}/donate?mode=${body.mode}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description,
            },
            unit_amount: amountCents,
          },
        },
      ],
      metadata: {
        purchase_type: body.mode,
        framing: isLab ? "research_tools" : "support",
        userId: session.user.id,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (e: any) {
    console.error("Stripe checkout error:", e);
    return NextResponse.json(
      { error: e?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
