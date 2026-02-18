import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { isUserVerified } from "@/lib/auth-guard"

export async function requireVerifiedSession(): Promise<{ userId: string; email: string }> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  if (!session?.user?.id || !session?.user?.email) {
    const headersList = headers()
    const pathname = headersList.get("x-invoke-path") || headersList.get("x-next-url") || "/brackets"
    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`)
  }

  const profile = await (prisma as any).userProfile.findUnique({
    where: { userId: session.user.id },
  }).catch(() => null)

  if (!isUserVerified(profile)) {
    redirect("/onboarding")
  }

  return { userId: session.user.id, email: session.user.email }
}
