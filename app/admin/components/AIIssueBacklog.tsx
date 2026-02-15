"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  ChevronRight,
  X,
  Tag,
  MessageSquare,
  Brain,
  TrendingDown,
  Plus,
  Shield,
  Wrench,
  BarChart3,
  Layers,
  CheckCheck,
} from "lucide-react";

interface AIIssue {
  id: string;
  title: string;
  description: string | null;
  area: string;
  priority: string;
  status: string;
  avgConfidence: number | null;
  reportCount: number;
  feltOffRate: number | null;
  sport: string | null;
  leagueType: string | null;
  aiSelfAssessment: string | null;
  tags: string[];
  resolutionSummary: string | null;
  resolutionType: string | null;
  resolvedAt: string | null;
  createdAt: string;
  feedbackItems: {
    id: string;
    feedbackText: string;
    feedbackType: string | null;
    confidenceLevel: string | null;
  }[];
}

interface Stats {
  openCount: number;
  avgConfidence: number;
  avgFeltOffRate: number;
  avgResolutionDays: number;
}

const AREAS = ["Trade AI", "Roster AI", "Projections", "Explanations", "Waiver AI", "Rankings"];
const PRIORITIES = ["high", "medium", "low"];
const STATUSES = ["open", "investigating", "in_progress", "resolved", "wont_fix"];
const TAGS = [
  "Data coverage gap",
  "League format edge case",
  "Valuation weighting",
  "Time horizon mismatch",
  "Explanation clarity",
  "User expectation mismatch",
];
const RESOLUTION_TYPES = [
  "Logic adjustment",
  "Data expansion",
  "Explanation improvement",
  "Labeling change",
  "Other",
];

const priorityColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400",
  investigating: "bg-purple-500/20 text-purple-400",
  in_progress: "bg-cyan-500/20 text-cyan-400",
  resolved: "bg-emerald-500/20 text-emerald-400",
  wont_fix: "bg-gray-500/20 text-gray-400",
};

const confidenceColors: Record<string, string> = {
  high: "text-emerald-400",
  learning: "text-amber-400",
  evolving: "text-blue-400",
};

