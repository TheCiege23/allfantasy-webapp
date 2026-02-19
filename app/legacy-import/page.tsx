import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import LegacyImportForm from '@/components/LegacyImportForm';

export const metadata: Metadata = {
  title: 'Import Legacy League – AllFantasy',
  description: 'Bring in your historical Sleeper or ESPN leagues for dynasty analysis',
};

export default async function LegacyImportPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] py-16 md:py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-4">
            Import Legacy / Dynasty League
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Bring in your historical Sleeper or ESPN leagues to unlock dynasty rankings, aging curves, long-term value projections, and AI trade analysis.
          </p>
        </div>

        <LegacyImportForm userId={session.user.id} />
      </div>
    </div>
  );
}
