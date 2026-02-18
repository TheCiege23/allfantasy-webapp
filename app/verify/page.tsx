"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react"

function VerifyContent() {
  const searchParams = useSearchParams()
  const status = searchParams?.get("status")

  const configs: Record<string, { icon: React.ReactNode; title: string; message: string; color: string }> = {
    success: {
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-400" />,
      title: "Email verified!",
      message: "Your email has been verified successfully. You can now sign in to your account.",
      color: "border-emerald-500/20 bg-emerald-500/10",
    },
    expired: {
      icon: <Clock className="h-8 w-8 text-amber-400" />,
      title: "Link expired",
      message: "This verification link has expired. Please sign in and request a new verification email.",
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
      icon: <Clock className="h-8 w-8 text-cyan-400" />,
      title: "Verify your email",
      message: "We sent a verification link to your email. Click the link to verify your account.",
      color: "border-cyan-500/20 bg-cyan-500/10",
    },
  }

  const config = configs[status || "pending"] || configs.pending

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl text-center space-y-4">
        <div className="mx-auto w-fit">{config.icon}</div>
        <h1 className="text-xl font-semibold">{config.title}</h1>
        <p className="text-sm text-white/60">{config.message}</p>

        <div className="flex flex-col gap-3 pt-2">
          {status === "success" ? (
            <Link
              href="/login"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:from-cyan-400 hover:to-purple-500 transition"
            >
              Sign In
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl bg-white/10 border border-white/10 px-6 py-2.5 text-sm font-medium hover:bg-white/15 transition"
              >
                Go to Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl border border-white/10 px-6 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                Create New Account
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
