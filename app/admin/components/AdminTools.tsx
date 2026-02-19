"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2, Activity, CheckCircle, XCircle, Clock, TrendingUp, AlertCircle, Zap, Database, Upload } from "lucide-react";

type PurgeResult = {
  ok: boolean;
  dryRun: boolean;
  olderThanDays: number;
  cutoff: string;
  count?: number;
  deleted?: number;
  sample?: Array<{ id: string; email: string; createdAt: string }>;
  error?: string;
};

type ToolUsage = { name: string; count: number; err: number; p95: number | null };

export default function AdminTools() {
  const [olderThanDays, setOlderThanDays] = useState<number>(14);
  const [limitSample, setLimitSample] = useState<number>(10);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmText, setConfirmText] = useState("");
  const canExecute = useMemo(() => confirmText.trim().toUpperCase() === "DELETE", [confirmText]);

  const [apiStatus, setApiStatus] = useState<Record<string, { status: string; callsPerHour: number; lastCheck: string }>>({});
  const [apiLoading, setApiLoading] = useState(false);

  const [usageMap, setUsageMap] = useState<Record<string, ToolUsage>>({});
  const [topUsed, setTopUsed] = useState<ToolUsage[]>([]);
  const [topFailing, setTopFailing] = useState<ToolUsage[]>([]);
  const [topExpensive, setTopExpensive] = useState<ToolUsage[]>([]);

  const [analyticsStats, setAnalyticsStats] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsImporting, setAnalyticsImporting] = useState(false);
  const [analyticsResult, setAnalyticsResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadAnalyticsStats = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch("/api/admin/player-analytics", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setAnalyticsStats(data);
    } catch {}
    setAnalyticsLoading(false);
  };

  const runAnalyticsImport = async () => {
    if (!confirm("Re-import player analytics CSV? This will update all existing records.")) return;
    setAnalyticsImporting(true);
    setAnalyticsResult(null);
    try {
      const res = await fetch("/api/admin/player-analytics", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setAnalyticsResult({ ok: true, message: `Imported ${data.imported} players (${data.skipped} skipped)` });
        loadAnalyticsStats();
      } else {
        setAnalyticsResult({ ok: false, message: data.error || "Import failed" });
      }
    } catch (e: any) {
      setAnalyticsResult({ ok: false, message: e.message || "Network error" });
    }
    setAnalyticsImporting(false);
  };

  const externalApis = [
    { 
      name: "Sleeper API", 
      key: "sleeper",
      baseUrl: "api.sleeper.app",
      rateLimit: "1000/min",
      description: "Dynasty leagues, rosters, players",
      color: "cyan"
    },
    { 
      name: "Yahoo Fantasy API", 
      key: "yahoo",
      baseUrl: "fantasysports.yahooapis.com",
      rateLimit: "2000/day",
      description: "Redraft leagues, OAuth integration",
      color: "purple"
    },
    { 
      name: "MyFantasyLeague API", 
      key: "mfl",
      baseUrl: "api.myfantasyleague.com",
      rateLimit: "100/min",
      description: "Custom dynasty leagues",
      color: "amber"
    },
    { 
      name: "Fantrax API", 
      key: "fantrax",
      baseUrl: "www.fantrax.com",
      rateLimit: "CSV Import",
      description: "Devy leagues, CSV-based",
      color: "emerald"
    },
    { 
      name: "FantasyCalc API", 
      key: "fantasycalc",
      baseUrl: "api.fantasycalc.com",
      rateLimit: "100/hr",
      description: "Player values, dynasty rankings",
      color: "blue"
    },
    { 
      name: "TheSportsDB", 
      key: "thesportsdb",
      baseUrl: "www.thesportsdb.com",
      rateLimit: "100/min",
      description: "Sports data, schedules, teams",
      color: "orange"
    },
    { 
      name: "ESPN API", 
      key: "espn",
      baseUrl: "site.api.espn.com",
      rateLimit: "Unofficial",
      description: "Fallback sports data",
      color: "red"
    },
    { 
      name: "OpenAI (GPT-4o)", 
      key: "openai",
      baseUrl: "api.openai.com",
      rateLimit: "Tier-based",
      description: "AI analysis, trade evaluation",
      color: "green"
    },
    { 
      name: "xAI (Grok)", 
      key: "grok",
      baseUrl: "api.x.ai",
      rateLimit: "Tier-based",
      description: "Social post generation",
      color: "white"
    },
  ];

  const checkApiStatus = async () => {
    setApiLoading(true);
    try {
      const res = await fetch("/api/admin/api-status");
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data.status || {});
      }
    } catch (e) {
      console.error("Failed to fetch API status", e);
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    checkApiStatus();
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      const [allRes, topRes] = await Promise.all([
        fetch("/api/admin/usage/summary?bucketType=day&days=1&topN=50"),
        fetch("/api/admin/usage/summary?bucketType=day&days=1&topN=5"),
      ]);
      if (allRes.ok) {
        const allData = await allRes.json();
        const map: Record<string, ToolUsage> = {};
        for (const t of (allData.topTools ?? [])) {
          map[t.name] = t;
        }
        setUsageMap(map);
      }
      if (topRes.ok) {
        const topData = await topRes.json();
        const tools: ToolUsage[] = topData.topTools ?? [];
        setTopUsed([...tools].sort((a, b) => b.count - a.count).slice(0, 5));
        setTopFailing([...tools].sort((a, b) => b.err - a.err).filter(t => t.err > 0).slice(0, 5));
        setTopExpensive([...tools].sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0)).filter(t => (t.p95 ?? 0) > 0).slice(0, 5));
      }
    } catch (e) {
      console.error("Failed to fetch usage data", e);
    }
  };

  const runDry = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/signups/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays, dryRun: true, limitSample }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Dry run failed");
      setResult(data);
    } catch (e: any) {
      setError(String(e?.message || e || "Dry run failed"));
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!canExecute) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/signups/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olderThanDays, dryRun: false }),
      });
      const data = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(data?.error || "Purge failed");
      setResult(data);
      setConfirmText("");
    } catch (e: any) {
      setError(String(e?.message || e || "Purge failed"));
    } finally {
      setLoading(false);
    }
  };

  const fmtMs = (ms: number | null) => {
    if (ms == null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const fmtErrRate = (count: number, err: number) => {
    if (!count) return "0%";
    return `${((err / count) * 100).toFixed(1)}%`;
  };

  const toolsList = [
    { name: "AF Legacy Import", tool: "AFLegacyImport", endpoint: "/api/legacy/import", status: "Active" },
    { name: "Legacy Profile", tool: "LegacyProfile", endpoint: "/api/legacy/profile", status: "Active" },
    { name: "AI Career Analysis", tool: "AICareerAnalysis", endpoint: "/api/legacy/ai/run", status: "Active" },
    { name: "Trade Analyzer", tool: "TradeAnalyzer", endpoint: "/api/trade-evaluator", status: "Active" },
    { name: "Trade Finder", tool: "TradeFinder", endpoint: "/api/trade-finder", status: "Active" },
    { name: "Player Finder", tool: "PlayerFinder", endpoint: "/api/legacy/player-finder", status: "Active" },
    { name: "Waiver AI", tool: "WaiverAI", endpoint: "/api/legacy/waiver/analyze", status: "Active" },
    { name: "League Rankings", tool: "LeagueRankings", endpoint: "/api/legacy/rankings/analyze", status: "Active" },
    { name: "Social Pulse", tool: "SocialPulse", endpoint: "/api/legacy/social-pulse", status: "Active" },
    { name: "Manager Compare", tool: "ManagerCompare", endpoint: "/api/legacy/compare", status: "Active" },
    { name: "AI Coach / Chat", tool: "AICoach", endpoint: "/api/legacy/ai-coach", status: "Active" },
    { name: "Share Generator", tool: "ShareGenerator", endpoint: "/api/legacy/share", status: "Active" },
    { name: "Playoff Backfill", tool: "PlayoffBackfill", endpoint: "/api/legacy/backfill/playoffs", status: "Active" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Most Used Tools</h4>
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted2)" }}>24h</span>
          </div>
          {topUsed.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted2)" }}>No data yet</p>
          ) : (
            <div className="space-y-2">
              {topUsed.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] w-4 text-right" style={{ color: "var(--muted2)" }}>{i + 1}.</span>
                    <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.name}</span>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 shrink-0">{t.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Most Failing Tools</h4>
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted2)" }}>24h</span>
          </div>
          {topFailing.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted2)" }}>No errors</p>
          ) : (
            <div className="space-y-2">
              {topFailing.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] w-4 text-right" style={{ color: "var(--muted2)" }}>{i + 1}.</span>
                    <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.name}</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 shrink-0">{t.err} err</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Most Expensive Tools</h4>
            <span className="text-[10px] ml-auto" style={{ color: "var(--muted2)" }}>p95</span>
          </div>
          {topExpensive.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted2)" }}>No data yet</p>
          ) : (
            <div className="space-y-2">
              {topExpensive.map((t, i) => (
                <div key={t.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] w-4 text-right" style={{ color: "var(--muted2)" }}>{i + 1}.</span>
                    <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.name}</span>
                  </div>
                  <span className="text-xs font-mono text-amber-400 shrink-0">{fmtMs(t.p95)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderColor: "var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="w-full">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
                <AlertTriangle className="h-5 w-5 text-yellow-200" />
              </div>
              <div>
                <div className="text-base sm:text-lg font-extrabold" style={{ color: "var(--text)" }}>Purge Unconfirmed Signups</div>
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  Deletes only <span className="font-semibold" style={{ color: "var(--muted)" }}>unconfirmed</span> signups older than N days.
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <div className="text-xs" style={{ color: "var(--muted)" }}>Older than (days)</div>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={olderThanDays}
                  onChange={(e) => setOlderThanDays(Number(e.target.value || 0))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs" style={{ color: "var(--muted)" }}>Dry-run sample size</div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={limitSample}
                  onChange={(e) => setLimitSample(Number(e.target.value || 0))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  onClick={runDry}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-60"
                  style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
                >
                  <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
                  Dry run
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm text-yellow-100">
              <div className="font-semibold">Safety:</div>
              <ul className="mt-1 list-disc pl-5 text-yellow-100/90">
                <li>Confirmed signups are never deleted.</li>
                <li>Dry run first to preview what will be removed.</li>
                <li>To execute, type <span className="font-bold">DELETE</span> exactly.</li>
              </ul>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <div className="text-xs" style={{ color: "var(--muted)" }}>Type DELETE to confirm</div>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-xl border px-3 py-2 text-sm uppercase tracking-widest outline-none"
                  style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
                />
              </label>

              <div className="flex items-end">
                <button
                  onClick={execute}
                  disabled={loading || !canExecute}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-500/90 disabled:opacity-60"
                  title="Permanently delete unconfirmed signups"
                >
                  <Trash2 className="h-4 w-4" />
                  Purge now
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
                <div className="font-semibold" style={{ color: "var(--muted)" }}>
                  {result.dryRun ? "Dry run results" : "Purge completed"}
                </div>
                <div className="mt-1" style={{ color: "var(--muted)" }}>
                  Cutoff: <span style={{ color: "var(--muted)" }}>{new Date(result.cutoff).toLocaleString()}</span>
                </div>

                {result.dryRun ? (
                  <>
                    <div className="mt-2">
                      Would delete:{" "}
                      <span className="font-semibold" style={{ color: "var(--text)" }}>{result.count ?? 0}</span>
                    </div>
                    {result.sample?.length ? (
                      <div className="mt-3">
                        <div className="mb-1" style={{ color: "var(--muted)" }}>Sample:</div>
                        <ul className="space-y-1" style={{ color: "var(--muted)" }}>
                          {result.sample.slice(0, 10).map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{s.email}</span>
                              <span className="text-xs" style={{ color: "var(--muted2)" }}>
                                {new Date(s.createdAt).toLocaleDateString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-2" style={{ color: "var(--muted)" }}>No matching unconfirmed signups found.</div>
                    )}
                  </>
                ) : (
                  <div className="mt-2">
                    Deleted:{" "}
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{result.deleted ?? 0}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderColor: "var(--border)" }}>
        <h3 className="text-base sm:text-lg font-semibold mb-4" style={{ color: "var(--text)" }}>Available Tools</h3>

        <div className="hidden md:block overflow-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="p-3">Tool</th>
                <th className="p-3">Endpoint</th>
                <th className="p-3">24h Calls</th>
                <th className="p-3">Error Rate</th>
                <th className="p-3">P95</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {toolsList.map((t) => {
                const usage = usageMap[t.tool] || usageMap[t.name];
                const count = usage?.count ?? 0;
                const err = usage?.err ?? 0;
                const errRate = count ? ((err / count) * 100) : 0;
                const p95 = usage?.p95 ?? null;

                return (
                  <tr key={t.name} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-3 font-medium" style={{ color: "var(--text)" }}>{t.name}</td>
                    <td className="p-3 font-mono text-xs" style={{ color: "var(--muted)" }}>{t.endpoint}</td>
                    <td className="p-3">
                      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{count > 0 ? count.toLocaleString() : "—"}</span>
                    </td>
                    <td className="p-3">
                      {count > 0 ? (
                        <span className={`px-2 py-0.5 rounded-lg text-xs border ${errRate > 10 ? "bg-red-500/20 text-red-400 border-red-500/30" : errRate > 0 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"}`}>
                          {fmtErrRate(count, err)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--muted2)" }}>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`font-mono text-xs ${(p95 ?? 0) > 5000 ? "text-red-400" : (p95 ?? 0) > 2000 ? "text-amber-400" : ""}`} style={(p95 ?? 0) <= 2000 ? { color: "var(--muted)" } : undefined}>
                        {fmtMs(p95)}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {toolsList.map((t) => {
            const usage = usageMap[t.tool] || usageMap[t.name];
            const count = usage?.count ?? 0;
            const err = usage?.err ?? 0;
            const errRate = count ? ((err / count) * 100) : 0;
            const p95 = usage?.p95 ?? null;

            return (
              <div key={t.name} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
                <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{t.name}</div>
                <div className="font-mono text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.endpoint}</div>
                <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                  <span style={{ color: "var(--muted)" }}>24h: <span className="font-mono">{count > 0 ? count.toLocaleString() : "—"}</span></span>
                  <span style={{ color: "var(--muted)" }}>Err: {count > 0 ? (
                    <span className={errRate > 10 ? "text-red-400" : errRate > 0 ? "text-amber-400" : "text-green-400"}>
                      {fmtErrRate(count, err)}
                    </span>
                  ) : "—"}</span>
                  <span style={{ color: "var(--muted)" }}>P95: <span className={`font-mono ${(p95 ?? 0) > 5000 ? "text-red-400" : (p95 ?? 0) > 2000 ? "text-amber-400" : ""}`} style={(p95 ?? 0) <= 2000 ? { color: "var(--muted)" } : undefined}>{fmtMs(p95)}</span></span>
                  <span className="px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                    {t.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border p-3 sm:p-5" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            <h3 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text)" }}>External API Status</h3>
          </div>
          <button
            onClick={checkApiStatus}
            disabled={apiLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm disabled:opacity-60"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
          >
            <RefreshCw className={`h-4 w-4 ${apiLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border" style={{ borderColor: "var(--border)" }}>
          <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Fantasy Platform APIs</h4>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Platform connections for importing user leagues and rosters</p>
        </div>

        <div className="hidden md:block overflow-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
              <tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="p-3">API</th>
                <th className="p-3">Base URL</th>
                <th className="p-3">Rate Limit</th>
                <th className="p-3">Calls/Hour</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {externalApis.map((api) => {
                const status = apiStatus[api.key];
                const colorClasses: Record<string, string> = {
                  cyan: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
                  purple: "text-purple-400 bg-purple-500/20 border-purple-500/30",
                  amber: "text-amber-400 bg-amber-500/20 border-amber-500/30",
                  emerald: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
                  blue: "text-blue-400 bg-blue-500/20 border-blue-500/30",
                  orange: "text-orange-400 bg-orange-500/20 border-orange-500/30",
                  red: "text-red-400 bg-red-500/20 border-red-500/30",
                  green: "text-green-400 bg-green-500/20 border-green-500/30",
                  white: "text-white bg-white/20 border-white/30",
                };
                const isActive = status?.status === "active" || !status;
                
                return (
                  <tr key={api.key} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                        <div>
                          <div className="font-medium" style={{ color: "var(--text)" }}>{api.name}</div>
                          <div className="text-[10px]" style={{ color: "var(--muted2)" }}>{api.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs" style={{ color: "var(--muted)" }}>{api.baseUrl}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs border ${colorClasses[api.color] || colorClasses.white}`}>
                        {api.rateLimit}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" style={{ color: "var(--muted2)" }} />
                        <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                          {status?.callsPerHour ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-xs border border-green-500/30">
                          <CheckCircle className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 text-xs border border-red-500/30">
                          <XCircle className="h-3 w-3" />
                          {status?.status || "Error"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-2">
          {externalApis.map((api) => {
            const status = apiStatus[api.key];
            const isActive = status?.status === "active" || !status;
            const colorClasses: Record<string, string> = {
              cyan: "text-cyan-400 bg-cyan-500/20 border-cyan-500/30",
              purple: "text-purple-400 bg-purple-500/20 border-purple-500/30",
              amber: "text-amber-400 bg-amber-500/20 border-amber-500/30",
              emerald: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
              blue: "text-blue-400 bg-blue-500/20 border-blue-500/30",
              orange: "text-orange-400 bg-orange-500/20 border-orange-500/30",
              red: "text-red-400 bg-red-500/20 border-red-500/30",
              green: "text-green-400 bg-green-500/20 border-green-500/30",
              white: "text-white bg-white/20 border-white/30",
            };

            return (
              <div key={api.key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                  <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{api.name}</div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-500/20 text-green-400 text-xs border border-green-500/30 ml-auto shrink-0">
                      <CheckCircle className="h-3 w-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 text-xs border border-red-500/30 ml-auto shrink-0">
                      <XCircle className="h-3 w-3" />
                      {status?.status || "Error"}
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{api.description}</div>
                <div className="font-mono text-xs mt-1" style={{ color: "var(--muted2)" }}>{api.baseUrl}</div>
                <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                  <span className={`px-2 py-0.5 rounded-lg text-xs border ${colorClasses[api.color] || colorClasses.white}`}>
                    {api.rateLimit}
                  </span>
                  <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
                    <Clock className="h-3 w-3" style={{ color: "var(--muted2)" }} />
                    {status?.callsPerHour ?? 0}/hr
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 text-xs flex items-center gap-2" style={{ color: "var(--muted2)" }}>
          <Clock className="h-3 w-3" />
          <span>Last checked: {Object.values(apiStatus)[0]?.lastCheck ? new Date(Object.values(apiStatus)[0].lastCheck).toLocaleString() : 'Never'}</span>
        </div>
      </div>

      {/* Player Analytics Data */}
      <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Player Analytics Database</h3>
          </div>
          <button
            onClick={loadAnalyticsStats}
            disabled={analyticsLoading}
            className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:opacity-80 transition"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            <RefreshCw className={`h-3 w-3 ${analyticsLoading ? "animate-spin" : ""}`} />
            {analyticsLoading ? "Loading..." : "Check"}
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          NFL player combine metrics, college production, breakout ages, comparable players, and advanced analytics. Feeds into trade analyzer, valuation engine, and draft evaluations.
        </p>

        {analyticsStats ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <p className="text-lg font-black tabular-nums" style={{ color: "var(--text)" }}>{analyticsStats.total.toLocaleString()}</p>
                <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Total Players</p>
              </div>
              <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <p className="text-lg font-black tabular-nums text-cyan-400">{analyticsStats.coverage?.combineData || 0}</p>
                <p className="text-[10px]" style={{ color: "var(--muted2)" }}>With Combine</p>
              </div>
              <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <p className="text-lg font-black tabular-nums text-emerald-400">{analyticsStats.coverage?.breakoutAge || 0}</p>
                <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Breakout Age</p>
              </div>
              <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                <p className="text-lg font-black tabular-nums text-amber-400">{analyticsStats.coverage?.comparablePlayers || 0}</p>
                <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Player Comps</p>
              </div>
            </div>

            {analyticsStats.byPosition && (
              <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                <p className="text-[10px] font-bold mb-2" style={{ color: "var(--muted)" }}>BY POSITION</p>
                <div className="flex flex-wrap gap-1.5">
                  {analyticsStats.byPosition.map((p: any) => (
                    <span key={p.position} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                      {p.position}: {p.count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {analyticsStats.lastImport && (
              <div className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted2)" }}>
                <Clock className="h-3 w-3" />
                Last import: {new Date(analyticsStats.lastImport.importedAt).toLocaleString()} ({analyticsStats.lastImport.dataVersion})
              </div>
            )}

            <button
              onClick={runAnalyticsImport}
              disabled={analyticsImporting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium hover:opacity-80 transition"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
            >
              {analyticsImporting ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="h-4 w-4" /> Re-Import CSV Data</>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={loadAnalyticsStats}
            disabled={analyticsLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium hover:opacity-80 transition"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
          >
            {analyticsLoading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Loading...</>
            ) : (
              <><Database className="h-4 w-4" /> View Player Analytics Status</>
            )}
          </button>
        )}

        {analyticsResult && (
          <div className={`mt-3 rounded-xl border p-3 text-xs ${analyticsResult.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
            {analyticsResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
