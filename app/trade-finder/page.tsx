import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import TradeFinderClient from '@/components/TradeFinderClient';

export default async function TradeFinderPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) redirect('/login');

  const [leagues, userProfile] = await Promise.all([
    (prisma as any).league.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, sport: true, season: true, platformLeagueId: true, platform: true, isDynasty: true },
    }),
    (prisma as any).userProfile.findUnique({
      where: { userId: session.user.id },
      select: { sleeperUserId: true },
    }),
  ]);

  const sleeperUserId = userProfile?.sleeperUserId || null;

  if (leagues.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No leagues synced yet.</p>
          <a href="/dashboard" className="text-cyan-400 hover:text-cyan-300 text-sm mt-2 inline-block">
            Import a league first &rarr;
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-bold text-center bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
          Find Trades
        </h1>
        <p className="text-center text-gray-300 mb-12">AI-powered trade suggestions tailored to your strategy</p>

        <TradeFinderClient initialLeagues={leagues} sleeperUserId={sleeperUserId} />
      </div>
    </div>
  );
}
