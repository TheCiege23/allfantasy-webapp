"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Check,
  X,
  Clock,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

type LeagueSubmission = {
  id: string;
  leagueTypeName: string;
  tagline: string;
  description: string;
  sports: string[];
  recommendedSize: string;
  seasonFormat: string;
  draftType: string;
  winCondition: string;
  hasSpecialScoring: boolean;
  scoringRules: string | null;
  positionsImpacted: string | null;
  specialMechanics: string[];
  weeklyFlow: string;
  edgeCases: string | null;
  rosterSetup: string | null;
  waiverSystem: string | null;
  tradeRules: string | null;
  playoffSetup: string | null;
  commissionerTools: string | null;
  creditName: string;
  email: string;
  socialHandle: string | null;
  permissionConsent: boolean;
  rightsConsent: boolean;
  canContact: boolean;
  status: string;
  adminNotes: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  received: { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/30" },
  in_review: { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/30" },
  accepted: { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/30" },
  rejected: { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/30" },
  needs_clarification: { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-500/30" },
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, rows: LeagueSubmission[]) {
  const headers = [
    "id",
    "leagueTypeName",
    "tagline",
    "sports",
    "seasonFormat",
    "creditName",
    "email",
    "status",
    "createdAt",
  ];
  const escape = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n"))
      return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.leagueTypeName,
        r.tagline,
        r.sports.join("; "),
        r.seasonFormat,
        r.creditName,
        r.email,
        r.status,
        r.createdAt,
      ]
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

export default function AdminLeagueIdeas() {
  const [submissions, setSubmissions] = useState<LeagueSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/league-submissions", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setSubmissions(json.submissions || []);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      s.leagueTypeName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.creditName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/league-submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, adminNotes: adminNotes[id] || null }),
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
    all: submissions.length,
    received: submissions.filter((s) => s.status === "received").length,
    in_review: submissions.filter((s) => s.status === "in_review").length,
    accepted: submissions.filter((s) => s.status === "accepted").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
    needs_clarification: submissions.filter((s) => s.status === "needs_clarification").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            League Submissions
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Review and manage community league type ideas
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCsv("league-submissions.csv", filtered)}
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(["all", "received", "in_review", "accepted", "rejected", "needs_clarification"] as const).map(
          (s) => {
            const colors =
              s === "all"
                ? { bg: "bg-white/5", text: "text-white", border: "border-white/10" }
                : STATUS_COLORS[s];
            const label =
              s === "all"
                ? "All"
                : s === "in_review"
                ? "In Review"
                : s === "needs_clarification"
                ? "Needs Clarification"
                : s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-xl px-4 py-3 text-center transition-all border ${
                  statusFilter === s
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : "bg-white/[0.02] border-white/5 text-white/50 hover:bg-white/5"
                }`}
              >
                <div className="text-xl font-bold">{statusCounts[s]}</div>
                <div className="text-xs mt-0.5">{label}</div>
              </button>
            );
          }
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search by name, email, or credit name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/40 focus:border-cyan-500/50"
        />
      </div>

      <div className="space-y-3">
        {loading && submissions.length === 0 && (
          <div className="text-center py-12 text-white/50">Loading submissions...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-white/50">
            {search || statusFilter !== "all"
              ? "No submissions match your filters"
              : "No league submissions yet"}
          </div>
        )}

        {filtered.map((s) => {
          const isExpanded = expandedIds.has(s.id);
          const colors = STATUS_COLORS[s.status] || STATUS_COLORS.received;

          return (
            <div
              key={s.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(s.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition text-left"
              >
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
                    <Lightbulb className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">{s.leagueTypeName}</span>
                    <div className="text-xs text-white/40 mt-0.5">{s.tagline}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {s.status.replace("_", " ")}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {s.sports.slice(0, 3).map((sport, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300"
                      >
                        {sport}
                      </span>
                    ))}
                    {s.sports.length > 3 && (
                      <span className="text-xs text-white/40">+{s.sports.length - 3}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/40 hidden sm:block">{fmtDate(s.createdAt)}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5 p-4 space-y-4 bg-white/[0.01]">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-white/40 mb-1">Creator</div>
                      <div className="text-sm text-white/80">{s.creditName}</div>
                      <div className="text-xs text-cyan-400 mt-0.5">{s.email}</div>
                      {s.socialHandle && (
                        <div className="text-xs text-white/50 mt-0.5">{s.socialHandle}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">Format</div>
                      <div className="text-sm text-white/80">
                        {s.seasonFormat} • {s.recommendedSize} teams
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        {s.draftType} draft • {s.winCondition}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">Consents</div>
                      <div className="flex gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            s.permissionConsent
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          Permission {s.permissionConsent ? "✓" : "✗"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            s.rightsConsent
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          Rights {s.rightsConsent ? "✓" : "✗"}
                        </span>
                        {s.canContact && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                            Can Contact
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                    <div className="text-xs text-white/40 mb-1">Description</div>
                    <div className="text-sm text-white/80 whitespace-pre-wrap">{s.description}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                      <div className="text-xs text-white/40 mb-1">Weekly Flow</div>
                      <div className="text-sm text-white/80 whitespace-pre-wrap">{s.weeklyFlow}</div>
                    </div>
                    <div className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                      <div className="text-xs text-white/40 mb-1">Special Mechanics</div>
                      <div className="flex flex-wrap gap-1">
                        {s.specialMechanics.map((m, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(s.scoringRules || s.edgeCases || s.rosterSetup || s.commissionerTools) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {s.scoringRules && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Scoring Rules</div>
                          <div className="text-sm text-white/80">{s.scoringRules}</div>
                        </div>
                      )}
                      {s.edgeCases && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Edge Cases</div>
                          <div className="text-sm text-white/80">{s.edgeCases}</div>
                        </div>
                      )}
                      {s.rosterSetup && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Roster Setup</div>
                          <div className="text-sm text-white/80">{s.rosterSetup}</div>
                        </div>
                      )}
                      {s.commissionerTools && (
                        <div>
                          <div className="text-xs text-white/40 mb-1">Commissioner Tools</div>
                          <div className="text-sm text-white/80">{s.commissionerTools}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Admin Notes</label>
                      <textarea
                        value={adminNotes[s.id] ?? s.adminNotes ?? ""}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                        placeholder="Add internal notes about this submission..."
                        rows={2}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.status !== "in_review" && (
                        <button
                          onClick={() => updateStatus(s.id, "in_review")}
                          disabled={updating === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Mark In Review
                        </button>
                      )}
                      {s.status !== "accepted" && (
                        <button
                          onClick={() => updateStatus(s.id, "accepted")}
                          disabled={updating === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Accept
                        </button>
                      )}
                      {s.status !== "rejected" && (
                        <button
                          onClick={() => updateStatus(s.id, "rejected")}
                          disabled={updating === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 transition disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      )}
                      {s.status !== "needs_clarification" && (
                        <button
                          onClick={() => updateStatus(s.id, "needs_clarification")}
                          disabled={updating === s.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/30 transition disabled:opacity-50"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Needs Clarification
                        </button>
                      )}
                      <a
                        href={`mailto:${s.email}?subject=Re: Your AllFantasy League Submission - ${s.leagueTypeName}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Email Creator
                      </a>
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
