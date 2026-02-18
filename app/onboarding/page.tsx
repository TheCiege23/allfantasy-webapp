import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import OnboardingForm from "./OnboardingForm"

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

  if (existing?.profileComplete) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white">
      <div className="p-6 max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Complete your profile</h1>
        <p className="text-sm text-white/60">
          Confirm your info below. Your email ({email}) is verified.
        </p>

        <OnboardingForm
          defaultName={defaultName}
          defaultPhone={defaultPhone}
        />
      </div>
    </div>
  )
}
