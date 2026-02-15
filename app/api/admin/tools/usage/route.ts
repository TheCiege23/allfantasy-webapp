import { withApiUsage } from "@/lib/telemetry/usage"
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic';

export const GET = withApiUsage({ endpoint: "/api/admin/tools/usage", tool: "AdminToolsUsage" })(async () => {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  try {
    const usage = {
      tools: [
        {
          name: "Trade Evaluator",
          endpoint: "/api/ai/trade-eval",
          calls24h: 0,
          callsTotal: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        },
        {
          name: "Waiver AI",
          endpoint: "/api/ai/waiver",
          calls24h: 0,
          callsTotal: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        },
        {
          name: "AI Chat",
          endpoint: "/api/ai/chat",
          calls24h: 0,
          callsTotal: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        },
        {
          name: "Legacy Import",
          endpoint: "/api/legacy/import",
          calls24h: 0,
          callsTotal: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        },
        {
          name: "Share (Grok)",
          endpoint: "/api/legacy/share",
          calls24h: 0,
          callsTotal: 0,
          avgLatencyMs: 0,
          errorRate: 0,
        },
      ],
      ai: {
        openai: {
          tokensUsed24h: 0,
          tokensUsedTotal: 0,
          costEstimate24h: 0,
          costEstimateTotal: 0,
        },
        grok: {
          tokensUsed24h: 0,
          tokensUsedTotal: 0,
          costEstimate24h: 0,
          costEstimateTotal: 0,
        },
      },
      note: "Tool usage tracking is a placeholder. Add an AnalyticsEvent or ToolUsage table to populate real data.",
    };

    return NextResponse.json(usage);
  } catch (error) {
    console.error("Admin tools usage error:", error);
    return NextResponse.json({ error: "Failed to load tool usage" }, { status: 500 });
  }
})
