"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useAnalytics } from "@/app/hooks/useAnalytics";
import {
  BarChart3,
  Users,
  Lightbulb,
  Mail,
  FileText,
  Wrench,
  Shield,
  Menu,
  Search,
  ChevronLeft,
  Command,
  X,
  Activity,
  LogOut,
  Home,
  Sparkles,
  Brain,
  Gift,
  Target,
} from "lucide-react";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { AdminTabsBar } from "./AdminTabsBar";

export type AdminTab = "overview" | "signups" | "questionnaire" | "ideas" | "feedback" | "email" | "blog" | "tools" | "analytics" | "ai_issues" | "share_rewards" | "calibration" | "model_drift";

const NAV: Array<{
  tab: AdminTab;
  label: string;
  icon: any;
  desc: string;
  color: string;
  glow: string;
}> = [
  { tab: "overview", label: "Overview", icon: BarChart3, desc: "KPIs & analytics", color: "from-violet-500 to-purple-600", glow: "violet" },
  { tab: "signups", label: "Signups", icon: Users, desc: "Early access funnel", color: "from-cyan-500 to-blue-600", glow: "cyan" },
  { tab: "questionnaire", label: "Questionnaire", icon: Sparkles, desc: "User preferences", color: "from-teal-500 to-emerald-600", glow: "teal" },
  { tab: "ideas", label: "Ideas", icon: Lightbulb, desc: "League suggestions", color: "from-amber-400 to-orange-500", glow: "amber" },
  { tab: "feedback", label: "Feedback", icon: Command, desc: "User feedback", color: "from-rose-500 to-pink-600", glow: "rose" },
  { tab: "email", label: "Email", icon: Mail, desc: "Broadcasts & replies", color: "from-pink-500 to-rose-600", glow: "pink" },
  { tab: "blog", label: "Blog", icon: FileText, desc: "Posts & publishing", color: "from-emerald-500 to-teal-600", glow: "emerald" },
  { tab: "analytics", label: "Analytics", icon: Activity, desc: "Events & telemetry", color: "from-indigo-500 to-blue-600", glow: "indigo" },
  { tab: "ai_issues", label: "AI Learning", icon: Brain, desc: "Issue backlog", color: "from-amber-500 to-orange-600", glow: "amber" },
  { tab: "share_rewards", label: "Share Rewards", icon: Gift, desc: "Token tracking", color: "from-purple-500 to-pink-600", glow: "purple" },
  { tab: "calibration", label: "Calibration", icon: Target, desc: "Trade engine health", color: "from-sky-500 to-blue-600", glow: "sky" },
  { tab: "model_drift", label: "Model Drift", icon: Shield, desc: "Drift & monitoring", color: "from-red-500 to-orange-600", glow: "red" },
  { tab: "tools", label: "Tools", icon: Wrench, desc: "Usage & AI activity", color: "from-fuchsia-500 to-purple-600", glow: "fuchsia" },
];

const LS_COLLAPSED_KEY = "af_admin_sidebar_collapsed";

