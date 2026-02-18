"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { TriangleAlert } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The sign-in link has expired or has already been used.",
  Default: "An error occurred during sign in.",
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorType = searchParams?.get("error") || "Default"
  const message = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.Default

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl text-center">
        <div className="mx-auto w-fit rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <TriangleAlert className="h-6 w-6 text-red-400" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Sign-in Error</h1>
        <p className="mt-2 text-sm text-white/60">{message}</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  )
}
