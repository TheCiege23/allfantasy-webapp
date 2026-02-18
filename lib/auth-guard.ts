import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export interface UserProfile {
  userId: string
  displayName: string | null
  phone: string | null
  phoneVerifiedAt: Date | null
  emailVerifiedAt: Date | null
  profileComplete: boolean
}

export function isUserVerified(profile: UserProfile | null): boolean {
  if (!profile) return false
  return !!profile.emailVerifiedAt || !!profile.phoneVerifiedAt
}

export function isFullyOnboarded(profile: UserProfile | null): boolean {
  if (!profile) return false
  return isUserVerified(profile) && profile.profileComplete
}

export async function getSessionAndProfile(): Promise<{
  userId: string | null
  email: string | null
  profile: UserProfile | null
}> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  const userId = session?.user?.id ?? null
  const email = session?.user?.email ?? null

  if (!userId) return { userId: null, email: null, profile: null }

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId },
  }).catch(() => null)

  return { userId, email, profile }
}

export async function requireVerifiedUser(): Promise<
  | { ok: true; userId: string; profile: UserProfile }
  | { ok: false; response: NextResponse }
> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId: session.user.id },
  }).catch(() => null)

  if (!isUserVerified(profile)) {
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
