import { prisma } from "@/lib/prisma";

export async function trackLegacyToolUsage(
  toolKey: string,
  userId?: string | null,
  sessionId?: string | null,
  meta?: Record<string, any>
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        event: "tool_use",
        toolKey,
        userId: userId || null,
        sessionId: sessionId || null,
        meta: meta ? JSON.parse(JSON.stringify(meta).slice(0, 10_000)) : null,
      },
    });
  } catch (e) {
    console.error("Failed to track analytics:", e);
  }
}
