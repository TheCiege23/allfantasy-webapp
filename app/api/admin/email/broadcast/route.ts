import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminAuth";
import { getResendClient } from "@/lib/resend-client";

export const dynamic = 'force-dynamic';

type Body = {
  subject?: string;
  html?: string;
  from?: string;
  dryRun?: boolean;
  limit?: number;
  batchSize?: number;
  concurrency?: number;
  delayMs?: number;
};

function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function looksLikeEmail(email: string) {
  const e = email.trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      try {
        const value = await fn(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => worker());
  await Promise.all(workers);
  return results;
}

export const POST = withApiUsage({ endpoint: "/api/admin/email/broadcast", tool: "AdminEmailBroadcast" })(async (request: NextRequest) => {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body) return bad("Missing JSON body");

    const subject = (body.subject || "").trim();
    const html = (body.html || "").trim();
    const dryRun = !!body.dryRun;

    if (!subject) return bad("Missing subject");
    if (!html) return bad("Missing html");
    if (html.length < 20) return bad("HTML looks too short (safety check)");

    const requestedLimit = Math.min(Math.max(Number(body.limit || 0) || 0, 0), 5000);

    const recipients = await prisma.earlyAccessSignup.findMany({
      select: { email: true },
      orderBy: { createdAt: "desc" },
      ...(requestedLimit ? { take: requestedLimit } : {}),
    });

    const emails = Array.from(
      new Set(
        recipients
          .map((r) => (r.email || "").trim().toLowerCase())
          .filter((e) => looksLikeEmail(e))
      )
    );

    const BATCH_SIZE = Math.min(Math.max(Number(body.batchSize || 90) || 90, 1), 200);
    const CONCURRENCY = Math.min(Math.max(Number(body.concurrency || 12) || 12, 1), 50);
    const DELAY_MS = Math.min(Math.max(Number(body.delayMs || 250) || 250, 0), 5000);

    const userAgent = request.headers.get("user-agent") || undefined;
    const referrer = request.headers.get("referer") || undefined;
    const path = "/api/admin/email/broadcast";

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_email_broadcast",
        path,
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          subject,
          dryRun,
          requestedLimit: requestedLimit || null,
          recipientCount: emails.length,
          tuning: { batchSize: BATCH_SIZE, concurrency: CONCURRENCY, delayMs: DELAY_MS },
          adminEmail: gate.user.email,
          adminRole: gate.user.role,
        },
      },
    });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        recipients: emails.length,
        sample: emails.slice(0, 5),
      });
    }

    const { client: resend, fromEmail } = await getResendClient();
    const from = (body.from || fromEmail || process.env.RESEND_FROM || "").trim();
    if (!from) return bad("Missing from address");

    const batches = chunk(emails, BATCH_SIZE);

    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (const batch of batches) {
      const results = await mapLimit(batch, CONCURRENCY, async (to) => {
        const resp: any = await resend.emails.send({ from, to, subject, html });
        if (resp?.error) {
          throw new Error(resp.error?.message || "send failed");
        }
        return resp;
      });

      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          sent += 1;
        } else {
          failed += 1;
          const reason: any = (r as any).reason;
          errors.push({
            email: batch[idx],
            error: String(reason?.message || reason || "send failed"),
          });
        }
      });

      if (DELAY_MS > 0) {
        await new Promise((res) => setTimeout(res, DELAY_MS));
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey: "admin_email_broadcast_result",
        path,
        userAgent,
        referrer,
        userId: gate.user.id,
        meta: {
          subject,
          from,
          recipientCount: emails.length,
          sent,
          failed,
          errorCount: errors.length,
          errorSample: errors.slice(0, 10),
          adminEmail: gate.user.email,
          adminRole: gate.user.role,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      recipients: emails.length,
      sent,
      failed,
      errors: errors.slice(0, 25),
    });
  } catch (error) {
    console.error("Admin broadcast error:", error);
    return NextResponse.json({ error: "Failed to send broadcast" }, { status: 500 });
  }
})
