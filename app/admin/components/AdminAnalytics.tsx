"use client";

import React, { useEffect, useMemo, useState } from "react";

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
