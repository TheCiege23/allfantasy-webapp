import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getCurrentUser(): Promise<{ id: string; email: string | null } | null> {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string; email?: string | null }
  } | null

  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    email: session.user.email ?? null,
  }
}
