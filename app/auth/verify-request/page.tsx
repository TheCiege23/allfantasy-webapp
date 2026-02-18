import Link from "next/link"
import { Mail } from "lucide-react"

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl text-center">
        <div className="mx-auto w-fit rounded-xl border border-white/10 bg-black/20 p-3">
          <Mail className="h-6 w-6 text-cyan-400" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-white/60">
          A sign-in link has been sent to your email address. Open it to confirm your login.
        </p>
        <p className="mt-4 text-xs text-white/40">
          The link expires in 24 hours. If you don't see it, check your spam folder.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}