export default function AdminLayout({
  user,
  activeTab,
  children,
}: {
  user: { email: string; name: string };
  activeTab: AdminTab;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [q, setQ] = useState("");
  const paletteInputRef = useRef<HTMLInputElement | null>(null);

  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [activeTab, trackPageView]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return NAV;
    return NAV.filter((n) => {
      const hay = `${n.label} ${n.desc}`.toLowerCase();
      return hay.includes(s);
    });
  }, [q]);

  const baseHref = (tab: AdminTab) => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set("tab", tab);
    return `${pathname}?${params.toString()}`;
  };

  const activeMeta = useMemo(() => NAV.find((n) => n.tab === activeTab), [activeTab]);

  const tabBarItems = useMemo(() => NAV.map((n) => ({ key: n.tab, label: n.label })), []);
  const handleMobileTabChange = (t: AdminTab) => {
    router.replace(baseHref(t));
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      const isCmdK = (e.metaKey || e.ctrlKey) && isK;

      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen(true);
        setDrawerOpen(false);
        setTimeout(() => paletteInputRef.current?.focus(), 0);
      }

      if (e.key === "Escape") {
        setDrawerOpen(false);
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const glowStyles: Record<string, string> = {
    violet: "shadow-violet-500/40",
    cyan: "shadow-cyan-500/40",
    amber: "shadow-amber-500/40",
    pink: "shadow-pink-500/40",
    emerald: "shadow-emerald-500/40",
    indigo: "shadow-indigo-500/40",
    fuchsia: "shadow-fuchsia-500/40",
  };

  const TabLink = ({
    item,
    onClick,
    compact,
  }: {
    item: (typeof NAV)[number];
    onClick?: () => void;
    compact?: boolean;
  }) => {
    const Icon = item.icon;
    const isActive = item.tab === activeTab;

    return (
      <Link
        href={baseHref(item.tab)}
        onClick={onClick}
        className={[
          "group relative flex items-center gap-3.5 rounded-xl px-3 py-3 transition-all duration-300",
          isActive
            ? "bg-gradient-to-r from-white/[0.08] to-white/[0.04] shadow-lg border border-white/10"
            : "hover:bg-white/[0.04] border border-transparent hover:border-white/5",
        ].join(" ")}
        aria-current={isActive ? "page" : undefined}
        title={item.label}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-white/80 to-white/40" />
        )}
        <div className={[
          "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300",
          isActive 
            ? `bg-gradient-to-br ${item.color} shadow-lg ${glowStyles[item.glow] || ""}` 
            : "bg-white/[0.06] group-hover:bg-white/10 group-hover:scale-105"
        ].join(" ")}>
          <Icon className={[
            "h-[18px] w-[18px] transition-all duration-300",
            isActive ? "text-white" : "text-white/70 group-hover:text-white"
          ].join(" ")} />
        </div>
        {!compact && (
          <div className="relative min-w-0 flex-1">
            <div className={[
              "text-[13px] font-semibold tracking-wide transition-colors",
              isActive ? "text-white" : "text-white/75 group-hover:text-white"
            ].join(" ")}>
              {item.label}
            </div>
            <div className={[
              "text-[11px] mt-0.5 transition-colors",
              isActive ? "text-white/60" : "text-white/40 group-hover:text-white/50"
            ].join(" ")}>
              {item.desc}
            </div>
          </div>
        )}
        {compact && <span className="sr-only">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="fixed inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-cyan-950/20 pointer-events-none" />
      
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold tracking-tight">AllFantasy Admin</div>
                <div className="text-xs text-white/50">{activeMeta?.label}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPaletteOpen(true);
              setTimeout(() => paletteInputRef.current?.focus(), 0);
            }}
            className="hidden md:flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-all group"
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="hidden lg:inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium">
              <Command className="h-3 w-3" /> K
            </kbd>
          </button>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-bold shadow-lg shadow-cyan-500/25">
                {(user.name || "A").slice(0, 1).toUpperCase()}
              </div>
              <div className="hidden lg:block">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-white/50">{user.email}</div>
              </div>
            </div>

            <ModeToggle className="hidden sm:inline-flex h-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 px-3 text-xs font-semibold" />

            <Link
              href="/"
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              title="Back to site"
            >
              <Home className="h-4 w-4" />
            </Link>

            <button
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } finally {
                  window.location.href = "/login";
                }
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              type="button"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className={[
        "mx-auto grid max-w-[1600px] gap-6 px-4 lg:px-6 py-6",
        collapsed ? "lg:grid-cols-[80px_1fr]" : "lg:grid-cols-[280px_1fr]",
      ].join(" ")}>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] p-3 backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between px-2">
                <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.2em]">
                  {collapsed ? "" : "Navigation"}
                </span>
                <button
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/10 transition-all duration-200 hover:scale-105"
                  onClick={() => setCollapsed((v) => !v)}
                  title={collapsed ? "Expand" : "Collapse"}
                >
                  <ChevronLeft className={["h-3.5 w-3.5 text-white/60 transition-transform duration-200", collapsed ? "rotate-180" : ""].join(" ")} />
                </button>
              </div>

              <nav className="space-y-1.5">
                {NAV.map((item) => (
                  <TabLink key={item.tab} item={item} compact={collapsed} />
                ))}
              </nav>
            </div>

            {!collapsed && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/[0.15] via-purple-600/[0.1] to-fuchsia-600/[0.08] border border-violet-500/20 p-4">
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 border border-violet-500/30">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                  </div>
                  <span className="text-[13px] font-semibold text-violet-200">Quick tip</span>
                </div>
                <p className="relative mt-3 text-[12px] text-white/50 leading-relaxed">
                  Press <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/70 font-medium text-[11px]"><Command className="h-3 w-3" />K</kbd> to quickly jump between tabs.
                </p>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 relative">
          <div className="block lg:hidden">
            <AdminTabsBar tab={activeTab} setTab={handleMobileTabChange} items={tabBarItems} />
          </div>
          {children}
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-[#0a0a0f] border-r border-white/5 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="font-bold">Admin</span>
              </div>
              <button
                className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-violet-500/50 transition-colors"
                autoFocus
              />
            </div>

            <nav className="space-y-1">
              {filtered.map((item) => (
                <TabLink key={item.tab} item={item} onClick={() => setDrawerOpen(false)} />
              ))}
            </nav>

            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold">
                  {(user.name || "A").slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-white/50">{user.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10"
                  onClick={() => setDrawerOpen(false)}
                >
                  <Home className="h-4 w-4" /> Home
                </Link>
                <button
                  onClick={async () => {
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                    } finally {
                      window.location.href = "/login";
                    }
                  }}
                  className="flex items-center justify-center gap-2 h-11 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paletteOpen && (
        <div className="fixed inset-0 z-[60] hidden md:flex items-start justify-center pt-24">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPaletteOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
              <Search className="h-5 w-5 text-white/40" />
              <input
                ref={paletteInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tabs..."
                className="flex-1 bg-transparent text-base outline-none placeholder:text-white/40"
              />
              <kbd className="px-2 py-1 rounded-lg bg-white/5 text-xs text-white/50 font-medium">ESC</kbd>
            </div>

            <div className="max-h-[400px] overflow-auto p-2">
              {filtered.map((item) => {
                const Icon = item.icon;
                const isActive = item.tab === activeTab;

                return (
                  <Link
                    key={item.tab}
                    href={baseHref(item.tab)}
                    onClick={() => setPaletteOpen(false)}
                    className={[
                      "flex items-center gap-4 rounded-xl px-4 py-3 transition-all",
                      isActive ? "bg-white/10" : "hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} shadow-lg`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-white/50">{item.desc}</div>
                    </div>
                    {isActive && (
                      <span className="text-xs text-violet-400 font-medium">Active</span>
                    )}
                  </Link>
                );
              })}

              {!filtered.length && (
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                  <Search className="h-8 w-8 mb-3" />
                  <p className="text-sm">No results for "{q}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
