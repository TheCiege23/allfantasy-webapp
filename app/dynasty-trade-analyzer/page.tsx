import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import DynastyTradeForm from '@/components/DynastyTradeForm';

export const metadata: Metadata = {
  title: 'Dynasty Trade Analyzer – AllFantasy',
  description: 'AI evaluates long-term dynasty value, aging, future draft capital, and league context',
};

export default async function DynastyTradeAnalyzerPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-16">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Dynasty Trade Analyzer
          </h1>
          <p className="text-xl text-gray-300 mt-4">
            AI evaluates long-term dynasty value, aging, future draft capital, and league context
          </p>
        </div>

        <DynastyTradeForm />
      </div>
    </div>
  );
}
