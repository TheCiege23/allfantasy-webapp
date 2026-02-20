import { redirect } from "next/navigation"
import { getSessionAndProfile, isUserVerified, isAgeConfirmed, VerifiedUserProfile } from "@/lib/auth-guard"

export async function requireVerifiedSession(): Promise<{
  userId: string
  email: string | null
  emailVerified: Date | null
  profile: VerifiedUserProfile | null
}> {
  const { userId, email, emailVerified, profile } = await getSessionAndProfile()

  if (!userId) redirect("/login")

  if (!isAgeConfirmed(profile)) {
    redirect("/verify?error=AGE_REQUIRED")
  }

  if (!isUserVerified(emailVerified, profile?.phoneVerifiedAt)) {
    redirect("/verify?error=VERIFICATION_REQUIRED")
  }

  return { userId, email, emailVerified, profile }
}
