"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Shield, Mail, Loader2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

type LoginFail = {
  error?: string;
  remaining?: number;
  lockedUntil?: number;
};

type LoginOk = {
  ok: true;
  next: string;
};

function fmtTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${r}s`;
}

export default function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next") || "/admin";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [forgotStatus, setForgotStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  const now = Date.now();
  const isLocked = useMemo(() => (lockedUntil ? lockedUntil > now : false), [lockedUntil, now]);
  const lockRemainingMs = useMemo(() => (lockedUntil ? lockedUntil - now : 0), [lockedUntil, now]);

  useEffect(() => {
    if (!isLocked) return;
    const t = setInterval(() => {
      setLockedUntil((x) => (x ? x : null));
    }, 500);
    return () => clearInterval(t);
  }, [isLocked]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setForgotStatus(null);

    if (!password.trim()) {
      setError("Please enter the admin password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, next: nextParam }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginOk & LoginFail;

      if (!res.ok || !(data as any)?.ok) {
        setError(data?.error || "Login failed.");
        setRemaining(typeof data?.remaining === "number" ? data.remaining : null);
        setLockedUntil(typeof data?.lockedUntil === "number" ? data.lockedUntil : null);
        return;
      }

      setRemaining(null);
      setLockedUntil(null);
      setPassword("");
      router.push((data as any).next || "/admin");
    } catch (err: any) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function requestMagicLink() {
    setForgotStatus(null);
    setSendingLink(true);

    try {
      const res = await fetch("/api/auth/admin-magic/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextParam }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setForgotStatus({ type: "error", msg: data?.error || "Failed to send link." });
        return;
      }

      setForgotStatus({
        type: "success",
        msg: "If that email is allowed, a magic link has been sent. Check your inbox.",
      });
    } catch (e: any) {
      setForgotStatus({ type: "error", msg: e?.message || "Failed to send link." });
    } finally {
      setSendingLink(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <Link
        href="/"
        className="absolute left-4 top-4 md:left-6 md:top-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            <Shield className="h-5 w-5 text-white/80" />
          </div>
          <div>
            <div className="text-xl font-semibold">Admin Login</div>
            <div className="text-sm text-white/60">Enter your admin password to continue.</div>
          </div>
        </div>

        {isLocked && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <TriangleAlert className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-medium">Temporarily locked</div>
                <div className="text-red-200/80">
                  Too many attempts. Try again in{" "}
                  <span className="font-semibold">{fmtTime(lockRemainingMs)}</span>.
                </div>
              </div>
            </div>
          </div>
        )}

        {error && !isLocked && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <TriangleAlert className="h-5 w-5 mt-0.5" />
              <div className="min-w-0">
                <div className="font-medium">{error}</div>
                {typeof remaining === "number" && (
                  <div className="mt-1 text-xs text-red-200/80">
                    Attempts remaining before lockout:{" "}
                    <span className="font-semibold">{remaining}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <label className="text-sm text-white/70">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
              placeholder="••••••••"
              disabled={loading || isLocked}
            />
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setShowForgot((v) => !v);
              setForgotStatus(null);
            }}
            className="text-white/70 hover:text-white underline-offset-4 hover:underline"
          >
            Forgot admin password?
          </button>

          <div className="text-white/50">
            Tip: You can deep-link to a tab with <span className="text-white/80">/admin?tab=tools</span>
          </div>
        </div>

        {showForgot && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start gap-2">
              <Mail className="h-5 w-5 text-white/70 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Email magic link</div>
                <div className="text-xs text-white/60">
                  We'll send a one-time admin login link to an allowed admin email.
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs text-white/60">Admin email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                placeholder="you@allfantasy.ai"
                disabled={sendingLink}
              />
            </div>

            {forgotStatus && (
              <div
                className={[
                  "mt-3 rounded-xl border p-3 text-sm",
                  forgotStatus.type === "success"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                    : forgotStatus.type === "info"
                    ? "border-white/10 bg-white/5 text-white/80"
                    : "border-red-500/20 bg-red-500/10 text-red-200",
                ].join(" ")}
              >
                <div className="flex items-start gap-2">
                  {forgotStatus.type === "success" ? (
                    <CheckCircle2 className="h-5 w-5 mt-0.5" />
                  ) : (
                    <TriangleAlert className="h-5 w-5 mt-0.5" />
                  )}
                  <div className="min-w-0">{forgotStatus.msg}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={requestMagicLink}
              disabled={sendingLink || !email.trim()}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
            >
              {sendingLink ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending link…
                </span>
              ) : (
                "Send magic link"
              )}
            </button>

            <div className="mt-2 text-[11px] text-white/40">
              Security note: link expires quickly and only works for allowlisted admin emails.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
