import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import crypto from "crypto";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

function normPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export const POST = withApiUsage({ endpoint: "/api/meta/complete-registration", tool: "MetaCompleteRegistration" })(async (req: Request) => {
  try {
    const pixelId = process.env.META_PIXEL_ID || "1607977376870461";
    const accessToken = process.env.META_CONVERSIONS_API_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "Missing META_CONVERSIONS_API_TOKEN" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      event_id,
      email,
      phone,
      fbp,
      fbc,
      test_event_code,
      source_url,
    } = body ?? {};

    if (!event_id) {
      return NextResponse.json({ ok: false, error: "Missing event_id" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    const user_data: Record<string, any> = {};

    if (email) user_data.em = [sha256(normEmail(email))];
    if (phone) user_data.ph = [sha256(normPhone(phone))];
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;

    const ua = req.headers.get("user-agent");
    if (ua) user_data.client_user_agent = ua;

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    if (clientIp) user_data.client_ip_address = clientIp.split(",")[0].trim();

    const payload: any = {
      data: [
        {
          event_name: "CompleteRegistration",
          event_time: now,
          event_id,
          action_source: "website",
          event_source_url: source_url || "https://allfantasy.ai/",
          user_data,
          custom_data: { currency: "USD", value: 0.0 },
        },
      ],
    };

    const code = test_event_code || process.env.META_TEST_EVENT_CODE;
    if (code) payload.test_event_code = code;

    const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await r.json();

    if (!r.ok) {
      console.error("Meta CAPI error:", json);
      return NextResponse.json({ ok: false, status: r.status, meta: json }, { status: 500 });
    }

    console.log("Meta CAPI CompleteRegistration sent:", event_id);
    return NextResponse.json({ ok: true, meta: json });
  } catch (e: any) {
    console.error("Meta CAPI error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
})
