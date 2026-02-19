import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import PulseDashboardClient from './PulseDashboardClient'

export default async function PulsePage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent('/af-legacy/pulse')}`)
  }

  return <PulseDashboardClient userId={(session.user as any).id} />
}
