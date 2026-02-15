"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  Bug,
  Lightbulb,
  HelpCircle,
  AlertTriangle,
  Star,
  Check,
  Clock,
  Eye,
  Mail,
  Image as ImageIcon,
  Bot,
  AlertCircle,
  Archive,
  ExternalLink,
} from "lucide-react";

type Feedback = {
  id: string;
  feedbackType: string;
  tool: string;
  feedbackText: string;
  stepsToReproduce: string | null;
  pageUrl: string | null;
  rating: number | null;
  importance: string | null;
  wasLoggedIn: boolean | null;
  device: string | null;
  browser: string | null;
  email: string | null;
  canContact: boolean;
  userId: string | null;
  sleeperUsername: string | null;
  screenshotUrl: string | null;
  screenshotMeta: string | null;
  aiSummary: string | null;
  aiCategory: string | null;
  aiSeverity: string | null;
  aiReproSteps: string | null;
  aiSuspectedCause: string | null;
  aiSuggestedFix: string | null;
  aiTriagedAt: string | null;
  status: string;
  priority: string | null;
  assignedTo: string | null;
  adminNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const FEEDBACK_TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  like: { icon: ThumbsUp, color: "text-green-400 bg-green-500/20", label: "Like" },
  bug: { icon: Bug, color: "text-red-400 bg-red-500/20", label: "Bug" },
  feature: { icon: Lightbulb, color: "text-amber-400 bg-amber-500/20", label: "Feature" },
  confusing: { icon: HelpCircle, color: "text-purple-400 bg-purple-500/20", label: "Confusing" },
  wrong: { icon: AlertTriangle, color: "text-orange-400 bg-orange-500/20", label: "Issue" },
  general: { icon: MessageSquare, color: "text-cyan-400 bg-cyan-500/20", label: "General" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new: { bg: "bg-blue-500/20", text: "text-blue-300" },
  triaged: { bg: "bg-cyan-500/20", text: "text-cyan-300" },
  in_review: { bg: "bg-amber-500/20", text: "text-amber-300" },
  in_progress: { bg: "bg-purple-500/20", text: "text-purple-300" },
  resolved: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
  closed: { bg: "bg-gray-500/20", text: "text-gray-300" },
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  Critical: { bg: "bg-red-500/20", text: "text-red-300" },
  High: { bg: "bg-orange-500/20", text: "text-orange-300" },
  Medium: { bg: "bg-amber-500/20", text: "text-amber-300" },
  Low: { bg: "bg-green-500/20", text: "text-green-300" },
};

const PRIORITY_LABELS: Record<string, string> = {
  p0: "P0 - Critical",
  p1: "P1 - High",
  p2: "P2 - Medium",
  p3: "P3 - Low",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, rows: Feedback[]) {
  const headers = ["id", "feedbackType", "tool", "aiSeverity", "aiCategory", "feedbackText", "status", "priority", "email", "createdAt"];
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [r.id, r.feedbackType, r.tool, r.aiSeverity, r.aiCategory, r.feedbackText, r.status, r.priority, r.email, r.createdAt]
        .map(escape)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [toolFilter, setToolFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [assignedTo, setAssignedTo] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setFeedback(json.feedback || []);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const tools = Array.from(new Set(feedback.map((f) => f.tool))).sort();

  const filtered = feedback.filter((f) => {
    const matchesSearch =
      f.feedbackText.toLowerCase().includes(search.toLowerCase()) ||
      f.tool.toLowerCase().includes(search.toLowerCase()) ||
      (f.aiSummary && f.aiSummary.toLowerCase().includes(search.toLowerCase())) ||
      (f.email && f.email.toLowerCase().includes(search.toLowerCase())) ||
      (f.sleeperUsername && f.sleeperUsername.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || f.status === statusFilter;
    const matchesType = typeFilter === "all" || f.feedbackType === typeFilter;
    const matchesSeverity = severityFilter === "all" || f.aiSeverity === severityFilter;
    const matchesTool = toolFilter === "all" || f.tool === toolFilter;
    return matchesSearch && matchesStatus && matchesType && matchesSeverity && matchesTool;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateFeedback = async (id: string, updates: { status?: string; priority?: string; assignedTo?: string }) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...updates,
          adminNotes: adminNotes[id] || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  };

  const statusCounts = {
    all: feedback.length,
    new: feedback.filter((f) => f.status === "new").length,
    triaged: feedback.filter((f) => f.status === "triaged").length,
    in_review: feedback.filter((f) => f.status === "in_review").length,
    in_progress: feedback.filter((f) => f.status === "in_progress").length,
    resolved: feedback.filter((f) => f.status === "resolved").length,
    closed: feedback.filter((f) => f.status === "closed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Issues Queue
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Bug reports, feedback, and feature requests
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCsv("feedback-export.csv", filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {(["all", "new", "triaged", "in_review", "in_progress", "resolved", "closed"] as const).map((s) => {
          const colors = s === "all" ? { bg: "bg-white/5", text: "text-white" } : STATUS_COLORS[s];
          const label = s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-xl px-3 py-2.5 text-center transition-all border ${
                statusFilter === s
                  ? `${colors.bg} ${colors.text} border-white/20`
                  : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/5"
              }`}
            >
              <div className="text-lg font-bold">{statusCounts[s]}</div>
              <div className="text-[10px] mt-0.5 truncate">{label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
        >
          <option value="all" className="bg-slate-900">All Types</option>
          {Object.entries(FEEDBACK_TYPE_META).map(([key, meta]) => (
            <option key={key} value={key} className="bg-slate-900">{meta.label}</option>
          ))}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
        >
          <option value="all" className="bg-slate-900">All Severities</option>
          <option value="Critical" className="bg-slate-900">Critical</option>
          <option value="High" className="bg-slate-900">High</option>
          <option value="Medium" className="bg-slate-900">Medium</option>
          <option value="Low" className="bg-slate-900">Low</option>
        </select>

        <select
          value={toolFilter}
          onChange={(e) => setToolFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white focus:border-cyan-500/50 focus:outline-none"
        >
          <option value="all" className="bg-slate-900">All Tools</option>
          {tools.map((t) => (
            <option key={t} value={t} className="bg-slate-900">{t}</option>
          ))}
        </select>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search feedback, AI summary, email, or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/40 focus:border-cyan-500/50"
        />
      </div>

      <div className="space-y-3">
        {loading && feedback.length === 0 && (
          <div className="text-center py-12 text-white/50">Loading issues...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/50">
            {search || statusFilter !== "all" || typeFilter !== "all" || severityFilter !== "all" || toolFilter !== "all"
              ? "No issues match your filters"
              : "No issues yet"}
          </div>
        )}

        {filtered.map((f) => {
          const isExpanded = expandedIds.has(f.id);
          const typeMeta = FEEDBACK_TYPE_META[f.feedbackType] || FEEDBACK_TYPE_META.general;
          const TypeIcon = typeMeta.icon;
          const statusColors = STATUS_COLORS[f.status] || STATUS_COLORS.new;
          const severityColors = SEVERITY_COLORS[f.aiSeverity || ""] || {};

          return (
            <div
              key={f.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(f.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition text-left"
              >
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg ${typeMeta.color}`}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {f.aiSummary ? (
                        <span className="text-white font-medium line-clamp-1">{f.aiSummary}</span>
                      ) : (
                        <span className="text-white font-medium line-clamp-1">{f.feedbackText.slice(0, 60)}...</span>
                      )}
                      {f.screenshotUrl && <ImageIcon className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />}
                      {f.aiTriagedAt && <Bot className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{f.tool}</div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.aiSeverity && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${severityColors.bg} ${severityColors.text}`}>
                        {f.aiSeverity}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}>
                      {f.status.replace("_", " ")}
                    </span>
                    {f.priority && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/60">
                        {f.priority.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs text-white/40 hidden sm:block">{fmtDate(f.createdAt)}</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5 p-4 space-y-4 bg-white/[0.01]">
                  {f.aiTriagedAt && f.aiSummary && (
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
                      <div className="flex items-center gap-2 text-purple-300 font-medium mb-3">
                        <Bot className="h-4 w-4" />
                        AI Triage
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-white/40">Category</div>
                          <div className="text-sm text-white/80">{f.aiCategory || "N/A"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40">Severity</div>
                          <div className={`text-sm font-medium ${severityColors.text || "text-white/80"}`}>
                            {f.aiSeverity || "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40">Auto-Priority</div>
                          <div className="text-sm text-white/80">{f.priority ? PRIORITY_LABELS[f.priority] : "N/A"}</div>
                        </div>
                      </div>
                      {f.aiReproSteps && (
                        <div className="mb-3">
                          <div className="text-xs text-white/40">Reproduction Steps</div>
                          <div className="text-sm text-white/80 whitespace-pre-wrap mt-1">{f.aiReproSteps}</div>
                        </div>
                      )}
                      {f.aiSuspectedCause && (
                        <div className="mb-3">
                          <div className="text-xs text-white/40">Suspected Cause</div>
                          <div className="text-sm text-white/80 mt-1">{f.aiSuspectedCause}</div>
                        </div>
                      )}
                      {f.aiSuggestedFix && (
                        <div>
                          <div className="text-xs text-white/40">Suggested Fix</div>
                          <div className="text-sm text-white/80 mt-1">{f.aiSuggestedFix}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                    <div className="text-xs text-white/40 mb-1">User Description</div>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">{f.feedbackText}</div>
                  </div>

                  {f.stepsToReproduce && (
                    <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                      <div className="text-xs text-white/40 mb-1">User&apos;s Steps to Reproduce</div>
                      <div className="text-sm text-white/80 whitespace-pre-wrap">{f.stepsToReproduce}</div>
                    </div>
                  )}

                  {f.screenshotUrl && (
                    <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                      <div className="text-xs text-white/40 mb-2">Screenshot</div>
                      <a
                        href={f.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={f.screenshotUrl}
                          alt="Bug screenshot"
                          className="max-w-full max-h-64 rounded-lg border border-white/10"
                        />
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-white/40 mb-1">User</div>
                      <div className="text-white/80">
                        {f.sleeperUsername || f.userId || "Anonymous"}
                      </div>
                      {f.wasLoggedIn !== null && (
                        <span className={`text-xs ${f.wasLoggedIn ? "text-green-400" : "text-white/40"}`}>
                          {f.wasLoggedIn ? "Logged in" : "Guest"}
                        </span>
                      )}
                    </div>
                    {f.email && (
                      <div>
                        <div className="text-xs text-white/40 mb-1">Email</div>
                        <div className="text-cyan-400 text-xs">{f.email}</div>
                        {f.canContact && <span className="text-xs text-green-400">Can contact</span>}
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-white/40 mb-1">Device / Browser</div>
                      <div className="text-white/80">{f.device || "?"} / {f.browser || "?"}</div>
                    </div>
                    {f.pageUrl && (
                      <div>
                        <div className="text-xs text-white/40 mb-1">Page URL</div>
                        <a
                          href={f.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 text-xs hover:underline flex items-center gap-1"
                        >
                          View Page <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Admin Notes</label>
                        <textarea
                          value={adminNotes[f.id] ?? f.adminNotes ?? ""}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder="Add internal notes..."
                          rows={2}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Assigned To</label>
                        <input
                          type="text"
                          value={assignedTo[f.id] ?? f.assignedTo ?? ""}
                          onChange={(e) => setAssignedTo((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          placeholder="Email or name..."
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {f.status === "new" && (
                        <button
                          onClick={() => updateFeedback(f.id, { status: "triaged" })}
                          disabled={updating === f.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50"
                        >
                          <Bot className="h-3.5 w-3.5" />
                          Mark Triaged
                        </button>
                      )}
                      {f.status !== "in_review" && f.status !== "in_progress" && f.status !== "resolved" && f.status !== "closed" && (
                        <button
                          onClick={() => updateFeedback(f.id, { status: "in_review" })}
                          disabled={updating === f.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          In Review
                        </button>
                      )}
                      {f.status !== "in_progress" && f.status !== "resolved" && f.status !== "closed" && (
                        <button
                          onClick={() => updateFeedback(f.id, { status: "in_progress", assignedTo: assignedTo[f.id] || f.assignedTo || undefined })}
                          disabled={updating === f.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition disabled:opacity-50"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          In Progress
                        </button>
                      )}
                      {f.status !== "resolved" && f.status !== "closed" && (
                        <button
                          onClick={() => updateFeedback(f.id, { status: "resolved" })}
                          disabled={updating === f.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Resolved
                        </button>
                      )}
                      {f.status !== "closed" && (
                        <button
                          onClick={() => updateFeedback(f.id, { status: "closed" })}
                          disabled={updating === f.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-500/20 border border-gray-500/30 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-500/30 transition disabled:opacity-50"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Close
                        </button>
                      )}
                      {f.email && (
                        <a
                          href={`mailto:${f.email}?subject=Re: Your AllFantasy Feedback`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Reply
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
