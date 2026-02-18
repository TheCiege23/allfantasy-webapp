import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import OnboardingForm from "./OnboardingForm"
import { isUserVerified } from "@/lib/auth-guard"

type SessionUser = { id?: string; email?: string | null }

export default async function OnboardingPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: SessionUser
  } | null
  const userId = session?.user?.id
  const email = session?.user?.email

  if (!userId || !email) {
    redirect("/login?callbackUrl=/onboarding")
  }

  const existing = await (prisma as any).userProfile.findUnique({
    where: { userId },
  })

  if (isUserVerified(existing) && existing?.profileComplete) {
    redirect("/brackets")
  }

  const pending = await (prisma as any).pendingSignup.findUnique({
    where: { email },
  })

  const appUser = await (prisma as any).appUser.findUnique({
    where: { id: userId },
    select: { displayName: true },
  })

  const defaultName = pending?.displayName || existing?.displayName || appUser?.displayName || ""
  const defaultPhone = pending?.phone || existing?.phone || ""
  const emailVerified = !!existing?.emailVerifiedAt
  const phoneVerified = !!existing?.phoneVerifiedAt

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Complete your profile</h1>

        {emailVerified && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            <span>&#x2705;</span> Email verified ({email})
          </div>
        )}

        {!emailVerified && (
          <p className="text-sm text-amber-300/80">
            Your email has not been verified yet. Sign in via the magic link sent to your email to verify.
          </p>
        )}

        {phoneVerified && (
          <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            <span>&#x2705;</span> Phone verified
          </div>
        )}

        <OnboardingForm
          defaultName={defaultName}
          defaultPhone={defaultPhone}
          isVerified={emailVerified || phoneVerified}
        />
      </div>
    </div>
  )
}
