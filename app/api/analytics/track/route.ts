import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeStr(v: unknown, max = 500) {
  const s = typeof v === "string" ? v : "";
  return s.length > max ? s.slice(0, max) : s;
}

export const POST = withApiUsage({ endpoint: "/api/analytics/track", tool: "AnalyticsTrack" })(async (req: Request) => {
  try {
    const body = await req.json().catch(() => null);

    const event = safeStr(body?.event, 64);
    if (!event) return NextResponse.json({ ok: false, error: "Missing event" }, { status: 400 });

    const sessionId = safeStr(body?.sessionId, 128) || null;
    const path = safeStr(body?.path, 500) || null;
    const referrer = safeStr(body?.referrer, 500) || null;
    const userAgent = safeStr(req.headers.get("user-agent"), 500) || null;

    const toolKey = safeStr(body?.toolKey, 128) || null;

    const meta =
      body?.meta && typeof body.meta === "object"
        ? JSON.parse(JSON.stringify(body.meta).slice(0, 10_000))
        : null;

    await prisma.analyticsEvent.create({
      data: {
        event,
        sessionId,
        path,
        referrer,
        userAgent,
        toolKey,
        meta,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: true });
  }
})
