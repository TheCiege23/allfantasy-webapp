import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { sendMetaCAPIEvent } from "@/lib/meta-capi";

export const POST = withApiUsage({ endpoint: "/api/meta/complete-registration", tool: "MetaCompleteRegistration" })(async (req: Request) => {
  try {
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

    if (test_event_code) {
      process.env.META_TEST_EVENT_CODE = test_event_code;
    }

    const ua = req.headers.get("user-agent") || undefined;
    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim() || undefined;

    const result = await sendMetaCAPIEvent({
      eventName: "CompleteRegistration",
      eventId: event_id,
      email: email || "",
      phone,
      clientIp,
      clientUserAgent: ua,
      eventSourceUrl: source_url,
      fbp,
      fbc,
    });

    if (!result.success) {
      console.error("Meta CAPI error:", result.error);
      return NextResponse.json({ ok: false, error: result.error, meta: result.meta }, { status: 500 });
    }

    console.log("Meta CAPI CompleteRegistration sent:", event_id);
    return NextResponse.json({ ok: true, meta: result.meta });
  } catch (e: any) {
    console.error("Meta CAPI error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
})
