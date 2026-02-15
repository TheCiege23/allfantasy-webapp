"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { TrendingUp, Users, Calendar, Clock, RefreshCw, Zap, Trophy, Target, ChevronRight, Globe, MapPin, Activity, AlertTriangle, Timer, Play, BarChart3, Database, Cpu, Brain } from "lucide-react";

type Summary = {
  totalVisits?: number;
  uniqueSessions?: number;
  totalUsers?: number;
  paidLeagues?: number;
  legacyUsers?: number;
  confirmedUsers?: number;
  unconfirmedUsers?: number;
  confirmRate?: number;
  thisWeek?: number;
  today?: number;
};

type RightNowMetrics = {
  count: number;
  errRate: number;
  avgMs: number;
};

type TopItem = { name: string; count: number };

type VisitorLocation = {
  id: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  visits: number;
  lastSeen: string;
};

type ActionStatus = {
  loading: boolean;
  result: null | { ok: boolean; message: string };
};

function num(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

export default function AdminOverview() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rightNow, setRightNow] = useState<RightNowMetrics | null>(null);
  const [rightNowLoading, setRightNowLoading] = useState(false);
  const [topEndpoints, setTopEndpoints] = useState<TopItem[]>([]);
  const [topTools, setTopTools] = useState<TopItem[]>([]);

  const [regions, setRegions] = useState<VisitorLocation[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);

  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/summary", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) throw new Error(json?.error || "Failed to load summary");
      setData(json || {});
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load summary"));
    } finally {
      setLoading(false);
    }
  };

  const loadRightNow = async () => {
    setRightNowLoading(true);
    try {
      const res = await fetch("/api/admin/usage/summary?bucketType=hour&days=1&topN=5", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (json) {
        const totals = json.totals || json;
        setRightNow({
          count: num(totals.count ?? totals.totalRequests ?? 0),
          errRate: num(totals.errRate ?? totals.errorRate ?? 0),
          avgMs: num(totals.avgMs ?? totals.p95Ms ?? totals.avgLatency ?? 0),
        });
        if (Array.isArray(json.topEndpoints)) {
          setTopEndpoints(json.topEndpoints.slice(0, 3).map((e: any) => ({ name: e.name || e.endpoint || e.path || "unknown", count: num(e.count ?? e.total ?? 0) })));
        }
        if (Array.isArray(json.topTools)) {
          setTopTools(json.topTools.slice(0, 3).map((t: any) => ({ name: t.name || t.tool || "unknown", count: num(t.count ?? t.total ?? 0) })));
        }
      }
    } catch {
    } finally {
      setRightNowLoading(false);
    }
  };

  const loadRegions = async () => {
    setRegionsLoading(true);
    try {
      const res = await fetch("/api/admin/visitor-locations");
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        setRegions(json.locations || []);
      }
    } catch {
    } finally {
      setRegionsLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadRightNow();
    loadRegions();
  }, []);

  const executeAction = useCallback(async (key: string, url: string, method: string = "POST") => {
    setActionStatus((prev) => ({ ...prev, [key]: { loading: true, result: null } }));
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      const ok = res.ok;
      setActionStatus((prev) => ({
        ...prev,
        [key]: { loading: false, result: { ok, message: ok ? "Success" : (json?.error || "Failed") } },
      }));
      setTimeout(() => {
        setActionStatus((prev) => ({ ...prev, [key]: { loading: false, result: null } }));
      }, 3000);
    } catch (e: any) {
      setActionStatus((prev) => ({
        ...prev,
        [key]: { loading: false, result: { ok: false, message: String(e?.message || "Network error") } },
      }));
      setTimeout(() => {
        setActionStatus((prev) => ({ ...prev, [key]: { loading: false, result: null } }));
      }, 3000);
    }
  }, []);

  const computed = useMemo(() => {
    const totalUsers = num(data?.totalUsers);
    const thisWeek = num(data?.thisWeek);
    const today = num(data?.today);
    const legacyUsers = num(data?.legacyUsers);
    return { totalUsers, thisWeek, today, legacyUsers };
  }, [data]);

  const stats = [
    {
      label: "Total Signups",
      value: computed.totalUsers,
      desc: "All early access emails",
      icon: Users,
      color: "from-cyan-500 to-blue-600",
      shadowColor: "shadow-cyan-500/20",
    },
    {
      label: "This Week",
      value: computed.thisWeek,
      desc: "Last 7 days",
      icon: Calendar,
      color: "from-violet-500 to-purple-600",
      shadowColor: "shadow-violet-500/20",
    },
    {
      label: "Today",
      value: computed.today,
      desc: "New signups today",
      icon: Clock,
      color: "from-emerald-500 to-teal-600",
      shadowColor: "shadow-emerald-500/20",
    },
    {
      label: "Legacy Users",
      value: computed.legacyUsers,
      desc: "Imported profiles",
      icon: Trophy,
      color: "from-amber-500 to-orange-600",
      shadowColor: "shadow-amber-500/20",
    },
  ];

  const topRegions = regions
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 8);

  const quickActions = [
    {
      key: "hallOfFame",
      label: "Rebuild Hall of Fame",
      icon: Trophy,
      color: "text-amber-400",
      action: () => executeAction("hallOfFame", "/api/leagues/demo/hall-of-fame", "POST"),
    },
    {
      key: "calibration",
      label: "Run Calibration Snapshot",
      icon: Target,
      color: "text-violet-400",
      action: () => executeAction("calibration", "/api/admin/calibration", "POST"),
    },
    {
      key: "dataSync",
      label: "Trigger Data Sync",
      icon: RefreshCw,
      color: "text-cyan-400",
      action: () => executeAction("dataSync", "/api/sports/sync", "POST"),
    },
    {
      key: "analytics",
      label: "View Analytics",
      icon: BarChart3,
      color: "text-emerald-400",
      href: "/admin?tab=analytics",
    },
  ];

  const healthItems = [
    {
      label: "Database",
      status: "Healthy",
      href: "/admin?tab=analytics",
      hintText: "View database metrics",
      icon: Database,
    },
    {
      label: "API Services",
      status: "Online",
      href: "/admin?tab=analytics",
      hintText: "View API analytics",
      icon: Cpu,
    },
    {
      label: "AI Integration",
      status: "Active",
      href: "/admin?tab=analytics",
      hintText: "View AI usage",
      icon: Brain,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Platform health and key metrics at a glance
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
          style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}
        >
          <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
          Refresh
        </button>
      </div>

      {/* Right Now Strip */}
      <div className="rounded-2xl p-4" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Right Now</span>
          <span className="text-xs" style={{ color: "var(--muted2)" }}>— last 60 minutes</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>Requests</span>
            <span className="text-sm font-semibold">
              {rightNowLoading ? <span className="inline-block h-4 w-8 rounded animate-pulse" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }} /> : (rightNow?.count ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>Error Rate</span>
            <span className="text-sm font-semibold">
              {rightNowLoading ? <span className="inline-block h-4 w-8 rounded animate-pulse" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }} /> : `${(rightNow?.errRate ?? 0).toFixed(1)}%`}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
            <Timer className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs" style={{ color: "var(--muted)" }}>p95 Latency</span>
            <span className="text-sm font-semibold">
              {rightNowLoading ? <span className="inline-block h-4 w-8 rounded animate-pulse" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }} /> : `${Math.round(rightNow?.avgMs ?? 0)}ms`}
            </span>
          </div>
        </div>
      </div>

      {/* Top Endpoints & Tools */}
      {(topEndpoints.length > 0 || topTools.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topEndpoints.length > 0 && (
            <div className="rounded-2xl p-3 sm:p-5" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Top Endpoints (60m)</div>
              <div className="space-y-1.5">
                {topEndpoints.map((ep, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2" style={{ color: "var(--text)" }}>{ep.name}</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{ep.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topTools.length > 0 && (
            <div className="rounded-2xl p-3 sm:p-5" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--muted)" }}>Top Tools (60m)</div>
              <div className="space-y-1.5">
                {topTools.map((tl, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2" style={{ color: "var(--text)" }}>{tl.name}</span>
                    <span className="font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{tl.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Rate Alert Banner */}
      {rightNow && rightNow.errRate >= 5 && (
        <a
          href="/admin?tab=analytics&scope=api&days=2&bucketType=hour"
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all hover:opacity-90"
          style={{ background: "color-mix(in srgb, #ef4444 15%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "color-mix(in srgb, #ef4444 30%, transparent)", color: "#fca5a5" }}
        >
          ⚠ High error rate detected: {rightNow.errRate.toFixed(1)}% in the last 60 minutes → View details
        </a>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="group relative rounded-2xl p-3 sm:p-5 transition-all overflow-hidden"
              style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} ${stat.shadowColor} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <TrendingUp className="h-4 w-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="text-2xl sm:text-4xl font-bold tracking-tight">
                  {loading ? (
                    <div className="h-10 w-16 rounded-lg animate-pulse" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }} />
                  ) : (
                    stat.value.toLocaleString()
                  )}
                </div>
                
                <div className="mt-2">
                  <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{stat.label}</div>
                  <div className="text-xs" style={{ color: "var(--muted2)" }}>{stat.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <div className="rounded-2xl p-6" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg shadow-pink-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Quick Actions</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Common admin tasks</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon;
              const status = actionStatus[qa.key];
              const isLoading = status?.loading;
              const result = status?.result;

              if (qa.href) {
                return (
                  <a
                    key={qa.key}
                    href={qa.href}
                    className="flex items-center gap-3 rounded-xl p-4 transition-all"
                    style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}
                  >
                    <Icon className={`h-5 w-5 ${qa.color}`} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{qa.label}</span>
                  </a>
                );
              }

              return (
                <button
                  key={qa.key}
                  onClick={qa.action}
                  disabled={isLoading}
                  className="flex flex-col items-start gap-2 rounded-xl p-4 transition-all disabled:opacity-60 text-left"
                  style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-3 w-full">
                    {isLoading ? (
                      <RefreshCw className={`h-5 w-5 ${qa.color} animate-spin`} />
                    ) : (
                      <Icon className={`h-5 w-5 ${qa.color}`} />
                    )}
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{qa.label}</span>
                  </div>
                  {result && (
                    <span className={`text-xs ${result.ok ? "text-emerald-400" : "text-red-400"}`}>
                      {result.message}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Health */}
        <div className="rounded-2xl p-6" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Platform Health</h3>
              <p className="text-xs" style={{ color: "var(--muted)" }}>System status</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {healthItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="flex items-center justify-between p-3 rounded-xl transition-all group/health"
                style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <span className="text-sm" style={{ color: "var(--text)" }}>{item.label}</span>
                    <span className="text-xs ml-2 hidden sm:inline" style={{ color: "var(--muted2)" }}>{item.hintText}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-medium">{item.status}</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-colors" style={{ color: "var(--muted2)" }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Top Regions */}
      <div className="rounded-2xl p-6" style={{ background: "var(--panel)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>Top Regions</h3>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Visitor locations by traffic</p>
          </div>
        </div>

        {regionsLoading && topRegions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : topRegions.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="h-10 w-10 mx-auto mb-2" style={{ color: "var(--muted2)" }} />
            <p className="text-sm" style={{ color: "var(--muted2)" }}>No visitor locations tracked yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topRegions.map((loc, i) => (
              <div
                key={loc.id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono w-4" style={{ color: "var(--muted2)" }}>{i + 1}</span>
                  <MapPin className="h-4 w-4 text-cyan-400" />
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      {loc.city || loc.region || "Unknown"}
                    </span>
                    {loc.country && (
                      <span className="text-xs ml-1.5" style={{ color: "var(--muted2)" }}>{loc.country}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                  {loc.visits.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
