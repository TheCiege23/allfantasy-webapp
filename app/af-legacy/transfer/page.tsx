import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LeagueTransferClient from "@/components/legacy/LeagueTransferClient";

export default async function LegacyTransferPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/af-legacy/transfer");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a051f] to-[#0f0a24] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
          <div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              League Transfer
            </h1>
            <p className="text-2xl text-cyan-300 mt-2">
              Bring your Sleeper dynasty to AllFantasy — history intact
            </p>
          </div>
          <div className="px-6 py-3 bg-yellow-500/20 text-yellow-300 rounded-full font-semibold flex items-center gap-2 border border-yellow-400/30">
            ✨ 30% OFF FIRST MIGRATION
          </div>
        </div>

        <LeagueTransferClient userId={session.user.id} />
      </div>
    </div>
  );
}