export default function AIIssueBacklog() {
  const [issues, setIssues] = useState<AIIssue[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<AIIssue | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterArea, setFilterArea] = useState("all");

  const [resolveModal, setResolveModal] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionType, setResolutionType] = useState("");

  const [bulkTriageConfirm, setBulkTriageConfirm] = useState(false);
  const [bulkTriaging, setBulkTriaging] = useState(false);

  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    area: "",
    priority: "low",
    sport: "",
    leagueType: "",
    tags: [] as string[],
  });

  const topFailingTools = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach((i) => {
      const key = i.area || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [issues]);

  const severityBreakdown = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    issues.forEach((i) => {
      const p = i.priority?.toLowerCase() || "low";
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [issues]);

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach((i) => {
      i.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [issues]);

  const sloStatus = useMemo(() => {
    const now = Date.now();
    const openIssues = issues.filter((i) => i.status !== "resolved" && i.status !== "wont_fix");
    const totalOpen = openIssues.length;

    const criticalBreach = openIssues.filter((i) => {
      if (i.priority !== "critical") return false;
      const age = now - new Date(i.createdAt).getTime();
      return age > 24 * 60 * 60 * 1000;
    }).length;

    const highWarning = openIssues.filter((i) => {
      if (i.priority !== "high") return false;
      const age = now - new Date(i.createdAt).getTime();
      return age > 48 * 60 * 60 * 1000;
    }).length;

    const resolved = issues.filter((i) => i.status === "resolved" && i.resolvedAt && i.createdAt);
    let avgResolution = 0;
    if (resolved.length > 0) {
      const totalDays = resolved.reduce((sum, i) => {
        const created = new Date(i.createdAt).getTime();
        const resolvedAt = new Date(i.resolvedAt!).getTime();
        return sum + (resolvedAt - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolution = totalDays / resolved.length;
    }

    return { totalOpen, criticalBreach, highWarning, avgResolution, resolvedCount: resolved.length };
  }, [issues]);

  const lowOpenIssues = useMemo(() => {
    return issues.filter((i) => i.priority === "low" && i.status === "open");
  }, [issues]);

  const bulkTriageLow = async () => {
    setBulkTriaging(true);
    try {
      await Promise.all(
        lowOpenIssues.map((i) =>
          updateIssue(i.id, { status: "investigating" } as any)
        )
      );
    } catch (e) {
      console.error("Bulk triage failed:", e);
    } finally {
      setBulkTriaging(false);
      setBulkTriageConfirm(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [filterStatus, filterPriority, filterArea]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (filterArea !== "all") params.set("area", filterArea);

      const res = await fetch(`/api/admin/ai-issues?${params}`);
      const data = await res.json();
      setIssues(data.issues || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error("Failed to load issues:", e);
    } finally {
      setLoading(false);
    }
  };

  const updateIssue = async (id: string, updates: Partial<AIIssue>) => {
    try {
      const res = await fetch(`/api/admin/ai-issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.issue) {
        setIssues((prev) => prev.map((i) => (i.id === id ? data.issue : i)));
        if (selectedIssue?.id === id) setSelectedIssue(data.issue);
      }
    } catch (e) {
      console.error("Failed to update issue:", e);
    }
  };

  const createIssue = async () => {
    if (!newIssue.title || !newIssue.area) return;
    try {
      const res = await fetch("/api/admin/ai-issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIssue),
      });
      const data = await res.json();
      if (data.issue) {
        setIssues((prev) => [data.issue, ...prev]);
        setShowCreateModal(false);
        setNewIssue({ title: "", description: "", area: "", priority: "low", sport: "", leagueType: "", tags: [] });
      }
    } catch (e) {
      console.error("Failed to create issue:", e);
    }
  };

  const resolveIssue = async () => {
    if (!selectedIssue || !resolutionSummary) return;
    await updateIssue(selectedIssue.id, {
      status: "resolved",
      resolutionSummary,
      resolutionType,
    } as any);
    setResolveModal(false);
    setResolutionSummary("");
    setResolutionType("");
  };

  const toggleTag = (tag: string) => {
    if (!selectedIssue) return;
    const newTags = selectedIssue.tags.includes(tag)
      ? selectedIssue.tags.filter((t) => t !== tag)
      : [...selectedIssue.tags, tag];
    updateIssue(selectedIssue.id, { tags: newTags } as any);
  };

  return (
    <div className="space-y-6">
      {/* Top-N Summary Cards */}
      {!loading && issues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
              <Wrench className="h-4 w-4 text-cyan-400" />
              Top Failing Tools
            </div>
            {topFailingTools.length === 0 ? (
              <p className="text-white/30 text-sm">No data</p>
            ) : (
              <div className="space-y-2">
                {topFailingTools.map(([tool, count]) => (
                  <div key={tool} className="flex items-center justify-between">
                    <span className="text-sm text-white/80 truncate">{tool}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Top Severities
            </div>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                <div key={sev} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${
                      sev === "critical" ? "bg-red-500" : sev === "high" ? "bg-orange-500" : sev === "medium" ? "bg-amber-400" : "bg-yellow-400"
                    }`} />
                    <span className="text-white/80 capitalize">{sev}</span>
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60">{severityBreakdown[sev] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
            <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
              <Layers className="h-4 w-4 text-purple-400" />
              Top Categories
            </div>
            {topCategories.length === 0 ? (
              <p className="text-white/30 text-sm">No tags yet</p>
            ) : (
              <div className="space-y-2">
                {topCategories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm text-white/80 truncate">{cat}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/60">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SLO Status Card */}
      {!loading && issues.length > 0 && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-3">
            <Shield className="h-4 w-4 text-blue-400" />
            SLO Status
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-white/40 mb-1">Total Open</div>
              <div className="text-xl font-bold text-white">{sloStatus.totalOpen}</div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Critical &gt; 24h (Breach)</div>
              <div className={`text-xl font-bold ${sloStatus.criticalBreach > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {sloStatus.criticalBreach}
                {sloStatus.criticalBreach > 0 && <span className="text-xs ml-1 font-normal">⚠ SLO BREACH</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">High &gt; 48h (Warning)</div>
              <div className={`text-xl font-bold ${sloStatus.highWarning > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {sloStatus.highWarning}
                {sloStatus.highWarning > 0 && <span className="text-xs ml-1 font-normal">⚠ Warning</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/40 mb-1">Avg Time-to-Resolution</div>
              <div className="text-xl font-bold text-white">
                {sloStatus.resolvedCount > 0 ? `${sloStatus.avgResolution.toFixed(1)}d` : "N/A"}
              </div>
              {sloStatus.resolvedCount > 0 && (
                <div className="text-[10px] text-white/30">{sloStatus.resolvedCount} resolved</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            Open AI Issues
          </div>
          <div className="text-2xl font-bold text-white">{stats?.openCount ?? 0}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <Brain className="h-4 w-4 text-amber-400" />
            Avg Confidence (Open)
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.avgConfidence ? (stats.avgConfidence * 100).toFixed(0) + "%" : "N/A"}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <TrendingDown className="h-4 w-4 text-orange-400" />
            "Felt Off" Rate
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.avgFeltOffRate ? (stats.avgFeltOffRate * 100).toFixed(0) + "%" : "N/A"}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            Avg Resolution Time
          </div>
          <div className="text-2xl font-bold text-white">
            {stats?.avgResolutionDays ? stats.avgResolutionDays.toFixed(1) + " days" : "N/A"}
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">All Priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">All Areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {lowOpenIssues.length > 0 && (
            <button
              onClick={() => setBulkTriageConfirm(true)}
              className="flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 transition"
            >
              <CheckCheck className="h-4 w-4" />
              Bulk Triage Low ({lowOpenIssues.length})
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/30 transition"
          >
            <Plus className="h-4 w-4" />
            Create Issue
          </button>
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/50">Loading...</div>
        ) : issues.length === 0 ? (
          <div className="p-8 text-center text-white/50">No issues found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr className="text-left text-white/50">
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Issue</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Reports</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[issue.priority] || priorityColors.low}`}>
                      {issue.priority === "high" ? "🔴" : issue.priority === "medium" ? "🟠" : "🟡"} {issue.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{issue.title}</div>
                    {issue.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {issue.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70">{issue.area}</td>
                  <td className="px-4 py-3">
                    {issue.avgConfidence !== null ? (
                      <span className={issue.avgConfidence < 0.5 ? "text-amber-400" : "text-emerald-400"}>
                        {(issue.avgConfidence * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-white/70">{issue.reportCount}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[issue.status] || statusColors.open}`}>
                      {issue.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedIssue(issue)}
                      className="text-cyan-400 hover:text-cyan-300 transition"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Issue Detail Panel */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedIssue(null)} />
          <div className="relative w-full max-w-2xl bg-slate-900 border-l border-white/10 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-slate-900">
              <h2 className="text-lg font-semibold text-white">Issue Details</h2>
              <button onClick={() => setSelectedIssue(null)} className="text-white/50 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-bold text-white">{selectedIssue.title}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[selectedIssue.priority]}`}>
                    {selectedIssue.priority}
                  </span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-white/50">Area:</span>
                  <span className="text-white">{selectedIssue.area}</span>
                  <span className="text-white/20 mx-2">|</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColors[selectedIssue.status]}`}>
                    {selectedIssue.status.replace("_", " ")}
                  </span>
                </div>
                {selectedIssue.description && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-xs text-white/50 mb-1">Why this matters</div>
                    <p className="text-sm text-white/80">{selectedIssue.description}</p>
                  </div>
                )}
              </div>

              {/* Signals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Feedback reports</div>
                  <div className="text-lg font-bold text-white">{selectedIssue.reportCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Avg confidence</div>
                  <div className="text-lg font-bold text-white">
                    {selectedIssue.avgConfidence ? (selectedIssue.avgConfidence * 100).toFixed(0) + "%" : "N/A"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">"Felt off" rate</div>
                  <div className="text-lg font-bold text-white">
                    {selectedIssue.feltOffRate ? (selectedIssue.feltOffRate * 100).toFixed(0) + "%" : "N/A"}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50">Sport / League</div>
                  <div className="text-sm font-medium text-white">
                    {selectedIssue.sport || "All"} / {selectedIssue.leagueType || "All"}
                  </div>
                </div>
              </div>

              {/* AI Self-Assessment */}
              {selectedIssue.aiSelfAssessment && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2 text-xs text-amber-400 mb-1">
                    <Brain className="h-3 w-3" />
                    AI Self-Assessment
                  </div>
                  <p className="text-sm text-white/80">{selectedIssue.aiSelfAssessment}</p>
                </div>
              )}

              {/* Representative Feedback */}
              {selectedIssue.feedbackItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    Representative Feedback
                  </div>
                  <div className="space-y-2">
                    {selectedIssue.feedbackItems.slice(0, 5).map((fb) => (
                      <div key={fb.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                        <p className="text-sm text-white/80 italic">"{fb.feedbackText}"</p>
                        <div className="flex gap-2 mt-2 text-xs text-white/40">
                          {fb.feedbackType && <span>{fb.feedbackType}</span>}
                          {fb.confidenceLevel && (
                            <span className={confidenceColors[fb.confidenceLevel]}>
                              {fb.confidenceLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
                  <Tag className="h-4 w-4" />
                  Issue Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        selectedIssue.tags.includes(tag)
                          ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-400"
                          : "bg-white/5 border border-white/10 text-white/50 hover:text-white/70"
                      }`}
                    >
                      {selectedIssue.tags.includes(tag) ? "✓ " : ""}{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status & Actions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  Status
                </div>
                <select
                  value={selectedIssue.status}
                  onChange={(e) => updateIssue(selectedIssue.id, { status: e.target.value } as any)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-slate-900">{s.replace("_", " ")}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={() => updateIssue(selectedIssue.id, { status: "in_progress" } as any)}
                    className="flex-1 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 font-medium hover:bg-cyan-500/30 transition"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => setResolveModal(true)}
                    className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/30 transition"
                  >
                    Resolve Issue
                  </button>
                </div>
              </div>

              {/* Resolution Info */}
              {selectedIssue.status === "resolved" && selectedIssue.resolutionSummary && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                    <CheckCircle className="h-4 w-4" />
                    Resolved
                  </div>
                  <p className="text-sm text-white/80">{selectedIssue.resolutionSummary}</p>
                  {selectedIssue.resolutionType && (
                    <div className="mt-2 text-xs text-white/40">Type: {selectedIssue.resolutionType}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && selectedIssue && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResolveModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Resolve Issue</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">Resolution Summary *</label>
                <textarea
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="What was fixed?"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Resolution Type</label>
                <select
                  value={resolutionType}
                  onChange={(e) => setResolutionType(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white"
                >
                  <option value="">Select...</option>
                  {RESOLUTION_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-slate-900">{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setResolveModal(false)}
                  className="flex-1 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={resolveIssue}
                  disabled={!resolutionSummary}
                  className="flex-1 py-2 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition disabled:opacity-50"
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Issue Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Create AI Issue</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/50 mb-1">Title *</label>
                <input
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  placeholder="e.g., Dynasty WR depth undervalued"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Area *</label>
                <select
                  value={newIssue.area}
                  onChange={(e) => setNewIssue({ ...newIssue, area: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white"
                >
                  <option value="">Select...</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a} className="bg-slate-900">{a}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/50 mb-1">Priority</label>
                  <select
                    value={newIssue.priority}
                    onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} className="bg-slate-900">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/50 mb-1">Sport</label>
                  <input
                    value={newIssue.sport}
                    onChange={(e) => setNewIssue({ ...newIssue, sport: e.target.value })}
                    placeholder="e.g., NFL"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-white/50 mb-1">Description</label>
                <textarea
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  placeholder="Why does this matter?"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createIssue}
                  disabled={!newIssue.title || !newIssue.area}
                  className="flex-1 py-2 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition disabled:opacity-50"
                >
                  Create Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Triage Confirmation */}
      {bulkTriageConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setBulkTriageConfirm(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/5 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Bulk Triage Low-Severity Issues</h3>
            <p className="text-sm text-white/60 mb-4">
              This will mark <span className="text-amber-400 font-medium">{lowOpenIssues.length}</span> low-priority open issue{lowOpenIssues.length !== 1 ? "s" : ""} as &quot;investigating&quot; (acknowledged). This action cannot be undone in bulk.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkTriageConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 transition"
              >
                Cancel
              </button>
              <button
                onClick={bulkTriageLow}
                disabled={bulkTriaging}
                className="flex-1 py-2 rounded-lg bg-amber-500 text-white font-medium hover:bg-amber-600 transition disabled:opacity-50"
              >
                {bulkTriaging ? "Triaging..." : "Confirm Triage"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
