import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import StartupDynastyForm from '@/components/StartupDynastyForm';

export const metadata: Metadata = {
  title: 'Start a New Dynasty League – AllFantasy',
  description: 'Set up your keeper or dynasty league in seconds',
};

export default async function StartupDynastyPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] py-16">
      <div className="container mx-auto px-4 max-w-xl">
        <h1 className="text-5xl font-bold text-center bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
          Start a New Dynasty League
        </h1>
        <p className="text-center text-gray-400 mb-12">Set up your keeper or dynasty league in seconds</p>
        <StartupDynastyForm userId={session.user.id} />
      </div>
    </div>
  );
}
