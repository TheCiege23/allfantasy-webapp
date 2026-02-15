"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Download, Search, ChevronDown, ChevronUp, ClipboardList, BarChart3, Filter, Calendar } from "lucide-react";

interface QuestionnaireResponse {
  id: string;
  email: string;
  favoriteSport: string;
  favoriteLeagueType: string;
  competitiveness: string;
  draftPreference: string;
  painPoint: string;
  experimentalInterest: string[];
  freeText: string | null;
  createdAt: string;
}

type DateRange = "7d" | "30d" | "all";
type QuestionFilter = "all" | "favoriteSport" | "favoriteLeagueType" | "competitiveness" | "draftPreference" | "painPoint";

const QUESTION_LABELS: Record<string, string> = {
  favoriteSport: "Favorite Sport",
  favoriteLeagueType: "League Type",
  competitiveness: "Competitiveness",
  draftPreference: "Draft Preference",
  painPoint: "Pain Point",
};

const QUESTION_KEYS = Object.keys(QUESTION_LABELS) as (keyof typeof QUESTION_LABELS)[];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(filename: string, rows: QuestionnaireResponse[]) {
  const headers = [
    "email",
    "favoriteSport",
    "favoriteLeagueType",
    "competitiveness",
    "draftPreference",
    "painPoint",
    "experimentalInterest",
    "freeText",
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
        r.email,
        r.favoriteSport,
        r.favoriteLeagueType,
        r.competitiveness,
        r.draftPreference,
        r.painPoint,
        r.experimentalInterest.join("; "),
        r.freeText || "",
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

function computeTopAnswers(responses: QuestionnaireResponse[]) {
  const results: Record<string, { answer: string; count: number }[]> = {};

  for (const key of QUESTION_KEYS) {
    const counts: Record<string, number> = {};
    for (const r of responses) {
      const val = (r as any)[key] as string;
      if (val) {
        counts[val] = (counts[val] || 0) + 1;
      }
    }
    results[key] = Object.entries(counts)
      .map(([answer, count]) => ({ answer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  return results;
}

function filterByDateRange(responses: QuestionnaireResponse[], range: DateRange): QuestionnaireResponse[] {
  if (range === "all") return responses;
  const now = Date.now();
  const days = range === "7d" ? 7 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return responses.filter((r) => {
    try {
      return new Date(r.createdAt).getTime() >= cutoff;
    } catch {
      return true;
    }
  });
}

const GRADIENT_COLORS = [
  "from-cyan-500 to-blue-600",
  "from-purple-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-red-600",
];

export default function AdminQuestionnaire() {
  const [responses, setResponses] = useState<QuestionnaireResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/questionnaire", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load");
      setResponses(json.responses || []);
    } catch (e: any) {
      setError(String(e?.message || e || "Failed to load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dateFiltered = useMemo(() => filterByDateRange(responses, dateRange), [responses, dateRange]);

  const filtered = useMemo(() => {
    let result = dateFiltered.filter((r) =>
      r.email.toLowerCase().includes(search.toLowerCase())
    );
    if (questionFilter !== "all") {
      result = result.filter((r) => {
        const val = (r as any)[questionFilter];
        return val && String(val).trim().length > 0;
      });
    }
    return result;
  }, [dateFiltered, search, questionFilter]);

  const topAnswers = useMemo(() => computeTopAnswers(dateFiltered), [dateFiltered]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sportColors: Record<string, string> = {
    nfl: "bg-green-500/20 text-green-300",
    nba: "bg-orange-500/20 text-orange-300",
    mlb: "bg-red-500/20 text-red-300",
    nhl: "bg-blue-500/20 text-blue-300",
    soccer: "bg-purple-500/20 text-purple-300",
    golf: "bg-emerald-500/20 text-emerald-300",
    ncaaf: "bg-yellow-500/20 text-yellow-300",
  };

  const hasResponses = responses.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Questionnaire Responses
          </h1>
          <p className="mt-1 text-sm text-white/50">
            User preferences from early access signups
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCsv("questionnaire-responses.csv", filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
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

      {!loading && !hasResponses && !error && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 mb-5">
            <ClipboardList className="h-8 w-8 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white/80 mb-2">No questionnaire responses yet</h3>
          <p className="text-sm text-white/40 max-w-md mb-6">
            Once users submit questionnaire responses through early access signup, they&apos;ll appear here with analytics and insights.
          </p>
          <Link
            href="/admin?tab=tools"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/20"
          >
            Configure Questionnaire
          </Link>
        </div>
      )}

      {hasResponses && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="text-3xl font-bold">{dateFiltered.length}</div>
              <div className="text-sm text-white/60">Total Responses</div>
            </div>

            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
              <div className="text-3xl font-bold">
                {dateFiltered.filter((r) => r.favoriteSport.toLowerCase().includes("nfl")).length}
              </div>
              <div className="text-sm text-white/60">NFL Fans</div>
            </div>

            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
              <div className="text-3xl font-bold">
                {dateFiltered.filter((r) => r.favoriteLeagueType.toLowerCase().includes("dynasty")).length}
              </div>
              <div className="text-sm text-white/60">Dynasty Players</div>
            </div>

            <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
              <div className="text-3xl font-bold">
                {dateFiltered.filter((r) => r.freeText && r.freeText.trim().length > 0).length}
              </div>
              <div className="text-sm text-white/60">With Feedback</div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white/80">Top Answers by Question</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {QUESTION_KEYS.map((key, idx) => {
                const items = topAnswers[key] || [];
                const maxCount = items[0]?.count || 1;
                return (
                  <div
                    key={key}
                    className="rounded-xl bg-white/[0.03] border border-white/5 p-4"
                  >
                    <h3 className="text-sm font-medium text-white/60 mb-3">{QUESTION_LABELS[key]}</h3>
                    {items.length === 0 ? (
                      <p className="text-xs text-white/30">No data</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map((item, rank) => (
                          <div key={item.answer}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-white/70 truncate max-w-[70%]">
                                <span className="text-white/30 mr-1.5">#{rank + 1}</span>
                                {item.answer}
                              </span>
                              <span className="text-xs font-mono text-white/40">{item.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${GRADIENT_COLORS[idx % GRADIENT_COLORS.length]}`}
                                style={{ width: `${(item.count / maxCount) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/40 focus:border-cyan-500/50"
              />
            </div>

            <div className="flex gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 pointer-events-none" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="appearance-none rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-8 text-sm text-white/80 outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="7d" className="bg-gray-900">Last 7 days</option>
                  <option value="30d" className="bg-gray-900">Last 30 days</option>
                  <option value="all" className="bg-gray-900">All time</option>
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 pointer-events-none" />
                <select
                  value={questionFilter}
                  onChange={(e) => setQuestionFilter(e.target.value as QuestionFilter)}
                  className="appearance-none rounded-xl border border-white/10 bg-white/5 py-3 pl-9 pr-8 text-sm text-white/80 outline-none focus:border-cyan-500/50 cursor-pointer"
                >
                  <option value="all" className="bg-gray-900">All questions</option>
                  {QUESTION_KEYS.map((key) => (
                    <option key={key} value={key} className="bg-gray-900">{QUESTION_LABELS[key]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {loading && responses.length === 0 && (
              <div className="text-center py-12 text-white/50">Loading responses...</div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
                <Search className="h-8 w-8 text-white/20 mx-auto mb-3" />
                <div className="text-white/50">
                  {search ? "No responses match your search" : "No responses match the current filters"}
                </div>
                <button
                  onClick={() => { setSearch(""); setDateRange("all"); setQuestionFilter("all"); }}
                  className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition"
                >
                  Clear filters
                </button>
              </div>
            )}

            {filtered.map((r) => {
              const isExpanded = expandedIds.has(r.id);
              const sportKey = r.favoriteSport.toLowerCase().split(" ")[0];
              const sportClass = sportColors[sportKey] || "bg-gray-500/20 text-gray-300";

              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
                >
                  <button
                    onClick={() => toggleExpand(r.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-white font-medium">{r.email}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sportClass}`}>
                        {r.favoriteSport}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                        {r.favoriteLeagueType}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/40">{fmtDate(r.createdAt)}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5 p-4 space-y-3 bg-white/[0.01]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-white/40 mb-1">Competitiveness</div>
                          <div className="text-sm text-white/80">{r.competitiveness}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1">Draft Preference</div>
                          <div className="text-sm text-white/80">{r.draftPreference}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1">Pain Point</div>
                          <div className="text-sm text-white/80">{r.painPoint}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1">Interested In</div>
                          <div className="flex flex-wrap gap-1">
                            {r.experimentalInterest.map((interest, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-300"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {r.freeText && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                          <div className="text-xs text-white/40 mb-1">Additional Feedback</div>
                          <div className="text-sm text-white/80 italic">&ldquo;{r.freeText}&rdquo;</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
