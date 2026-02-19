import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ShareClient from './ShareClient'

export default async function SharePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login?next=/share')
  }

  const appUser = await prisma.appUser.findUnique({
    where: { id: session.user.id },
    include: { legacyUser: true },
  })

  return <ShareClient defaultUsername={appUser?.legacyUser?.sleeperUsername || ''} />
}
