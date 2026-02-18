"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  ArrowLeft,
  Shield,
  Mail,
  Loader2,
  TriangleAlert,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get("callbackUrl") || searchParams?.get("next") || "/brackets";
  const isAdminLogin = callbackUrl.startsWith("/admin");

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAdmin, setShowAdmin] = useState(isAdminLogin);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminRemaining, setAdminRemaining] = useState<number | null>(null);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setSending(true);
    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(null);

    if (!adminPassword.trim()) {
      setAdminError("Please enter the admin password.");
      return;
    }

    setAdminLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, next: "/admin" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setAdminError(data?.error || "Login failed.");
        setAdminRemaining(typeof data?.remaining === "number" ? data.remaining : null);
        return;
      }

      window.location.href = data.next || "/admin";
    } catch (err: any) {
      setAdminError(err?.message || "Login failed.");
    } finally {
      setAdminLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl text-center">
          <div className="mx-auto w-fit rounded-xl border border-white/10 bg-black/20 p-3">
            <Mail className="h-6 w-6 text-cyan-400" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
          <p className="mt-2 text-sm text-white/60">
            We sent a sign-in link to <span className="text-white/90 font-medium">{email}</span>.
            Click the link in the email to sign in.
          </p>
          <p className="mt-4 text-xs text-white/40">
            The link expires in 24 hours. If you don&apos;t see it, check your spam folder.
          </p>
          <Link
            href="/brackets"
            className="mt-6 inline-block rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition"
          >
            Continue to Brackets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <Link
        href="/brackets"
        className="absolute left-4 top-4 md:left-6 md:top-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Brackets
      </Link>

      <div className="w-full max-w-md space-y-4">
        {isAdminLogin ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-xl font-semibold">Admin Sign In</div>
                <div className="text-sm text-white/60">
                  Enter the admin password to continue.
                </div>
              </div>
            </div>

            {adminError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    {adminError}
                    {typeof adminRemaining === "number" && (
                      <span className="ml-1 text-xs text-red-200/70">
                        ({adminRemaining} attempts remaining)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="mt-5 space-y-3">
              <div>
                <label className="text-sm text-white/70">Password</label>
                <input
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                  placeholder="••••••••"
                  disabled={adminLoading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={adminLoading || !adminPassword.trim()}
                className="w-full rounded-xl bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
              >
                {adminLoading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-2">
                  <Mail className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-xl font-semibold">Sign in</div>
                  <div className="text-sm text-white/60">
                    Enter your email to get a magic sign-in link.
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                    <div>{error}</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleEmailSignIn} className="mt-5 space-y-3">
                <div>
                  <label className="text-sm text-white/70">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                    placeholder="you@example.com"
                    disabled={sending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || !email.trim()}
                  className="w-full rounded-xl bg-white text-black px-4 py-2.5 text-sm font-medium hover:bg-gray-200 disabled:opacity-60 transition-colors"
                >
                  {sending ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending link...
                    </span>
                  ) : (
                    "Send sign-in link"
                  )}
                </button>
              </form>

              <p className="mt-4 text-xs text-white/40 text-center">
                No password needed. We&apos;ll email you a one-time link to sign in.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 shadow-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdmin((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm text-white/50 hover:text-white/70 transition"
              >
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Admin login
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdmin ? "rotate-180" : ""}`}
                />
              </button>

              {showAdmin && (
                <div className="px-5 pb-5 pt-1 border-t border-white/5">
                  {adminError && (
                    <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                      <div className="flex items-start gap-2">
                        <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          {adminError}
                          {typeof adminRemaining === "number" && (
                            <span className="ml-1 text-xs text-red-200/70">
                              ({adminRemaining} attempts remaining)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div>
                      <label className="text-xs text-white/60">Admin password</label>
                      <input
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        type="password"
                        autoComplete="current-password"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/20"
                        placeholder="••••••••"
                        disabled={adminLoading}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={adminLoading || !adminPassword.trim()}
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-60 transition"
                    >
                      {adminLoading ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in...
                        </span>
                      ) : (
                        "Admin sign in"
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
