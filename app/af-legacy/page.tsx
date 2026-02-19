import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import LegacyHubClient from '@/components/legacy/LegacyHubClient'

export default async function LegacyHubPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/af-legacy')}`)
  }

  return <LegacyHubClient userId={session.user.id} />
}
