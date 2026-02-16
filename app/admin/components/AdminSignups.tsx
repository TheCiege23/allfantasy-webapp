"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Search,
  RefreshCw,
  Download,
  Trash2,
  Globe,
  TrendingUp,
  Users,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Mail,
  Calendar,
  Filter,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  Activity,
  Clock,
  Send,
} from "lucide-react";

type SourceFilter = "all" | "allfantasy.ai" | "allfantasysportsapp.net";

interface Signup {
  id: string;
  email: string;
  createdAt: string;
  confirmedAt?: string | null;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, rows: Array<Record<string, any>>) {
  const headers = Object.keys(
    rows[0] || { email: "", createdAt: "", confirmedAt: "", source: "", utmSource: "", utmMedium: "", utmCampaign: "" }
  );
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getTrafficSourceLabel(s: Signup): string {
  if (s.utmSource) {
    const src = s.utmSource.toLowerCase();
    if (src.includes('facebook') || src.includes('meta') || src.includes('ig')) return 'Meta Ads';
    if (src.includes('google')) return 'Google Ads';
    if (src.includes('twitter') || src.includes('x.com')) return 'X/Twitter';
    if (src.includes('tiktok')) return 'TikTok';
    if (src.includes('reddit')) return 'Reddit';
    return s.utmSource;
  }
  if (s.referrer) {
    try {
      const url = new URL(s.referrer);
      if (url.hostname.includes('google')) return 'Google';
      if (url.hostname.includes('facebook') || url.hostname.includes('fb.')) return 'Facebook';
      if (url.hostname.includes('twitter') || url.hostname.includes('x.com')) return 'X/Twitter';
      if (url.hostname.includes('reddit')) return 'Reddit';
      return url.hostname.replace('www.', '');
    } catch {
      return 'Referral';
    }
  }
  return 'Direct';
}

function getTrafficSourceStyle(label: string): { bg: string; border: string; text: string; icon: string } {
  const l = label.toLowerCase();
  if (l.includes('meta') || l.includes('facebook')) 
    return { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'bg-blue-500' };
  if (l.includes('google')) 
    return { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', icon: 'bg-rose-500' };
  if (l.includes('twitter') || l.includes('x/')) 
    return { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', icon: 'bg-sky-500' };
  if (l.includes('tiktok')) 
    return { bg: 'bg-pink-500/15', border: 'border-pink-500/30', text: 'text-pink-400', icon: 'bg-pink-500' };
  if (l.includes('reddit')) 
    return { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', icon: 'bg-orange-500' };
  if (l === 'direct') 
    return { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'bg-emerald-500' };
  return { bg: 'bg-white/10', border: 'border-white/20', text: 'text-white/80', icon: 'bg-white/40' };
}

interface TrafficSourceData {
  label: string;
  count: number;
  percentage: number;
}

export default function AdminSignups() {
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [searchQ, setSearchQ] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  
  const [apiStats, setApiStats] = useState<{ total: number; confirmed: number; unconfirmed: number; confirmRate: number; last24h: number; last7d: number; recentSignups: Signup[]; serverTime: string } | null>(null);
  const [questionnaireCount, setQuestionnaireCount] = useState<number | null>(null);
  const [showRecentSignups, setShowRecentSignups] = useState(true);

  const [quickDeleteEmail, setQuickDeleteEmail] = useState("");
  const [quickDeleting, setQuickDeleting] = useState(false);
  const [quickDeleteResult, setQuickDeleteResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderStats, setReminderStats] = useState<{ totalUnconfirmed: number; alreadyReminded: number; eligible: number } | null>(null);
  const [reminderResult, setReminderResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadReminderStats = async () => {
    setReminderLoading(true);
    try {
      const res = await fetch("/api/admin/send-reminders", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setReminderStats({ totalUnconfirmed: data.totalUnconfirmed, alreadyReminded: data.alreadyReminded, eligible: data.eligible });
      }
    } catch {}
    setReminderLoading(false);
  };

  const sendReminders = async () => {
    if (!confirm(`Send confirmation reminder emails to ${reminderStats?.eligible || 0} unconfirmed signups? Each person will only receive one reminder.`)) return;
    setReminderSending(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/admin/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const data = await res.json();
      if (data.ok) {
        setReminderResult({ ok: true, message: `Sent ${data.sent} reminders${data.failed ? `, ${data.failed} failed` : ''}${data.remaining ? `. ${data.remaining} remaining.` : '.'}` });
        loadReminderStats();
      } else {
        setReminderResult({ ok: false, message: data.error || "Failed to send" });
      }
    } catch (e: any) {
      setReminderResult({ ok: false, message: e.message || "Network error" });
    }
    setReminderSending(false);
  };

  const handleQuickDelete = async () => {
    const email = quickDeleteEmail.trim().toLowerCase();
    if (!email) return;
    
    if (!confirm(`Permanently delete signup for "${email}"? This cannot be undone.`)) return;
    
    setQuickDeleting(true);
    setQuickDeleteResult(null);
    try {
      const res = await fetch(`/api/admin/signups?email=${encodeURIComponent(email)}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        if (data.deleted) {
          setQuickDeleteResult({ ok: true, message: `Deleted "${email}" successfully` });
          setQuickDeleteEmail("");
          load();
        } else {
          setQuickDeleteResult({ ok: false, message: `Email "${email}" not found in database` });
        }
      } else {
        setQuickDeleteResult({ ok: false, message: data.error || "Failed to delete" });
      }
    } catch (e: any) {
      setQuickDeleteResult({ ok: false, message: e.message || "Network error" });
    } finally {
      setQuickDeleting(false);
    }
  };

  const syncMissingSignups = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/migrate-signups");
      const data = await res.json();
      if (data.ok) {
        setSyncResult(`Synced ${data.inserted || 0} new signups (${data.skipped || 0} already existed)`);
        load();
      } else {
        setSyncResult(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (e: any) {
      setSyncResult(`Error: ${e.message || "Failed to sync"}`);
    } finally {
      setSyncing(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "1000");
      qs.set("source", source);

      const res = await fetch(`/api/admin/signups?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load signups");
      setSignups(data?.signups || []);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load signups"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  useEffect(() => {
    fetch("/api/admin/signups/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setApiStats({
          total: d.total,
          confirmed: d.confirmed,
          unconfirmed: d.unconfirmed,
          confirmRate: d.confirmRate,
          last24h: d.last24h ?? 0,
          last7d: d.last7d ?? 0,
          recentSignups: d.recentSignups ?? [],
          serverTime: d.serverTime ?? new Date().toISOString(),
        });
      })
      .catch(() => {});
    fetch("/api/admin/questionnaire", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.responses)) setQuestionnaireCount(d.responses.length); else if (typeof d?.count === "number") setQuestionnaireCount(d.count); })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return signups;
    return signups.filter((s) => s.email.toLowerCase().includes(q));
  }, [signups, searchQ]);

  const stats = useMemo(() => {
    const total = apiStats?.total ?? signups.length;
    const today = apiStats?.last24h ?? 0;
    const thisWeek = apiStats?.last7d ?? 0;
    return { total, today, thisWeek };
  }, [signups, apiStats]);

  const stalenessData = useMemo(() => {
    if (apiStats) {
      return { last24h: apiStats.last24h, last7d: apiStats.last7d };
    }
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last24h = signups.filter((s) => new Date(s.createdAt) >= h24).length;
    const last7d = signups.filter((s) => new Date(s.createdAt) >= d7).length;
    return { last24h, last7d };
  }, [signups, apiStats]);

  const topSourcesByField = useMemo(() => {
    const counts: Record<string, number> = {};
    signups.forEach((s) => {
      const src = s.source || "unknown";
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count, pct: signups.length > 0 ? (count / signups.length) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [signups]);

  const topDays = useMemo(() => {
    const counts: Record<string, number> = {};
    signups.forEach((s) => {
      const day = s.createdAt.slice(0, 10);
      counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [signups]);

  const trafficSources = useMemo<TrafficSourceData[]>(() => {
    const counts: Record<string, number> = {};
    signups.forEach(s => {
      const label = getTrafficSourceLabel(s);
      counts[label] = (counts[label] || 0) + 1;
    });
    
    const total = signups.length || 1;
    return Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count);
  }, [signups]);

  const onExport = () => {
    const rows = filtered.map((s) => ({
      email: s.email,
      createdAt: s.createdAt,
      confirmedAt: s.confirmedAt || "",
      status: s.confirmedAt ? "confirmed" : "unconfirmed",
      source: s.source || "allfantasy.ai",
      trafficSource: getTrafficSourceLabel(s),
      utmSource: s.utmSource || "",
      utmMedium: s.utmMedium || "",
      utmCampaign: s.utmCampaign || "",
      utmContent: s.utmContent || "",
      utmTerm: s.utmTerm || "",
      referrer: s.referrer || "",
    }));
    downloadCsv(
      `allfantasy_signups_${status}_${source}_${new Date().toISOString().slice(0, 10)}.csv`,
      rows
    );
  };

  const requestDelete = (s: Signup) => {
    setDeleteId(s.id);
    setDeleteEmail(s.email);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteId(null);
    setDeleteEmail(null);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/signups/${deleteId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete signup");

      setSignups((prev) => prev.filter((x) => x.id !== deleteId));
      setDeleteId(null);
      setDeleteEmail(null);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to delete signup"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Staleness Alert Card */}
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Staleness Alert</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`rounded-xl p-3 border ${stalenessData.last24h === 0 ? 'border-amber-500/30 bg-amber-500/10' : ''}`}
              style={stalenessData.last24h === 0 ? undefined : { borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}
            >
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Last 24h</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xl sm:text-2xl font-black tabular-nums" style={{ color: "var(--text)" }}>{stalenessData.last24h}</p>
                {stalenessData.last24h === 0 && (
                  <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                )}
              </div>
              {stalenessData.last24h === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">No signups in 24h</p>
              )}
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Last 7d</p>
              <p className="text-xl sm:text-2xl font-black tabular-nums mt-1" style={{ color: "var(--text)" }}>{stalenessData.last7d}</p>
            </div>
          </div>
        </div>

        {/* Conversion Funnel Card */}
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Conversion Funnel</h3>
          </div>
          {apiStats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Total Signups</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>{apiStats.total}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                <div className="h-full rounded-full bg-cyan-500" style={{ width: '100%' }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Confirmed</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>{apiStats.confirmed} <span className="text-emerald-400 text-xs">({(apiStats.confirmRate * 100).toFixed(1)}%)</span></span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, apiStats.confirmRate * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Questionnaire</span>
                </div>
                <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
                  {questionnaireCount !== null ? (
                    <>{questionnaireCount} <span className="text-purple-400 text-xs">({apiStats.total > 0 ? ((questionnaireCount / apiStats.total) * 100).toFixed(1) : '0'}%)</span></>
                  ) : (
                    <span style={{ color: "var(--muted2)" }}>—</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${questionnaireCount !== null && apiStats.total > 0 ? Math.min(100, (questionnaireCount / apiStats.total) * 100) : 0}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-4 w-4 animate-spin" style={{ color: "var(--muted2)" }} />
            </div>
          )}
        </div>

        {/* Confirmation Reminders Card */}
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Send className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Confirmation Reminders</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Send a one-time reminder email to unconfirmed signups asking them to confirm their spot.
          </p>

          {!reminderStats ? (
            <button
              onClick={loadReminderStats}
              disabled={reminderLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium hover:opacity-80 transition"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
            >
              {reminderLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Loading...</>
              ) : (
                <><Mail className="h-4 w-4" /> Check Unconfirmed Signups</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                  <p className="text-lg font-black tabular-nums" style={{ color: "var(--text)" }}>{reminderStats.totalUnconfirmed}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Unconfirmed</p>
                </div>
                <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                  <p className="text-lg font-black tabular-nums text-amber-400">{reminderStats.alreadyReminded}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Already Sent</p>
                </div>
                <div className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                  <p className="text-lg font-black tabular-nums text-emerald-400">{reminderStats.eligible}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted2)" }}>Ready to Send</p>
                </div>
              </div>

              {reminderStats.eligible > 0 ? (
                <button
                  onClick={sendReminders}
                  disabled={reminderSending}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition disabled:opacity-50"
                >
                  {reminderSending ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Reminders ({Math.min(reminderStats.eligible, 50)} at a time)</>
                  )}
                </button>
              ) : (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <CheckCircle className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs text-emerald-400 font-medium">All unconfirmed signups have been reminded</p>
                </div>
              )}

              <button
                onClick={loadReminderStats}
                disabled={reminderLoading}
                className="w-full flex items-center justify-center gap-1 text-[10px] hover:opacity-80 transition"
                style={{ color: "var(--muted2)" }}
              >
                <RefreshCw className={`h-3 w-3 ${reminderLoading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          )}

          {reminderResult && (
            <div className={`mt-3 rounded-xl border p-3 text-xs ${reminderResult.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
              {reminderResult.message}
            </div>
          )}
        </div>

        {/* Top Sources Card (by source field) */}
        <div className="rounded-2xl border p-4 sm:p-5 md:col-span-2 lg:col-span-1" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Top Sources</h3>
          </div>
          {topSourcesByField.length > 0 ? (
            <div className="space-y-2">
              {topSourcesByField.map((src, i) => (
                <div key={src.label} className="flex items-center gap-3">
                  <span className="text-[10px] w-4 text-right tabular-nums" style={{ color: "var(--muted2)" }}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate" style={{ color: "var(--muted)" }}>{src.label}</span>
                      <span className="text-xs tabular-nums ml-2" style={{ color: "var(--muted)" }}>{src.count} <span style={{ color: "var(--muted2)" }}>({src.pct.toFixed(0)}%)</span></span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                      <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${Math.min(100, src.pct)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs py-4 text-center" style={{ color: "var(--muted2)" }}>No data</p>
          )}
        </div>
      </div>

      {/* Recent Signups Card */}
      <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Recent Signups</h3>
            {apiStats && (
              <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {apiStats.recentSignups.length}
              </span>
            )}
          </div>
          {apiStats && apiStats.recentSignups.length > 0 && (
            <button
              onClick={() => setShowRecentSignups(!showRecentSignups)}
              className="text-xs font-medium transition hover:opacity-80"
              style={{ color: "var(--muted)" }}
            >
              {showRecentSignups ? 'Hide' : 'Show'}
              {showRecentSignups ? <ChevronUp className="inline h-3 w-3 ml-1" /> : <ChevronDown className="inline h-3 w-3 ml-1" />}
            </button>
          )}
        </div>
        {!apiStats ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin" style={{ color: "var(--muted2)" }} />
          </div>
        ) : apiStats.recentSignups.length === 0 ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-amber-400 mx-auto mb-2" />
            <p className="text-xs font-medium text-amber-400">No signups in the last 48 hours</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--muted2)" }}>
              Server time: {fmtDateTime(apiStats.serverTime)} UTC
            </p>
          </div>
        ) : showRecentSignups ? (
          <div className="space-y-2">
            {apiStats.recentSignups.map((s, i) => {
              const trafficLabel = getTrafficSourceLabel(s);
              const style = getTrafficSourceStyle(trafficLabel);
              const signupTime = new Date(s.createdAt);
              const hoursAgo = Math.floor((Date.now() - signupTime.getTime()) / (1000 * 60 * 60));
              const timeLabel = hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 3%, transparent)" }}>
                  <span className="text-xs font-bold text-emerald-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-3 w-3 flex-shrink-0" style={{ color: "var(--muted2)" }} />
                      <span className="text-xs sm:text-sm font-medium truncate" style={{ color: "var(--text)" }}>{s.email}</span>
                      <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.border} ${style.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.icon}`} />
                        {trafficLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3" style={{ color: "var(--muted2)" }} />
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                        {fmtDateTime(s.createdAt)}
                      </span>
                      <span className="text-[10px] font-medium text-cyan-400">{timeLabel}</span>
                      {s.confirmedAt && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle className="h-3 w-3" /> Confirmed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-center py-2" style={{ color: "var(--muted)" }}>
            {apiStats.recentSignups.length} signup{apiStats.recentSignups.length !== 1 ? 's' : ''} in last 48h
          </p>
        )}
      </div>

      {/* Top Days Card */}
      <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
          <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Top Days by Signup Count</h3>
        </div>
        {topDays.length > 0 ? (
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
            {topDays.map((d, i) => {
              const maxCount = topDays[0]?.count || 1;
              return (
                <div key={d.day} className="flex-shrink-0 rounded-xl border p-3 min-w-[120px] sm:min-w-[140px] sm:flex-1" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] text-amber-400 font-bold">#{i + 1}</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{fmtDate(d.day + "T00:00:00Z")}</span>
                  </div>
                  <p className="text-lg sm:text-xl font-black tabular-nums" style={{ color: "var(--text)" }}>{d.count}</p>
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                    <div className="h-full rounded-full bg-amber-500/60" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs py-4 text-center" style={{ color: "var(--muted2)" }}>No data</p>
        )}
      </div>

      {/* Stats Grid - Mobile optimized */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-cyan-500/30">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl transition-all group-hover:bg-cyan-500/20" />
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-cyan-500/20">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Total</p>
                <p className="text-xl sm:text-3xl font-black tabular-nums" style={{ color: "var(--text)" }}>{stats.total}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-emerald-500/30">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20" />
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-emerald-500/20">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>This Week</p>
                <p className="text-xl sm:text-3xl font-black tabular-nums" style={{ color: "var(--text)" }}>{stats.thisWeek}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-amber-500/30">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl transition-all group-hover:bg-amber-500/20" />
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-amber-500/20">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Today</p>
                <p className="text-xl sm:text-3xl font-black tabular-nums" style={{ color: "var(--text)" }}>{stats.today}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-4 sm:p-5 transition-all hover:border-purple-500/30">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20" />
          <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-purple-500/20">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Sources</p>
                <p className="text-xl sm:text-3xl font-black tabular-nums" style={{ color: "var(--text)" }}>{trafficSources.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Sources - Compact horizontal scroll on mobile */}
      {trafficSources.length > 0 && (
        <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
            <h3 className="text-sm sm:text-base font-bold" style={{ color: "var(--text)" }}>Traffic Sources</h3>
          </div>
          
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
            {trafficSources.map((ts) => {
              const style = getTrafficSourceStyle(ts.label);
              return (
                <div 
                  key={ts.label}
                  className={`flex-shrink-0 rounded-xl border ${style.border} ${style.bg} p-3 sm:p-4 min-w-[140px] sm:min-w-[160px] sm:flex-1`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${style.icon}`} />
                      <span className={`text-xs sm:text-sm font-semibold ${style.text}`}>{ts.label}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs" style={{ color: "var(--muted)" }}>{ts.percentage.toFixed(0)}%</span>
                  </div>
                  <p className="mt-1 text-lg sm:text-2xl font-black" style={{ color: "var(--text)" }}>{ts.count}</p>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--text) 10%, transparent)" }}>
                    <div 
                      className={`h-full rounded-full ${style.icon} opacity-80`}
                      style={{ width: `${Math.min(100, ts.percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Find Email - Prominent search */}
      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent p-4">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-4 w-4 text-cyan-400" />
          <label className="text-sm font-semibold" style={{ color: "var(--text)" }}>Find Email</label>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted2)" }} />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Enter email address to search..."
            className="w-full rounded-xl border border-cyan-500/30 pl-10 pr-4 py-3 text-sm outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition"
            style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
          />
          {searchQ && (
            <button
              onClick={() => setSearchQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition"
              style={{ color: "var(--muted2)" }}
            >
              <span className="text-xs">Clear</span>
            </button>
          )}
        </div>
        {searchQ && (
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Found <span className="text-cyan-400 font-semibold">{filtered.length}</span> result{filtered.length !== 1 ? 's' : ''} for "{searchQ}"
          </p>
        )}
      </div>

      {/* Quick Delete by Email - For Testing */}
      <div className="rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <label className="text-sm font-semibold" style={{ color: "var(--text)" }}>Quick Delete (Testing)</label>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>Permanently remove a signup to test the signup flow fresh</p>
        <div className="flex gap-2">
          <input
            value={quickDeleteEmail}
            onChange={(e) => {
              setQuickDeleteEmail(e.target.value);
              setQuickDeleteResult(null);
            }}
            placeholder="Enter email to delete..."
            className="flex-1 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition"
            style={{ background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickDelete()}
          />
          <button
            onClick={handleQuickDelete}
            disabled={quickDeleting || !quickDeleteEmail.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-sm font-semibold text-white hover:from-red-500 hover:to-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Trash2 className={`h-4 w-4 ${quickDeleting ? 'animate-pulse' : ''}`} />
            {quickDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        {quickDeleteResult && (
          <p className={`mt-2 text-xs ${quickDeleteResult.ok ? 'text-green-400' : 'text-red-400'}`}>
            {quickDeleteResult.message}
          </p>
        )}
      </div>

      {/* Filters & Actions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 sm:h-12 w-10 sm:w-12 items-center justify-center rounded-xl border transition sm:hidden ${
              showFilters ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400' : ''
            }`}
            style={showFilters ? undefined : { borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="hidden sm:flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:opacity-80 transition"
            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Refresh</span>
          </button>
          <button
            onClick={syncMissingSignups}
            disabled={syncing}
            className="hidden sm:flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 px-4 text-sm font-bold text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition disabled:opacity-50"
          >
            <Download className={`h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} />
            <span className="hidden lg:inline">{syncing ? 'Syncing...' : 'Sync Missing'}</span>
          </button>
          <button
            onClick={onExport}
            className="hidden sm:flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition"
          >
            <Download className="h-4 w-4" />
            <span className="hidden lg:inline">Export</span>
          </button>
        </div>

        {/* Collapsible filters on mobile */}
        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${showFilters ? 'block' : 'hidden sm:flex'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="rounded-lg border px-3 py-2 text-xs sm:text-sm outline-none focus:border-cyan-500/50 transition cursor-pointer"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
            >
              <option value="all">All sources</option>
              <option value="allfantasy.ai">allfantasy.ai</option>
              <option value="allfantasysportsapp.net">allfantasysportsapp.net</option>
            </select>
          </div>
          
          {/* Mobile action buttons */}
          <div className="flex items-center gap-2 sm:hidden mt-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium"
              style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={syncMissingSignups}
              disabled={syncing}
              className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-sm font-bold text-white disabled:opacity-50"
            >
              <Download className={`h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={onExport}
              className="flex-1 flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-sm font-bold text-white"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
      
      {syncResult && (
        <div className={`rounded-xl border p-4 text-sm ${syncResult.startsWith('Error') ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}>
          {syncResult}
          <button onClick={() => setSyncResult(null)} className="ml-2 hover:opacity-80 transition" style={{ color: "var(--muted)" }}>×</button>
        </div>
      )}

      {/* Signups List - Card view on mobile, table on desktop */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-black/30" style={{ borderColor: "var(--border)" }}>
              <tr className="text-left text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                <th className="px-5 py-4 font-semibold">Email</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Source</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {loading ? (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={4}>
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
                    <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Loading signups...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={4} style={{ color: "var(--muted)" }}>
                    No signups found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const trafficLabel = getTrafficSourceLabel(s);
                  const style = getTrafficSourceStyle(trafficLabel);
                  const isExpanded = expandedRow === s.id;
                  const hasUtmData = s.utmSource || s.utmMedium || s.utmCampaign || s.referrer;
                  
                  return (
                    <Fragment key={s.id}>
                      <tr 
                        className={`hover:bg-white/[0.02] transition ${hasUtmData ? 'cursor-pointer' : ''}`}
                        onClick={() => hasUtmData && setExpandedRow(isExpanded ? null : s.id)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {hasUtmData && (
                              isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: "var(--muted2)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "var(--muted2)" }} />
                            )}
                            <span className="font-medium" style={{ color: "var(--text)" }}>{s.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4" style={{ color: "var(--muted)" }}>{fmtDate(s.createdAt)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${style.bg} ${style.border} ${style.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.icon}`} />
                            {trafficLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); requestDelete(s); }}
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition"
                            style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                      {isExpanded && hasUtmData && (
                        <tr style={{ background: "color-mix(in srgb, var(--text) 1%, transparent)" }}>
                          <td colSpan={4} className="px-5 py-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                              {s.utmSource && (
                                <div><p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Source</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmSource}</p></div>
                              )}
                              {s.utmMedium && (
                                <div><p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Medium</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmMedium}</p></div>
                              )}
                              {s.utmCampaign && (
                                <div><p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Campaign</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmCampaign}</p></div>
                              )}
                              {s.utmContent && (
                                <div><p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Content</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmContent}</p></div>
                              )}
                              {s.utmTerm && (
                                <div><p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Term</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmTerm}</p></div>
                              )}
                              {s.referrer && (
                                <div className="col-span-full">
                                  <p className="uppercase tracking-wide mb-1" style={{ color: "var(--muted2)" }}>Referrer</p>
                                  <p className="font-medium flex items-center gap-1.5 truncate" style={{ color: "var(--muted)" }}>
                                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{s.referrer}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y" style={{ borderColor: "var(--border)" }}>
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-cyan-400" />
              <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>Loading...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--muted)" }}>
              No signups found.
            </div>
          ) : (
            filtered.map((s) => {
              const trafficLabel = getTrafficSourceLabel(s);
              const style = getTrafficSourceStyle(trafficLabel);
              const isExpanded = expandedRow === s.id;
              const hasUtmData = s.utmSource || s.utmMedium || s.utmCampaign || s.referrer;
              
              return (
                <div key={s.id} className="p-4">
                  <div 
                    className={`${hasUtmData ? 'cursor-pointer' : ''}`}
                    onClick={() => hasUtmData && setExpandedRow(isExpanded ? null : s.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {hasUtmData && (
                            isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0" style={{ color: "var(--muted2)" }} /> : <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--muted2)" }} />
                          )}
                          <Mail className="h-4 w-4 flex-shrink-0" style={{ color: "var(--muted2)" }} />
                          <p className="font-medium truncate text-sm" style={{ color: "var(--text)" }}>{s.email}</p>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                            <Calendar className="h-3 w-3" />
                            {fmtDate(s.createdAt)}
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.border} ${style.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.icon}`} />
                            {trafficLabel}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); requestDelete(s); }}
                        className="p-2 rounded-lg border hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition"
                        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--muted)" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {isExpanded && hasUtmData && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3 text-xs" style={{ borderColor: "var(--border)" }}>
                        {s.utmSource && (
                          <div><p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted2)" }}>Source</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmSource}</p></div>
                        )}
                        {s.utmMedium && (
                          <div><p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted2)" }}>Medium</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmMedium}</p></div>
                        )}
                        {s.utmCampaign && (
                          <div className="col-span-2"><p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted2)" }}>Campaign</p><p className="font-medium" style={{ color: "var(--muted)" }}>{s.utmCampaign}</p></div>
                        )}
                        {s.referrer && (
                          <div className="col-span-2">
                            <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted2)" }}>Referrer</p>
                            <p className="font-medium truncate flex items-center gap-1" style={{ color: "var(--muted)" }}>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              {s.referrer}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Results count */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs" style={{ color: "var(--muted2)" }}>
          Showing {filtered.length} signup{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-t sm:border p-6 shadow-2xl" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <div className="w-12 h-1 rounded-full mx-auto mb-4 sm:hidden" style={{ background: "color-mix(in srgb, var(--text) 20%, transparent)" }} />
            <div className="text-lg sm:text-xl font-black" style={{ color: "var(--text)" }}>Delete signup?</div>
            <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              Remove <span className="font-semibold break-all" style={{ color: "var(--text)" }}>{deleteEmail}</span> from the list.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="order-2 sm:order-1 rounded-xl border px-5 py-3 sm:py-2.5 text-sm font-medium hover:opacity-80 transition"
                style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--text) 5%, transparent)", color: "var(--text)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="order-1 sm:order-2 rounded-xl bg-red-500 px-5 py-3 sm:py-2.5 text-sm font-bold text-white hover:bg-red-400 disabled:opacity-60 transition"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
