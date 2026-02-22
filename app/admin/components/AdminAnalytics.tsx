"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type AnalyticsRow = {
  id: string;
  event: string;
  toolKey: string | null;
  path: string | null;
  userId: string | null;
  emailHash: string | null;
  sessionId: string | null;
  userAgent: string | null;
  referrer: string | null;
  meta: any;
  createdAt: string;
};

type ApiResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  rows: AnalyticsRow[];
};

type LegacyToolStat = {
  tool: string;
  toolLabel: string;
  totalUses: number;
  uniqueUsers: number;
};

type PeriodToolStat = {
  tool: string;
  toolLabel: string;
  uses: number;
  uniqueUsers: number;
};

type TimePeriod = {
  key: string;
  label: string;
  hours: number;
  totalUses: number;
  uniqueUsers: number;
  newUsers: number;
  repeatUsers: number;
  tools: PeriodToolStat[];
};

type SessionInsights = {
  totalSessions: number;
  avgDurationMinutes: number;
  medianDurationMinutes: number;
  multiToolSessions: number;
  multiToolRate: number;
};

type LegacyUsageResponse = {
  ok: boolean;
  summary: {
    totalToolUses: number;
    totalUniqueUsers: number;
  };
  tools: LegacyToolStat[];
  periods: TimePeriod[];
  sessionInsights: SessionInsights;
  timePeriods: { key: string; label: string }[];
};

type RetentionCohort = {
  label: string;
  totalUsers: number;
  returnedUsers: number;
  retentionRate: number;
};

type RetentionData = {
  ok: boolean;
  windowDays: number;
  cohortSizeDays: number;
  cohorts: RetentionCohort[];
  valueCohorts: RetentionCohort[];
  funnel: {
    newUsers: number;
    didCore: number;
    didRepeat: number;
    didBreadth: number;
  };
  overall: { totalUsers: number; returnedUsers: number; retentionRate: number; valueReturnedUsers: number; valueRetentionRate: number };
  activation: {
    coreEvents: string[];
    rate24h: number;
    rate7d: number;
    activated24h: number;
    activated7d: number;
    totalUsers: number;
    timeToFirstValue: {
      medianMinutes: number | null;
      medianFormatted: string | null;
      sampleSize: number;
    };
  };
  stickiness: {
    dau: number;
    wau: number;
    mau: number;
    dauWau: number;
    wauMau: number;
  };
  activity: {
    totalEvents: number;
    uniqueActiveUsers: number;
    breakdown: { eventType: string; count: number }[];
  };
  productHealth: {
    newUsers30d: number;
    activation24h: { rate: number; activated: number; total: number };
    activation7d: { rate: number; activated: number; total: number };
    timeToFirstValue: { medianMinutes: number | null; medianFormatted: string | null; sampleSize: number };
    valueRetention7d: { week0Users: number; retainedUsers: number; rate: number };
    depthOfEngagement: {
      activatedUsers: number;
      avgRunsPerUser: number;
      multiToolPct: number;
      multiToolUsers: number;
      powerUserPct: number;
      powerUsers: number;
    };
    chatAmplifier: {
      chatAdoptionPct: number;
      chatUsers: number;
      activatedUsers: number;
      chatRetentionRate: number;
      noChatRetentionRate: number;
      retentionMultiplier: number;
    };
    toolBreakdown7d: {
      tool: string;
      eventType: string;
      totalUses: number;
      uniqueUsers: number;
      users1x: number;
      users2_3x: number;
      users4_9x: number;
      users10xPlus: number;
    }[];
    oneAndDone: {
      userId: string;
      username: string;
      displayName: string | null;
      signupAt: string;
    }[];
  };
};

type StickinessUser = {
  userId: string;
  username: string;
  displayName: string | null;
  uses: number;
  distinctDays: number;
  lastUse: string;
};

type ToolRepeatRate = {
  eventType: string;
  totalUsers: number;
  repeatUsers: number;
  repeatRate: number;
};

type CompletionRate = {
  tool: string;
  started: number;
  completed: number;
  completionRate: number;
  dropOff: number;
  dropOffRate: number;
};

type StickinessData = {
  ok: boolean;
  days: number;
  eventFilter: string | null;
  summary: {
    totalUses: number;
    totalUsers: number;
    avgUsesPerUser: number;
    powerUsers: number;
    regularUsers: number;
    oneAndDone: number;
  };
  users: StickinessUser[];
  eventTypeBreakdown: { eventType: string; count: number; uniqueUsers: number }[];
  dailyActivity: { day: string; events: number; uniqueUsers: number }[];
  toolDistribution: Record<string, { bucket: string; userCount: number }[]>;
  toolRepeatRate: ToolRepeatRate[];
  completionRates: CompletionRate[];
};

type SourceQualityRow = {
  source: string;
  users: number;
  activated7d: number;
  activationRate7d: number;
  valueRetained7d: number;
  valueRetentionRate7d: number;
  avgCoreEvents: number;
  totalCoreEvents: number;
};

