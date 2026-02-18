import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export interface VerifiedUserProfile {
  userId: string
  displayName: string | null
  phone: string | null
  phoneVerifiedAt: Date | null
  emailVerifiedAt: Date | null
  ageConfirmedAt: Date | null
  profileComplete: boolean
}

export function isUserVerified(
  emailVerified: Date | null | undefined,
  phoneVerifiedAt: Date | null | undefined
): boolean {
  return !!emailVerified || !!phoneVerifiedAt
}

export function isAgeConfirmed(profile: VerifiedUserProfile | null): boolean {
  if (!profile) return false
  return !!profile.ageConfirmedAt
}

export function isFullyOnboarded(
  emailVerified: Date | null | undefined,
  profile: VerifiedUserProfile | null
): boolean {
  if (!profile) return false
  return isUserVerified(emailVerified, profile.phoneVerifiedAt) && isAgeConfirmed(profile) && profile.profileComplete
}

export async function getSessionAndProfile(): Promise<{
  userId: string | null
  email: string | null
  emailVerified: Date | null
  profile: VerifiedUserProfile | null
}> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  const userId = session?.user?.id ?? null
  const email = session?.user?.email ?? null

  if (!userId) return { userId: null, email: null, emailVerified: null, profile: null }

  const appUser = await (prisma as any).appUser.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  }).catch(() => null)

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId },
  }).catch(() => null)

  return { userId, email, emailVerified: appUser?.emailVerified ?? null, profile }
}

export async function requireVerifiedUser(): Promise<
  | { ok: true; userId: string; profile: VerifiedUserProfile }
  | { ok: false; response: NextResponse }
> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }),
    }
  }

  const appUser = await (prisma as any).appUser.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  }).catch(() => null)

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId: session.user.id },
  }).catch(() => null)

  if (!isAgeConfirmed(profile)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "AGE_REQUIRED" },
        { status: 403 }
      ),
    }
  }

  if (!isUserVerified(appUser?.emailVerified, profile?.phoneVerifiedAt)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "VERIFICATION_REQUIRED" },
        { status: 403 }
      ),
    }
  }

  return { ok: true, userId: session.user.id, profile }
}
