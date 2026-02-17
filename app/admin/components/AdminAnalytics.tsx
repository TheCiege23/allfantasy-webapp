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

type LegacyUsageResponse = {
  ok: boolean;
  summary: {
    totalToolUses: number;
    totalUniqueUsers: number;
  };
  tools: LegacyToolStat[];
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
  const [activeTab, setActiveTab] = useState<"retention" | "stickiness" | "sources">("retention");

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

  return (
    <div className="mb-8">
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

      <div className="flex gap-2 mb-4">
        {(["retention", "stickiness", "sources"] as const).map((tab) => (
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
            {tab === "retention" ? "Retention Cohorts" : "Tool Stickiness"}
          </button>
        ))}
      </div>

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
                <div className="text-sm font-medium p-3" style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  Top Users ({stickiness.days}d){stickyEvent ? ` \u2014 ${stickyEvent}` : ""}
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
                  <span>Core actions: trade analysis, rankings, waiver, AI chat</span>
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

      {/* Legacy Tool Usage Stats */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base sm:text-xl font-semibold" style={{ color: "var(--text)" }}>Legacy Tool Usage</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Track which AF Legacy tools users are engaging with
            </p>
          </div>
          <button
            className="px-3 py-2 rounded-lg border"
            style={{ borderColor: "var(--border)", background: "transparent" }}
            onClick={() => loadLegacyUsage()}
            disabled={legacyLoading}
          >
            {legacyLoading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {legacyUsage && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5">
                <div className="text-xl sm:text-2xl font-bold text-cyan-300">{legacyUsage.summary.totalToolUses.toLocaleString()}</div>
                <div className="text-sm" style={{ color: "var(--muted)" }}>Total Tool Uses</div>
              </div>
              <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <div className="text-xl sm:text-2xl font-bold text-purple-300">{legacyUsage.summary.totalUniqueUsers.toLocaleString()}</div>
                <div className="text-sm" style={{ color: "var(--muted)" }}>Unique Users</div>
              </div>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    <tr className="text-left">
                      <th className="p-3">Tool</th>
                      <th className="p-3 text-right">Total Uses</th>
                      <th className="p-3 text-right">Unique Users</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacyUsage.tools.map((tool) => (
                      <tr key={tool.tool} className="border-b last:border-b-0" style={{ borderColor: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                        <td className="p-3 font-medium">{tool.toolLabel}</td>
                        <td className="p-3 text-right tabular-nums">{tool.totalUses.toLocaleString()}</td>
                        <td className="p-3 text-right tabular-nums">{tool.uniqueUsers.toLocaleString()}</td>
                      </tr>
                    ))}
                    {legacyUsage.tools.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-6 text-center" style={{ color: "var(--muted)" }}>
                          No tool usage data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2 p-3">
                {legacyUsage.tools.map((tool) => (
                  <div key={tool.tool} className="p-3 rounded-lg border" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                    <div className="font-medium mb-2">{tool.toolLabel}</div>
                    <div className="flex items-center justify-between text-sm">
                      <span style={{ color: "var(--muted)" }}>Total Uses</span>
                      <span className="tabular-nums font-medium">{tool.totalUses.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span style={{ color: "var(--muted)" }}>Unique Users</span>
                      <span className="tabular-nums font-medium">{tool.uniqueUsers.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {legacyUsage.tools.length === 0 && (
                  <div className="p-6 text-center" style={{ color: "var(--muted)" }}>
                    No tool usage data yet
                  </div>
                )}
              </div>
            </div>
          </>
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