type SourceQualityData = {
  ok: boolean;
  sources: SourceQualityRow[];
  totalUsers: number;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
      style={{ background: "var(--accent)", color: "#fff", opacity: 0.9 }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.9")}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      {label || "Export CSV"}
    </button>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function RetentionPanel() {
  const [retention, setRetention] = useState<RetentionData | null>(null);
  const [stickiness, setStickiness] = useState<StickinessData | null>(null);
  const [loading, setLoading] = useState(false);
  const [retentionWindow, setRetentionWindow] = useState(7);
  const [stickyDays, setStickyDays] = useState(7);
  const [stickyEvent, setStickyEvent] = useState("");
  const [sourceQuality, setSourceQuality] = useState<SourceQualityData | null>(null);
  const [activeTab, setActiveTab] = useState<"health" | "retention" | "stickiness" | "sources">("health");

  const loadRetention = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/retention?window=${retentionWindow}`, { cache: "no-store" });
      if (res.ok) setRetention(await res.json());
    } catch {}
    setLoading(false);
  }, [retentionWindow]);

  const loadStickiness = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: String(stickyDays) });
      if (stickyEvent) params.set("event", stickyEvent);
      const res = await fetch(`/api/admin/analytics/stickiness?${params}`, { cache: "no-store" });
      if (res.ok) setStickiness(await res.json());
    } catch {}
    setLoading(false);
  }, [stickyDays, stickyEvent]);

  const loadSourceQuality = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics/source-quality", { cache: "no-store" });
      if (res.ok) setSourceQuality(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadRetention(); }, [loadRetention]);
  useEffect(() => { loadStickiness(); }, [loadStickiness]);
  useEffect(() => { if (activeTab === "sources" && !sourceQuality) loadSourceQuality(); }, [activeTab, sourceQuality, loadSourceQuality]);

  const eventOptions = stickiness?.eventTypeBreakdown?.map((e) => e.eventType) || [];
  const executive = retention?.overall
    ? {
        uniqueUsers: retention.overall.totalUsers,
        returningUsers: retention.overall.returnedUsers,
        returningRate: retention.overall.retentionRate,
        valueReturningUsers: retention.overall.valueReturnedUsers,
        valueReturningRate: retention.overall.valueRetentionRate,
      }
    : null;

  return (
    <div className="mb-8">
      {executive && (
        <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 4%, transparent)" }}>
          <div className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
            Executive Snapshot (Legacy Tools)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Unique users</div>
              <div className="text-xl font-semibold tabular-nums">{executive.uniqueUsers.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Returning users</div>
              <div className="text-xl font-semibold tabular-nums">{executive.returningUsers.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Returning rate</div>
              <div className="text-xl font-semibold tabular-nums">{executive.returningRate}%</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Returning + completed core action</div>
              <div className="text-xl font-semibold tabular-nums">{executive.valueReturningUsers.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs" style={{ color: "var(--muted)" }}>Value return rate</div>
              <div className="text-xl font-semibold tabular-nums">{executive.valueReturningRate}%</div>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Use this block for a quick non-technical read: how many people used legacy tools, how many came back, and how many came back and completed a meaningful action.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base sm:text-xl font-semibold" style={{ color: "var(--text)" }}>
          Retention & Stickiness
        </h2>
        <button
          className="px-3 py-1.5 rounded-lg border text-sm"
          style={{ borderColor: "var(--border)", background: "transparent" }}
          onClick={() => { loadRetention(); loadStickiness(); if (sourceQuality) loadSourceQuality(); }}
          disabled={loading}
        >
          {loading ? "Loading\u2026" : "Refresh"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["health", "retention", "stickiness", "sources"] as const).map((tab) => {
          const labels: Record<string, string> = { health: "Product Health", retention: "Retention Cohorts", stickiness: "Tool Stickiness", sources: "Sources" };
          return (
            <button
              key={tab}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: activeTab === tab ? "var(--accent)" : "transparent",
                color: activeTab === tab ? "#fff" : "var(--muted)",
                border: activeTab === tab ? "none" : "1px solid var(--border)",
              }}
              onClick={() => setActiveTab(tab)}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {activeTab === "health" && retention?.productHealth && (
        <div>
          <div className="rounded-xl border p-5 mb-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(168,85,247,0.08), rgba(34,197,94,0.08))" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>Product Health (Last 30 Days)</div>
              <ExportButton
                label="Export Health CSV"
                onClick={() => {
                  const ph = retention.productHealth;
                  const headers = ["Metric", "Value", "Detail"];
                  const rows: string[][] = [
                    ["New Users (30d)", String(ph.newUsers30d), ""],
                    ["24h Activation Rate", `${ph.activation24h.rate}%`, `${ph.activation24h.activated}/${ph.activation24h.total}`],
                    ["7d Activation Rate", `${ph.activation7d.rate}%`, `${ph.activation7d.activated}/${ph.activation7d.total}`],
                    ["Median Time to First Value", ph.timeToFirstValue.medianFormatted || "N/A", `${ph.timeToFirstValue.sampleSize} samples`],
                    ["7d Value Retention", `${ph.valueRetention7d.rate}%`, `${ph.valueRetention7d.retainedUsers}/${ph.valueRetention7d.week0Users}`],
                    ["Avg Analyzer Runs / Activated User", String(ph.depthOfEngagement.avgRunsPerUser), `${ph.depthOfEngagement.activatedUsers} activated`],
                    ["Multi-Tool Users", `${ph.depthOfEngagement.multiToolPct}%`, `${ph.depthOfEngagement.multiToolUsers} users used 2+ analyzers`],
                    ["Power Users (3+ runs)", `${ph.depthOfEngagement.powerUserPct}%`, `${ph.depthOfEngagement.powerUsers} users`],
                    ["AI Chat Adoption", `${ph.chatAmplifier.chatAdoptionPct}%`, `${ph.chatAmplifier.chatUsers}/${ph.chatAmplifier.activatedUsers} activated users`],
                    ["Chat User Retention", `${ph.chatAmplifier.chatRetentionRate}%`, "vs " + ph.chatAmplifier.noChatRetentionRate + "% without chat"],
                    ["Retention Multiplier", `${ph.chatAmplifier.retentionMultiplier}x`, "chat users vs non-chat"],
                  ];
                  downloadCsv("product_health_30d.csv", headers, rows);
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{retention.productHealth.newUsers30d}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>New Users</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: retention.productHealth.activation24h.rate >= 50 ? "#22c55e" : retention.productHealth.activation24h.rate >= 30 ? "#eab308" : "#ef4444" }}>
                  {retention.productHealth.activation24h.rate}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>24h Activation</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.activation24h.activated}/{retention.productHealth.activation24h.total}</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: retention.productHealth.activation7d.rate >= 60 ? "#22c55e" : retention.productHealth.activation7d.rate >= 40 ? "#eab308" : "#ef4444" }}>
                  {retention.productHealth.activation7d.rate}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>7d Activation</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.activation7d.activated}/{retention.productHealth.activation7d.total}</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
                  {retention.productHealth.timeToFirstValue.medianFormatted || "N/A"}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Time to First Value</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.timeToFirstValue.sampleSize} users measured</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: retention.productHealth.valueRetention7d.rate >= 40 ? "#22c55e" : retention.productHealth.valueRetention7d.rate >= 20 ? "#eab308" : "#ef4444" }}>
                  {retention.productHealth.valueRetention7d.rate}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>7d Value Retention</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.valueRetention7d.retainedUsers}/{retention.productHealth.valueRetention7d.week0Users} week-over-week</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
                  {retention.productHealth.depthOfEngagement.avgRunsPerUser}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Avg Runs / Activated User</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.depthOfEngagement.activatedUsers} activated users</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: retention.productHealth.depthOfEngagement.multiToolPct >= 25 ? "#22c55e" : retention.productHealth.depthOfEngagement.multiToolPct >= 10 ? "#eab308" : "#ef4444" }}>
                  {retention.productHealth.depthOfEngagement.multiToolPct}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Multi-Tool Users</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.depthOfEngagement.multiToolUsers} used 2+ analyzers</div>
              </div>
              <div className="p-4 rounded-xl border bg-white/5" style={{ borderColor: "var(--border)" }}>
                <div className="text-2xl font-bold tabular-nums" style={{ color: retention.productHealth.depthOfEngagement.powerUserPct >= 30 ? "#22c55e" : retention.productHealth.depthOfEngagement.powerUserPct >= 15 ? "#eab308" : "#ef4444" }}>
                  {retention.productHealth.depthOfEngagement.powerUserPct}%
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>3+ Total Analyses</div>
                <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>{retention.productHealth.depthOfEngagement.powerUsers} power users</div>
              </div>
            </div>

            <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "rgba(168,85,247,0.06)" }}>
              <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                AI Chat — Engagement Amplifier
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold tabular-nums" style={{ color: "#a855f7" }}>
                    {retention.productHealth.chatAmplifier.chatAdoptionPct}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    of activated users also used AI Chat
                  </div>
                  <div className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
                    {retention.productHealth.chatAmplifier.chatUsers}/{retention.productHealth.chatAmplifier.activatedUsers}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: "#22c55e" }}>
                        {retention.productHealth.chatAmplifier.chatRetentionRate}%
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--muted)" }}>w/ Chat</div>
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>vs</div>
                    <div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: "var(--muted)" }}>
                        {retention.productHealth.chatAmplifier.noChatRetentionRate}%
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--muted)" }}>w/o Chat</div>
                    </div>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>7d Retention Comparison</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold tabular-nums" style={{ color: retention.productHealth.chatAmplifier.retentionMultiplier >= 1.5 ? "#22c55e" : retention.productHealth.chatAmplifier.retentionMultiplier >= 1.0 ? "#eab308" : "var(--muted)" }}>
                    {retention.productHealth.chatAmplifier.retentionMultiplier}x
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    Retention Multiplier
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                    Chat users vs non-chat
                  </div>
                </div>
              </div>
            </div>

            {retention.productHealth.toolBreakdown7d && retention.productHealth.toolBreakdown7d.length > 0 && (
              <div className="rounded-xl border overflow-hidden mt-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-sm font-medium p-3 flex items-center justify-between" style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  <span>Per-Tool Usage (Last 7 Days)</span>
                  <ExportButton
                    label="Export Tools CSV"
                    onClick={() => {
                      const headers = ["Tool", "Total Uses", "Unique Users", "1x Users", "2-3x Users", "4-9x Users", "10+ Users"];
                      const rows = retention.productHealth.toolBreakdown7d.map((t) => [t.tool, String(t.totalUses), String(t.uniqueUsers), String(t.users1x), String(t.users2_3x), String(t.users4_9x), String(t.users10xPlus)]);
                      downloadCsv("tool_breakdown_7d.csv", headers, rows);
                    }}
                  />
                </div>
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    <tr>
                      <th className="p-3 text-left text-xs">Tool</th>
                      <th className="p-3 text-right text-xs">Uses</th>
                      <th className="p-3 text-right text-xs">Users</th>
                      <th className="p-3 text-right text-xs">1x</th>
                      <th className="p-3 text-right text-xs">2-3x</th>
                      <th className="p-3 text-right text-xs">4-9x</th>
                      <th className="p-3 text-right text-xs">10+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retention.productHealth.toolBreakdown7d.map((t) => {
                      const total = t.uniqueUsers || 1;
                      return (
                        <tr key={t.eventType} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                          <td className="p-3 text-xs font-medium" style={{ color: "var(--text)" }}>{t.tool}</td>
                          <td className="p-3 text-right tabular-nums text-xs">{t.totalUses}</td>
                          <td className="p-3 text-right tabular-nums text-xs">{t.uniqueUsers}</td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: "var(--muted)" }}>{t.users1x}</span>
                            <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>({Math.round((t.users1x / total) * 100)}%)</span>
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: "#60a5fa" }}>{t.users2_3x}</span>
                            <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>({Math.round((t.users2_3x / total) * 100)}%)</span>
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: "#a855f7" }}>{t.users4_9x}</span>
                            <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>({Math.round((t.users4_9x / total) * 100)}%)</span>
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: "#22c55e" }}>{t.users10xPlus}</span>
                            <span className="text-[10px] ml-1" style={{ color: "var(--muted)" }}>({Math.round((t.users10xPlus / total) * 100)}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-3 flex gap-3 text-[10px]" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                  {retention.productHealth.toolBreakdown7d.map((t) => {
                    const repeatPct = t.uniqueUsers > 0 ? Math.round(((t.uniqueUsers - t.users1x) / t.uniqueUsers) * 100) : 0;
                    return (
                      <span key={t.eventType}>
                        {t.tool}: <span style={{ color: repeatPct >= 30 ? "#22c55e" : repeatPct >= 15 ? "#eab308" : "#ef4444" }}>{repeatPct}% repeat</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {retention.productHealth.oneAndDone && retention.productHealth.oneAndDone.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium p-3" style={{ color: "#ef4444", borderBottom: "1px solid var(--border)" }}>
                    One-and-Done (signed up in 7d, 0 analyzer runs)
                  </div>
                  <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    {retention.productHealth.oneAndDone.slice(0, 10).map((u) => (
                      <div key={u.userId} className="px-3 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium" style={{ color: "var(--text)" }}>{u.displayName || u.username}</div>
                          {u.displayName && <div className="text-[10px]" style={{ color: "var(--muted)" }}>{u.username}</div>}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--muted)" }}>{fmtDate(u.signupAt)}</div>
                      </div>
                    ))}
                  </div>
                  {retention.productHealth.oneAndDone.length > 10 && (
                    <div className="p-2 text-center text-[10px]" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                      +{retention.productHealth.oneAndDone.length - 10} more
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 text-[10px] text-center" style={{ color: "var(--muted)" }}>
              Core analyzers: Trade Analyzer, Rankings, Waiver AI. AI Chat tracked separately as engagement amplifier.
              <br />Activation: last 30d signups. TTFV: percentile_cont median. Value Retention: per-user week 0→1 (60d cohort). Depth: 30d. Tool breakdown: 7d.
            </div>
          </div>
        </div>
      )}

      {activeTab === "health" && !retention?.productHealth && (
        <div className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
          {loading ? "Loading product health data..." : "No product health data available. Click Refresh to load."}
        </div>
      )}

      {activeTab === "retention" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm" style={{ color: "var(--muted)" }}>Window:</label>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className="px-3 py-1 rounded text-sm"
                style={{
                  background: retentionWindow === d ? "var(--accent)" : "transparent",
                  color: retentionWindow === d ? "#fff" : "var(--muted)",
                  border: `1px solid ${retentionWindow === d ? "var(--accent)" : "var(--border)"}`,
                }}
                onClick={() => setRetentionWindow(d)}
              >
                {d}d
              </button>
            ))}
          </div>

          {retention && (
            <>
              <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(6,182,212,0.05), rgba(168,85,247,0.05))" }}>
                <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                  Activation
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                    User completes a core action (trade analysis, rankings, waiver, or AI chat)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                    <div className="text-2xl font-bold text-cyan-300">{retention.activation.rate24h}%</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>24h Activation</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      {retention.activation.activated24h}/{retention.activation.totalUsers} users
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5">
                    <div className="text-2xl font-bold text-purple-300">{retention.activation.rate7d}%</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>7d Activation</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      {retention.activation.activated7d}/{retention.activation.totalUsers} users
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                    <div className="text-2xl font-bold text-green-300">
                      {retention.activation.timeToFirstValue.medianFormatted || "N/A"}
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Time to First Value</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      median, n={retention.activation.timeToFirstValue.sampleSize}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <div className="text-2xl font-bold text-amber-300">
                      {retention.activation.totalUsers - retention.activation.activated7d}
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Never Activated</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      signed up but no core action in 7d
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(59,130,246,0.05), rgba(6,182,212,0.05))" }}>
                <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                  Stickiness Ratios
                  <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                    Industry-standard engagement metrics
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="text-2xl font-bold text-blue-300">{retention.stickiness.dauWau}%</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>DAU / WAU</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>daily vs weekly</div>
                  </div>
                  <div className="p-3 rounded-lg border border-teal-500/20 bg-teal-500/5">
                    <div className="text-2xl font-bold text-teal-300">{retention.stickiness.wauMau}%</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>WAU / MAU</div>
                    <div className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>weekly vs monthly</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-500/20 bg-slate-500/5">
                    <div className="text-xl font-bold" style={{ color: "var(--text)" }}>{retention.stickiness.dau}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>DAU</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-500/20 bg-slate-500/5">
                    <div className="text-xl font-bold" style={{ color: "var(--text)" }}>{retention.stickiness.wau}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>WAU</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-500/20 bg-slate-500/5">
                    <div className="text-xl font-bold" style={{ color: "var(--text)" }}>{retention.stickiness.mau}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>MAU</div>
                  </div>
                </div>
              </div>

              {retention.funnel && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(168,85,247,0.05), rgba(6,182,212,0.05))" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                    User Funnel
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                      Last 30 days
                    </span>
                  </div>
                  {(() => {
                    const f = retention.funnel;
                    const steps = [
                      { label: "New Users", value: f.newUsers, color: "#94a3b8" },
                      { label: "Did Any Core Action", value: f.didCore, color: "#60a5fa" },
                      { label: "Repeated Same Tool", value: f.didRepeat, color: "#a78bfa" },
                      { label: "Used 2+ Different Tools", value: f.didBreadth, color: "#4ade80" },
                    ];
                    const max = Math.max(f.newUsers, 1);
                    return (
                      <div className="space-y-2">
                        {steps.map((step, i) => {
                          const pct = max > 0 ? Math.round((step.value / max) * 1000) / 10 : 0;
                          const convFromPrev = i > 0 && steps[i - 1].value > 0
                            ? Math.round((step.value / steps[i - 1].value) * 1000) / 10
                            : null;
                          return (
                            <div key={step.label}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{step.label}</span>
                                  {i > 0 && convFromPrev !== null && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted)" }}>
                                      {convFromPrev}% of prev
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs tabular-nums font-bold" style={{ color: step.color }}>{step.value}</span>
                                  <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>({pct}%)</span>
                                </div>
                              </div>
                              <div className="h-6 rounded bg-white/5 overflow-hidden relative">
                                <div
                                  className="h-full rounded transition-all"
                                  style={{ width: `${Math.max(pct, 1)}%`, background: step.color + "80" }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                  <div className="text-xl font-bold text-cyan-300">{retention.overall.retentionRate}%</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{retention.windowDays}-Day Login Retention</div>
                </div>
                <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                  <div className="text-xl font-bold text-green-300">{retention.overall.valueRetentionRate}%</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{retention.windowDays}-Day Value Retention</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted)" }}>quote this one</div>
                </div>
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <div className="text-xl font-bold text-purple-300">{retention.activity.uniqueActiveUsers}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Active Users</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-500/20 bg-slate-500/5">
                  <div className="text-xl font-bold" style={{ color: "var(--text)" }}>{retention.activity.totalEvents.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Total Events</div>
                </div>
              </div>

              <div className="flex justify-end mb-2">
                <ExportButton
                  label="Export Cohorts CSV"
                  onClick={() => {
                    if (!retention) return;
                    const headers = ["Type", "Cohort", "Total Users", "Returned/Valued", "Rate (%)"];
                    const rows: string[][] = [
                      ...retention.cohorts.map((c) => ["Login Retention", c.label, String(c.totalUsers), String(c.returnedUsers), String(c.retentionRate)]),
                      ...retention.valueCohorts.map((c) => ["Value Retention", c.label, String(c.totalUsers), String(c.returnedUsers), String(c.retentionRate)]),
                    ];
                    downloadCsv(`cohorts_${retention.cohortSizeDays}d_window${retention.windowDays}d.csv`, headers, rows);
                  }}
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs font-medium p-3 flex items-center gap-2" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <span className="w-2 h-2 rounded-full bg-cyan-500" />
                    Login Retention (returned &amp; logged in within {retention.windowDays}d)
                  </div>
                  <table className="w-full text-sm">
                    <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                      <tr>
                        <th className="p-2 text-left text-xs">Cohort</th>
                        <th className="p-2 text-right text-xs">Users</th>
                        <th className="p-2 text-right text-xs">Returned</th>
                        <th className="p-2 text-right text-xs">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retention.cohorts.map((c, i) => (
                        <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                          <td className="p-2 text-[11px]">{c.label}</td>
                          <td className="p-2 text-right tabular-nums text-xs">{c.totalUsers}</td>
                          <td className="p-2 text-right tabular-nums text-xs">{c.returnedUsers}</td>
                          <td className="p-2 text-right tabular-nums text-xs">
                            <span style={{ color: c.retentionRate >= 30 ? "#4ade80" : c.retentionRate >= 15 ? "#fbbf24" : "#ef4444" }}>
                              {c.retentionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {retention.cohorts.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-xs" style={{ color: "var(--muted)" }}>No data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs font-medium p-3 flex items-center gap-2" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    Value Retention (returned &amp; completed a core action within {retention.windowDays}d)
                  </div>
                  <table className="w-full text-sm">
                    <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                      <tr>
                        <th className="p-2 text-left text-xs">Cohort</th>
                        <th className="p-2 text-right text-xs">Users</th>
                        <th className="p-2 text-right text-xs">Valued</th>
                        <th className="p-2 text-right text-xs">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {retention.valueCohorts.map((c, i) => (
                        <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                          <td className="p-2 text-[11px]">{c.label}</td>
                          <td className="p-2 text-right tabular-nums text-xs">{c.totalUsers}</td>
                          <td className="p-2 text-right tabular-nums text-xs">{c.returnedUsers}</td>
                          <td className="p-2 text-right tabular-nums text-xs">
                            <span style={{ color: c.retentionRate >= 30 ? "#4ade80" : c.retentionRate >= 15 ? "#fbbf24" : "#ef4444" }}>
                              {c.retentionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {retention.valueCohorts.length === 0 && (
                        <tr><td colSpan={4} className="p-4 text-center text-xs" style={{ color: "var(--muted)" }}>No data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {retention.activity.breakdown.length > 0 && (
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Event Breakdown (All Time)</div>
                  <div className="space-y-2">
                    {retention.activity.breakdown.map((e) => {
                      const maxCount = retention.activity.breakdown[0]?.count || 1;
                      return (
                        <div key={e.eventType} className="flex items-center gap-3">
                          <div className="text-xs w-48 truncate" style={{ color: "var(--muted)" }}>{e.eventType}</div>
                          <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded bg-cyan-500/60"
                              style={{ width: `${Math.max(2, (e.count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <div className="text-xs tabular-nums w-12 text-right" style={{ color: "var(--muted)" }}>{e.count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "stickiness" && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <label className="text-sm" style={{ color: "var(--muted)" }}>Period:</label>
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                className="px-3 py-1 rounded text-sm"
                style={{
                  background: stickyDays === d ? "var(--accent)" : "transparent",
                  color: stickyDays === d ? "#fff" : "var(--muted)",
                  border: `1px solid ${stickyDays === d ? "var(--accent)" : "var(--border)"}`,
                }}
                onClick={() => setStickyDays(d)}
              >
                {d}d
              </button>
            ))}
            <select
              className="px-3 py-1 rounded text-sm border"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
              value={stickyEvent}
              onChange={(e) => setStickyEvent(e.target.value)}
            >
              <option value="">All Events</option>
              {eventOptions.map((ev) => (
                <option key={ev} value={ev}>{ev}</option>
              ))}
            </select>
          </div>

          {stickiness && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                  <div className="text-xl font-bold text-cyan-300">{stickiness.summary.avgUsesPerUser}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Avg Uses/User</div>
                </div>
                <div className="p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                  <div className="text-xl font-bold text-green-300">{stickiness.summary.powerUsers}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Power Users (5+)</div>
                </div>
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <div className="text-xl font-bold text-purple-300">{stickiness.summary.regularUsers}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>Regular (2-4)</div>
                </div>
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <div className="text-xl font-bold text-amber-300">{stickiness.summary.oneAndDone}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>One-and-Done</div>
                </div>
              </div>

              {stickiness.completionRates && stickiness.completionRates.length > 0 && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Completion Rates (Started → Completed)</div>
                  <div className="space-y-3">
                    {stickiness.completionRates.map((cr) => (
                      <div key={cr.tool}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: "var(--text)" }}>{cr.tool}</span>
                          <span style={{ color: cr.completionRate >= 80 ? "#22c55e" : cr.completionRate >= 50 ? "#eab308" : "#ef4444" }}>
                            {cr.completionRate}% ({cr.completed}/{cr.started})
                          </span>
                        </div>
                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(cr.completionRate, 100)}%`,
                              background: cr.completionRate >= 80 ? "#22c55e" : cr.completionRate >= 50 ? "#eab308" : "#ef4444",
                            }}
                          />
                        </div>
                        {cr.dropOff > 0 && (
                          <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                            {cr.dropOff} drop-offs ({cr.dropOffRate}%)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stickiness.dailyActivity.length > 0 && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Daily Activity</div>
                  <div className="flex items-end gap-1" style={{ height: 80 }}>
                    {stickiness.dailyActivity.map((d) => {
                      const maxEvents = Math.max(...stickiness.dailyActivity.map((x) => x.events), 1);
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.events} events, ${d.uniqueUsers} users`}>
                          <div
                            className="w-full rounded-t bg-cyan-500/70"
                            style={{ height: `${Math.max(4, (d.events / maxEvents) * 70)}px` }}
                          />
                          <div className="text-[8px] truncate w-full text-center" style={{ color: "var(--muted)" }}>{d.day.slice(5)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stickiness.eventTypeBreakdown.length > 0 && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Tool Breakdown ({stickiness.days}d)</div>
                  <div className="space-y-2">
                    {stickiness.eventTypeBreakdown.map((e) => {
                      const max = stickiness.eventTypeBreakdown[0]?.count || 1;
                      return (
                        <div key={e.eventType} className="flex items-center gap-3">
                          <div className="text-xs w-48 truncate" style={{ color: "var(--muted)" }}>{e.eventType}</div>
                          <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                            <div className="h-full rounded bg-purple-500/60" style={{ width: `${Math.max(2, (e.count / max) * 100)}%` }} />
                          </div>
                          <div className="text-xs tabular-nums w-20 text-right" style={{ color: "var(--muted)" }}>{e.count} ({e.uniqueUsers}u)</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {stickiness.toolRepeatRate && stickiness.toolRepeatRate.length > 0 && (
                <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(59,130,246,0.05), rgba(168,85,247,0.05))" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
                    Tool Repeat Usage ({stickiness.days}d)
                    <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
                      Distribution of how many times each user used a tool
                    </span>
                  </div>
                  <div className="space-y-4">
                    {stickiness.toolRepeatRate.map((tool) => {
                      const dist = stickiness.toolDistribution[tool.eventType] || [];
                      const total = tool.totalUsers;
                      const bucketOrder = ["1", "2-3", "4-9", "10+"];
                      const bucketColors: Record<string, string> = {
                        "1": "bg-slate-500/60",
                        "2-3": "bg-blue-500/60",
                        "4-9": "bg-purple-500/60",
                        "10+": "bg-green-500/60",
                      };
                      const bucketLabels: Record<string, string> = {
                        "1": "1 use",
                        "2-3": "2\u20133",
                        "4-9": "4\u20139",
                        "10+": "10+",
                      };
                      return (
                        <div key={tool.eventType}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs truncate" style={{ color: "var(--text)" }}>{tool.eventType}</div>
                            <div className="text-xs font-medium" style={{ color: tool.repeatRate >= 40 ? "#4ade80" : tool.repeatRate >= 20 ? "#60a5fa" : "var(--muted)" }}>
                              {tool.repeatRate}% used 2+ times
                            </div>
                          </div>
                          <div className="flex h-5 rounded overflow-hidden bg-white/5">
                            {bucketOrder.map((bucket) => {
                              const found = dist.find((d) => d.bucket === bucket);
                              const count = found?.userCount || 0;
                              const pct = total > 0 ? (count / total) * 100 : 0;
                              if (pct === 0) return null;
                              return (
                                <div
                                  key={bucket}
                                  className={`${bucketColors[bucket]} flex items-center justify-center`}
                                  style={{ width: `${Math.max(pct, 3)}%` }}
                                  title={`${bucketLabels[bucket]}: ${count} users (${Math.round(pct)}%)`}
                                >
                                  {pct >= 10 && <span className="text-[9px] text-white font-medium">{Math.round(pct)}%</span>}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-3 mt-1">
                            {bucketOrder.map((bucket) => {
                              const found = dist.find((d) => d.bucket === bucket);
                              const count = found?.userCount || 0;
                              return (
                                <div key={bucket} className="flex items-center gap-1">
                                  <div className={`w-2 h-2 rounded-sm ${bucketColors[bucket]}`} />
                                  <span className="text-[9px]" style={{ color: "var(--muted)" }}>{bucketLabels[bucket]}: {count}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <div className="text-sm font-medium p-3 flex items-center justify-between" style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  <span>Top Users ({stickiness.days}d){stickyEvent ? ` \u2014 ${stickyEvent}` : ""}</span>
                  <ExportButton
                    label="Export Users CSV"
                    onClick={() => {
                      if (!stickiness) return;
                      const headers = ["Username", "Display Name", "Total Uses", "Active Days", "Last Active"];
                      const rows = stickiness.users.map((u) => [u.username, u.displayName || "", String(u.uses), String(u.distinctDays), u.lastUse]);
                      downloadCsv(`tool_usage_per_user_${stickiness.days}d${stickyEvent ? `_${stickyEvent}` : ""}.csv`, headers, rows);
                    }}
                  />
                </div>
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    <tr>
                      <th className="p-3 text-left">User</th>
                      <th className="p-3 text-right">Uses</th>
                      <th className="p-3 text-right">Active Days</th>
                      <th className="p-3 text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stickiness.users.slice(0, 20).map((u) => (
                      <tr key={u.userId} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                        <td className="p-3">
                          <div className="font-medium">{u.displayName || u.username}</div>
                          {u.displayName && <div className="text-xs" style={{ color: "var(--muted)" }}>{u.username}</div>}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          <span style={{ color: u.uses >= 5 ? "#4ade80" : u.uses >= 2 ? "#fbbf24" : "#ef4444" }}>
                            {u.uses}
                          </span>
                        </td>
                        <td className="p-3 text-right tabular-nums">{u.distinctDays}</td>
                        <td className="p-3 text-right text-xs" style={{ color: "var(--muted)" }}>{fmtDate(u.lastUse)}</td>
                      </tr>
                    ))}
                    {stickiness.users.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center" style={{ color: "var(--muted)" }}>No user activity in this period</td></tr>
                    )}
                  </tbody>
                </table>
                {stickiness.users.length > 20 && (
                  <div className="p-3 text-center text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                    Showing top 20 of {stickiness.users.length} users
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "sources" && (
        <div>
          {!sourceQuality ? (
            <div className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>Loading source quality data...</div>
          ) : sourceQuality.sources.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)" }}>
              <div className="text-sm" style={{ color: "var(--muted)" }}>
                No traffic source data yet. Source tracking begins when users log in with referrer/UTM data attached.
              </div>
              <div className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                Use UTM parameters on your links (e.g. ?utm_source=google) to start tracking acquisition quality.
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs font-medium p-3 flex items-center justify-between" style={{ color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <span>Per-Source Quality ({sourceQuality.totalUsers} total users)</span>
                  <div className="flex items-center gap-3">
                    <span>Core actions: trade analysis, rankings, waiver, AI chat</span>
                    <ExportButton
                      label="Export Sources CSV"
                      onClick={() => {
                        if (!sourceQuality) return;
                        const headers = ["Source", "Users", "Activated (7d)", "Activation Rate (%)", "Value Retained (7d)", "Value Retention Rate (%)", "Avg Core Events", "Total Core Events"];
                        const rows = sourceQuality.sources.map((s) => [s.source, String(s.users), String(s.activated7d), String(s.activationRate7d), String(s.valueRetained7d), String(s.valueRetentionRate7d), String(s.avgCoreEvents), String(s.totalCoreEvents)]);
                        downloadCsv("source_quality.csv", headers, rows);
                      }}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                      <tr>
                        <th className="p-3 text-left text-xs">Source</th>
                        <th className="p-3 text-right text-xs">Users</th>
                        <th className="p-3 text-right text-xs">Activated (7d)</th>
                        <th className="p-3 text-right text-xs">Value Retained (7d)</th>
                        <th className="p-3 text-right text-xs">Avg Core Events / User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourceQuality.sources.map((s) => (
                        <tr key={s.source} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                          <td className="p-3 text-xs font-medium" style={{ color: "var(--text)" }}>{s.source}</td>
                          <td className="p-3 text-right tabular-nums text-xs">{s.users}</td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: s.activationRate7d >= 40 ? "#4ade80" : s.activationRate7d >= 20 ? "#fbbf24" : "#ef4444" }}>
                              {s.activationRate7d}%
                            </span>
                            <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>({s.activated7d})</span>
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: s.valueRetentionRate7d >= 30 ? "#4ade80" : s.valueRetentionRate7d >= 15 ? "#fbbf24" : "#ef4444" }}>
                              {s.valueRetentionRate7d}%
                            </span>
                            <span className="ml-1 text-[10px]" style={{ color: "var(--muted)" }}>({s.valueRetained7d})</span>
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            <span style={{ color: s.avgCoreEvents >= 3 ? "#4ade80" : s.avgCoreEvents >= 1 ? "#60a5fa" : "var(--muted)" }}>
                              {s.avgCoreEvents}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {sourceQuality.sources.length > 1 && (
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, rgba(6,182,212,0.05), rgba(168,85,247,0.05))" }}>
                  <div className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Activation Rate by Source</div>
                  <div className="space-y-2">
                    {sourceQuality.sources.map((s) => {
                      const maxRate = Math.max(...sourceQuality.sources.map(x => x.activationRate7d), 1);
                      return (
                        <div key={s.source} className="flex items-center gap-3">
                          <div className="text-xs w-28 truncate" style={{ color: "var(--text)" }}>{s.source}</div>
                          <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden relative">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${Math.max(2, (s.activationRate7d / maxRate) * 100)}%`,
                                background: s.activationRate7d >= 40 ? "rgba(74,222,128,0.5)" : s.activationRate7d >= 20 ? "rgba(251,191,36,0.5)" : "rgba(239,68,68,0.4)",
                              }}
                            />
                            {s.activationRate7d > 0 && (
                              <span className="absolute inset-y-0 flex items-center pl-2 text-[10px] font-medium text-white">
                                {s.activationRate7d}%
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] tabular-nums w-14 text-right" style={{ color: "var(--muted)" }}>{s.users} users</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [toolKey, setToolKey] = useState("");
  const [event, setEvent] = useState("");
  const [path, setPath] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [selected, setSelected] = useState<AnalyticsRow | null>(null);

  const [legacyUsage, setLegacyUsage] = useState<LegacyUsageResponse | null>(null);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("24h");
  const [legacyView, setLegacyView] = useState<"overview" | "tools" | "sessions">("overview");

  async function loadLegacyUsage() {
    setLegacyLoading(true);
    try {
      const res = await fetch("/api/admin/legacy-usage", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok) {
        setLegacyUsage(json as LegacyUsageResponse);
      }
    } catch (e) {
      console.error("Failed to load legacy usage:", e);
    } finally {
      setLegacyLoading(false);
    }
  }

  useEffect(() => {
    loadLegacyUsage();
  }, []);

  const activePeriod = useMemo(() => {
    if (!legacyUsage?.periods) return null;
    return legacyUsage.periods.find(p => p.key === selectedPeriod) || null;
  }, [legacyUsage, selectedPeriod]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (toolKey.trim()) sp.set("toolKey", toolKey.trim());
    if (event.trim()) sp.set("event", event.trim());
    if (path.trim()) sp.set("path", path.trim());

    if (from) sp.set("from", new Date(from + "T00:00:00.000Z").toISOString());
    if (to) sp.set("to", new Date(to + "T23:59:59.999Z").toISOString());

    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    return sp.toString();
  }, [q, toolKey, event, path, from, to, page, pageSize]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/analytics/events?${queryString}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse | { error: string };
      if (!res.ok) throw new Error((json as any).error || "Failed to load");
      setData(json as ApiResponse);
    } catch (e: any) {
      setErr(String(e?.message || "Failed to load analytics"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const totalPages = useMemo(() => {
    const total = data?.total || 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  function resetFilters() {
    setQ("");
    setToolKey("");
    setEvent("");
    setPath("");
    setFrom("");
    setTo("");
    setPage(1);
    setSelected(null);
  }

  return (
    <div className="w-full">
      <RetentionPanel />

      {/* Legacy Tool Usage Dashboard */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base sm:text-xl font-semibold" style={{ color: "var(--text)" }}>Legacy Tool Traffic Dashboard</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Real-time usage metrics across all legacy tools — traffic, engagement, and user activity
            </p>
          </div>
          <button
            className="px-3 py-2 rounded-lg border text-sm"
            style={{ borderColor: "var(--border)", background: "transparent" }}
            onClick={() => loadLegacyUsage()}
            disabled={legacyLoading}
          >
            {legacyLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {legacyUsage && (
          <>
            {/* All-time summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                <div className="text-2xl font-bold text-cyan-300 tabular-nums">{legacyUsage.summary.totalToolUses.toLocaleString()}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Total Tool Uses (All Time)</div>
              </div>
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <div className="text-2xl font-bold text-purple-300 tabular-nums">{legacyUsage.summary.totalUniqueUsers.toLocaleString()}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Unique Users (All Time)</div>
              </div>
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <div className="text-2xl font-bold text-amber-300 tabular-nums">{legacyUsage.sessionInsights?.avgDurationMinutes ?? 0} min</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Avg Session Duration</div>
              </div>
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <div className="text-2xl font-bold text-emerald-300 tabular-nums">{legacyUsage.sessionInsights?.multiToolRate ?? 0}%</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Multi-Tool Sessions</div>
              </div>
            </div>

            {/* View tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ background: "color-mix(in srgb, var(--text) 8%, transparent)" }}>
              {([
                { key: "overview" as const, label: "Time Periods" },
                { key: "tools" as const, label: "All Tools" },
                { key: "sessions" as const, label: "Sessions" },
              ]).map(tab => (
                <button
                  key={tab.key}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${legacyView === tab.key ? "text-white" : ""}`}
                  style={{
                    background: legacyView === tab.key ? "var(--accent)" : "transparent",
                    color: legacyView === tab.key ? "white" : "var(--muted)",
                  }}
                  onClick={() => setLegacyView(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* === TIME PERIODS VIEW === */}
            {legacyView === "overview" && (
              <div className="space-y-4">
                {/* Period selector */}
                <div className="flex flex-wrap gap-2">
                  {(legacyUsage.timePeriods || []).map(tp => (
                    <button
                      key={tp.key}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedPeriod === tp.key ? "border-cyan-400 text-cyan-300" : ""}`}
                      style={{
                        borderColor: selectedPeriod === tp.key ? undefined : "var(--border)",
                        background: selectedPeriod === tp.key ? "rgba(34,211,238,0.1)" : "transparent",
                        color: selectedPeriod === tp.key ? undefined : "var(--text)",
                      }}
                      onClick={() => setSelectedPeriod(tp.key)}
                    >
                      {tp.label}
                    </button>
                  ))}
                </div>

                {activePeriod && (
                  <>
                    {/* Period stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                        <div className="text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{activePeriod.totalUses.toLocaleString()}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>Uses ({activePeriod.label})</div>
                      </div>
                      <div className="p-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                        <div className="text-xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{activePeriod.uniqueUsers.toLocaleString()}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>Unique Users</div>
                      </div>
                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                        <div className="text-xl font-bold text-emerald-300 tabular-nums">{activePeriod.newUsers.toLocaleString()}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>New Users</div>
                      </div>
                      <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5">
                        <div className="text-xl font-bold text-blue-300 tabular-nums">{activePeriod.repeatUsers.toLocaleString()}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>Repeat Users</div>
                      </div>
                    </div>

                    {/* Traffic comparison across all periods */}
                    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <div className="p-3 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderBottom: "1px solid var(--border)" }}>
                        Traffic Comparison Across All Periods
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                            <tr>
                              <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>Period</th>
                              <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Uses</th>
                              <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Users</th>
                              <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>New</th>
                              <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Repeat</th>
                              <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Repeat %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(legacyUsage.periods || []).map(p => {
                              const repeatPct = p.uniqueUsers > 0 ? Math.round((p.repeatUsers / p.uniqueUsers) * 100) : 0;
                              const isActive = p.key === selectedPeriod;
                              return (
                                <tr
                                  key={p.key}
                                  className={`border-b last:border-b-0 cursor-pointer transition-colors ${isActive ? "bg-cyan-500/10" : "hover:bg-white/5"}`}
                                  style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}
                                  onClick={() => setSelectedPeriod(p.key)}
                                >
                                  <td className="p-3 font-medium" style={{ color: isActive ? "#67e8f9" : "var(--text)" }}>{p.label}</td>
                                  <td className="p-3 text-right tabular-nums">{p.totalUses.toLocaleString()}</td>
                                  <td className="p-3 text-right tabular-nums">{p.uniqueUsers.toLocaleString()}</td>
                                  <td className="p-3 text-right tabular-nums text-emerald-400">{p.newUsers.toLocaleString()}</td>
                                  <td className="p-3 text-right tabular-nums text-blue-400">{p.repeatUsers.toLocaleString()}</td>
                                  <td className="p-3 text-right tabular-nums">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${repeatPct >= 50 ? "bg-blue-500/20 text-blue-300" : "bg-gray-500/20 text-gray-300"}`}>
                                      {repeatPct}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tool breakdown for selected period */}
                    {activePeriod.tools.length > 0 && (
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        <div className="p-3 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderBottom: "1px solid var(--border)" }}>
                          Tool Breakdown — {activePeriod.label}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                              <tr>
                                <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>Tool</th>
                                <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Uses</th>
                                <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Users</th>
                                <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>Activity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activePeriod.tools.map(t => {
                                const maxUses = activePeriod.tools[0]?.uses || 1;
                                const barWidth = Math.max(4, Math.round((t.uses / maxUses) * 100));
                                return (
                                  <tr key={t.tool} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                                    <td className="p-3 font-medium">{t.toolLabel}</td>
                                    <td className="p-3 text-right tabular-nums">{t.uses.toLocaleString()}</td>
                                    <td className="p-3 text-right tabular-nums">{t.uniqueUsers.toLocaleString()}</td>
                                    <td className="p-3">
                                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                                        <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${barWidth}%` }} />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activePeriod.tools.length === 0 && (
                      <div className="p-8 text-center rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                        No tool activity in the last {activePeriod.label.toLowerCase()}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* === ALL TOOLS VIEW === */}
            {legacyView === "tools" && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <div className="p-3 text-sm font-medium" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderBottom: "1px solid var(--border)" }}>
                  All-Time Tool Usage — {legacyUsage.tools.filter(t => t.totalUses > 0).length} active tools
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                      <tr>
                        <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>#</th>
                        <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>Tool</th>
                        <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Total Uses</th>
                        <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Unique Users</th>
                        <th className="p-3 text-right text-xs font-medium" style={{ color: "var(--muted)" }}>Avg Uses/User</th>
                        <th className="p-3 text-left text-xs font-medium" style={{ color: "var(--muted)" }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legacyUsage.tools.map((tool, idx) => {
                        const avgPerUser = tool.uniqueUsers > 0 ? (tool.totalUses / tool.uniqueUsers).toFixed(1) : "0";
                        const shareOfTotal = legacyUsage!.summary.totalToolUses > 0
                          ? Math.round((tool.totalUses / legacyUsage!.summary.totalToolUses) * 100)
                          : 0;
                        return (
                          <tr key={tool.tool} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                            <td className="p-3 tabular-nums" style={{ color: "var(--muted)" }}>{idx + 1}</td>
                            <td className="p-3 font-medium">{tool.toolLabel}</td>
                            <td className="p-3 text-right tabular-nums font-medium">{tool.totalUses.toLocaleString()}</td>
                            <td className="p-3 text-right tabular-nums">{tool.uniqueUsers.toLocaleString()}</td>
                            <td className="p-3 text-right tabular-nums">{avgPerUser}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                                  <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${shareOfTotal}%` }} />
                                </div>
                                <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>{shareOfTotal}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {legacyUsage.tools.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center" style={{ color: "var(--muted)" }}>
                            No tool usage data yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* === SESSIONS VIEW === */}
            {legacyView === "sessions" && legacyUsage.sessionInsights && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{legacyUsage.sessionInsights.totalSessions.toLocaleString()}</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Total Sessions (7d)</div>
                  </div>
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="text-2xl font-bold text-amber-300 tabular-nums">{legacyUsage.sessionInsights.avgDurationMinutes} min</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Avg Session Duration</div>
                  </div>
                  <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5">
                    <div className="text-2xl font-bold text-orange-300 tabular-nums">{legacyUsage.sessionInsights.medianDurationMinutes} min</div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Median Session Duration</div>
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="text-2xl font-bold text-emerald-300 tabular-nums">
                      {legacyUsage.sessionInsights.multiToolSessions.toLocaleString()}
                      <span className="text-sm font-normal ml-1">({legacyUsage.sessionInsights.multiToolRate}%)</span>
                    </div>
                    <div className="text-xs" style={{ color: "var(--muted)" }}>Multi-Tool Sessions</div>
                  </div>
                </div>

                <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                  <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>Session Engagement Summary</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: "var(--muted)" }}>Multi-Tool Engagement</span>
                        <span className="tabular-nums font-medium">{legacyUsage.sessionInsights.multiToolRate}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${legacyUsage.sessionInsights.multiToolRate}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Users spend on average</div>
                        <div className="text-lg font-bold" style={{ color: "var(--text)" }}>{legacyUsage.sessionInsights.avgDurationMinutes} minutes</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>per session using legacy tools</div>
                      </div>
                      <div>
                        <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>Half of sessions last at least</div>
                        <div className="text-lg font-bold" style={{ color: "var(--text)" }}>{legacyUsage.sessionInsights.medianDurationMinutes} minutes</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>median session duration</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!legacyUsage && !legacyLoading && (
          <div className="p-8 text-center rounded-xl border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            Click Refresh to load legacy tool traffic data
          </div>
        )}
      </div>

      <div className="h-px my-8" style={{ background: "var(--border)" }} />

      {/* Admin Analytics Events */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base sm:text-xl font-semibold" style={{ color: "var(--text)" }}>Admin Events Log</h2>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Admin tool usage events (broadcasts, logins, backfills, etc.)
          </p>
        </div>
        <button
          className="px-3 py-2 rounded-lg border"
          style={{ borderColor: "var(--border)" }}
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-xl border mb-4" style={{ borderColor: "var(--border)" }}>
        <div className="md:col-span-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Search</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            placeholder='Search toolKey/event/path/userAgent…'
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>toolKey</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            placeholder="admin_email_broadcast"
            value={toolKey}
            onChange={(e) => {
              setPage(1);
              setToolKey(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>event</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            placeholder="tool_use"
            value={event}
            onChange={(e) => {
              setPage(1);
              setEvent(e.target.value);
            }}
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>path</label>
          <input
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            placeholder="/api/admin/email/broadcast"
            value={path}
            onChange={(e) => {
              setPage(1);
              setPath(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>from</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </div>

        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>to</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-transparent"
            style={{ borderColor: "var(--border)" }}
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </div>

        <div className="md:col-span-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: "var(--muted)" }}>Page size</label>
            <select
              className="px-3 py-2 rounded-lg border bg-transparent"
              style={{ borderColor: "var(--border)" }}
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(clamp(Number(e.target.value), 10, 100));
              }}
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <button className="px-3 py-2 rounded-lg border" style={{ borderColor: "var(--border)" }} onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      {err && (
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 mb-4 text-sm text-red-200">
          <span className="font-medium">Error:</span> {err}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <tr className="text-left">
                  <th className="p-3">Time</th>
                  <th className="p-3">toolKey</th>
                  <th className="p-3">event</th>
                  <th className="p-3">path</th>
                  <th className="p-3">userId</th>
                  <th className="p-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data?.rows?.length ? (
                  <tr>
                    <td className="p-3" style={{ color: "var(--muted)" }} colSpan={6}>
                      Loading…
                    </td>
                  </tr>
                ) : (data?.rows?.length ? (
                  data.rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-b-0 cursor-pointer"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => setSelected(r)}
                      title="Click to view details"
                    >
                      <td className="p-3 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="p-3">{r.toolKey || "-"}</td>
                      <td className="p-3">{r.event}</td>
                      <td className="p-3">{r.path || "-"}</td>
                      <td className="p-3">{r.userId || "-"}</td>
                      <td className="p-3">
                        <span style={{ color: "var(--muted)" }}>
                          {r.meta ? JSON.stringify(r.meta).slice(0, 90) : "-"}
                          {r.meta && JSON.stringify(r.meta).length > 90 ? "…" : ""}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-3" style={{ color: "var(--muted)" }} colSpan={6}>
                      No events found.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2 p-3">
          {loading && !data?.rows?.length ? (
            <div className="p-3" style={{ color: "var(--muted)" }}>Loading…</div>
          ) : (data?.rows?.length ? (
            data.rows.map((r) => (
              <div
                key={r.id}
                className="p-3 rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}
                onClick={() => setSelected(r)}
              >
                <div className="text-xs mb-1" style={{ color: "var(--muted)" }}>{fmtDate(r.createdAt)}</div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {r.toolKey && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                      {r.toolKey}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded text-xs font-medium border border-purple-500/20 bg-purple-500/10 text-purple-300">
                    {r.event}
                  </span>
                </div>
                {r.path && (
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{r.path}</div>
                )}
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Tap to view</div>
              </div>
            ))
          ) : (
            <div className="p-3" style={{ color: "var(--muted)" }}>No events found.</div>
          ))}
        </div>

        <div className="flex items-center justify-between p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {data ? (
              <>
                Showing page {data.page} of {totalPages} · {data.total} total
              </>
            ) : (
              <>—</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="px-3 py-2 rounded-lg border disabled:opacity-50"
              style={{ borderColor: "var(--border)" }}
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSelected(null)} />
          <div className="w-full sm:max-w-xl h-full border-l p-4 overflow-auto" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>Event Details</h3>
                <p className="text-xs" style={{ color: "var(--muted)" }}>{selected.id}</p>
              </div>
              <button className="px-3 py-2 rounded-lg border" style={{ borderColor: "var(--border)" }} onClick={() => setSelected(null)}>
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted)" }}>Time</div>
                <div>{fmtDate(selected.createdAt)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>toolKey</div>
                  <div>{selected.toolKey || "-"}</div>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>event</div>
                  <div>{selected.event}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted)" }}>path</div>
                <div>{selected.path || "-"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>userId</div>
                  <div>{selected.userId || "-"}</div>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>sessionId</div>
                  <div>{selected.sessionId || "-"}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted)" }}>referrer</div>
                <div className="break-words">{selected.referrer || "-"}</div>
              </div>

              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted)" }}>userAgent</div>
                <div className="break-words">{selected.userAgent || "-"}</div>
              </div>

              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <div className="text-xs" style={{ color: "var(--muted)" }}>meta</div>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words">
                  {selected.meta ? JSON.stringify(selected.meta, null, 2) : "-"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
