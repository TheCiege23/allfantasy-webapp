import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAdminSessionCookie } from '@/lib/adminSession'
import { prisma } from '@/lib/prisma'
import ModerationClient from './ModerationClient'

export default async function MadnessChatModeration() {
  const cookieStore = cookies()
  const adminSession = cookieStore.get('admin_session')

  if (!adminSession?.value) redirect('/admin/login')
  const payload = verifyAdminSessionCookie(adminSession.value)
  if (!payload?.authenticated) redirect('/admin/login')

  const flags = await prisma.chatMessageFlag.findMany({
    where: { status: 'pending' },
    include: {
      message: {
        include: {
          user: { select: { username: true, displayName: true } },
        },
      },
      reportedBy: { select: { username: true, displayName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const serialized = flags.map(f => ({
    ...f,
    createdAt: f.createdAt.toISOString(),
    reviewedAt: f.reviewedAt?.toISOString() || null,
    message: {
      ...f.message,
      createdAt: f.message.createdAt.toISOString(),
    },
  }))

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-red-400 to-purple-500 bg-clip-text text-transparent">
          Madness Chat Moderation
        </h1>
        <p className="text-center text-gray-400 mb-12">
          {serialized.length} pending flag{serialized.length !== 1 ? 's' : ''}
        </p>

        <ModerationClient initialFlags={serialized as any} />
      </div>
    </div>
  )
}
