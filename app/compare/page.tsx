import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import CompareClient from './CompareClient'

export default async function ComparePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login?next=/compare')
  }

  const appUser = await prisma.appUser.findUnique({
    where: { id: session.user.id },
    include: { legacyUser: true },
  })

  return <CompareClient defaultUsername={appUser?.legacyUser?.sleeperUsername || ''} />
}
