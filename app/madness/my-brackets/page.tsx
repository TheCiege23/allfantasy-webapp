import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function MyBracketsPage() {
  const session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null
  if (!session?.user?.id) redirect("/login")

  const entries = await (prisma as any).bracketEntry.findMany({
    where: { userId: session.user.id },
    include: {
      league: { select: { id: true, name: true } },
      _count: { select: { picks: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          My Brackets
        </h1>

        {entries.length === 0 ? (
          <div className="text-center text-gray-500 py-16">
            <p className="text-lg">No brackets submitted yet</p>
            <p className="text-sm mt-2">Join a league and fill out your bracket to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry: any) => (
              <Link
                key={entry.id}
                href={`/madness/my-brackets/${entry.id}`}
                className="block bg-gray-950 border border-gray-800 rounded-xl p-5 hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-lg text-white">{entry.name}</div>
                    <div className="text-sm text-gray-400 mt-1">{entry.league?.name || "League"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-400 font-medium">{entry._count.picks} picks</div>
                    <div className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
