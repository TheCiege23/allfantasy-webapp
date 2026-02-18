"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense, useState } from "react"
import { CheckCircle2, XCircle, Clock, AlertTriangle, Mail, Loader2 } from "lucide-react"

function VerifyContent() {
  const searchParams = useSearchParams()
  const status = searchParams?.get("status")
  const error = searchParams?.get("error")
  const verified = searchParams?.get("verified")
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<"sent" | "error" | "already" | "login_required" | null>(null)

  async function handleSendVerification() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch("/api/auth/verify-email/send", { method: "POST" })
      const data = await res.json()
      if (res.status === 401) {
        setSendResult("login_required")
      } else if (res.ok && data.alreadyVerified) {
        setSendResult("already")
      } else if (res.ok) {
        setSendResult("sent")
      } else {
        setSendResult("error")
      }
    } catch {
      setSendResult("error")
    } finally {
      setSending(false)
    }
  }

  function resolveState(): string {
    if (verified === "email" || status === "success") return "success"
    if (error === "EXPIRED_TOKEN" || status === "expired") return "expired"
    if (error === "INVALID_OR_USED_TOKEN" || error === "MISSING_TOKEN" || status === "invalid") return "invalid"
    if (error || status === "error") return "error"
    return "pending"
  }

  const state = resolveState()

  const configs: Record<string, { icon: React.ReactNode; title: string; message: string; color: string }> = {
    success: {
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-400" />,
      title: "Email verified!",
      message: "Your email has been verified successfully. You can now access all features.",
      color: "border-emerald-500/20 bg-emerald-500/10",
    },
    expired: {
      icon: <Clock className="h-8 w-8 text-amber-400" />,
      title: "Link expired",
      message: "This verification link has expired. Request a new one below.",
      color: "border-amber-500/20 bg-amber-500/10",
    },
    invalid: {
      icon: <XCircle className="h-8 w-8 text-red-400" />,
      title: "Invalid link",
      message: "This verification link is invalid or has already been used.",
      color: "border-red-500/20 bg-red-500/10",
    },
    error: {
      icon: <AlertTriangle className="h-8 w-8 text-red-400" />,
      title: "Something went wrong",
      message: "There was an error verifying your email. Please try again.",
      color: "border-red-500/20 bg-red-500/10",
    },
    pending: {
      icon: <Mail className="h-8 w-8 text-cyan-400" />,
      title: "Verify your email",
      message: "You need to verify your email or phone to create and join leagues. Check your inbox for a verification link, or request a new one below.",
      color: "border-cyan-500/20 bg-cyan-500/10",
    },
  }

  const config = configs[state] || configs.pending

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto w-fit">{config.icon}</div>
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <p className="text-sm text-white/60">{config.message}</p>

        {sendResult === "sent" && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            Verification email sent! Check your inbox.
          </div>
        )}
        {sendResult === "already" && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-300">
            Your email is already verified.
          </div>
        )}
        {sendResult === "login_required" && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">
            Please <a href="/login" className="underline font-medium">sign in</a> first, then request a new verification email.
          </div>
        )}
        {sendResult === "error" && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            Failed to send email. Please try again.
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2">
          {state === "success" ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 transition"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <button
                onClick={handleSendVerification}
                disabled={sending || sendResult === "sent"}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition"
              >
                {sending ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </span>
                ) : sendResult === "sent" ? (
                  "Email sent!"
                ) : (
                  "Send verification email"
                )}
              </button>
              <Link
                href="/dashboard"
                className="rounded-xl bg-white/10 border border-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/15 transition"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/10 px-6 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
