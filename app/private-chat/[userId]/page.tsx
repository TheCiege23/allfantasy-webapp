import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import PrivateChatClient from './PrivateChatClient'

export const dynamic = 'force-dynamic'

export default async function PrivateChatPage({ params }: { params: { userId: string } }) {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string }
  } | null

  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/private-chat/' + params.userId)
  }

  if (session.user.id === params.userId) {
    redirect('/dashboard')
  }

  const [partner, currentUser] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: params.userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    }),
    prisma.appUser.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    }),
  ])

  if (!partner) {
    redirect('/dashboard')
  }

  const sharedLeague = await prisma.bracketLeagueMember.findFirst({
    where: {
      userId: session.user.id,
      league: {
        members: {
          some: { userId: params.userId },
        },
      },
    },
  })

  if (!sharedLeague) {
    redirect('/dashboard')
  }

  return (
    <PrivateChatClient
      currentUser={currentUser!}
      partner={partner}
    />
  )
}
