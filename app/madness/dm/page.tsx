import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DMInboxClient from './DMInboxClient'

export const dynamic = 'force-dynamic'

export default async function DMInboxPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/madness/dm')
  }

  return <DMInboxClient userId={session.user.id} />
}
