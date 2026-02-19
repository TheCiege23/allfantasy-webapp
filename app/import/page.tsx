import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SleeperImportForm from "@/components/SleeperImportForm";
import EspnImportForm from "@/components/EspnImportForm";

export const metadata: Metadata = {
  title: "Import Your League \u2013 AllFantasy",
  description: "Import your fantasy league from Sleeper or ESPN to get AI-powered rankings and insights.",
};

export default async function ImportPage() {
  const session = (await getServerSession(authOptions as any)) as {
    user?: { id?: string };
  } | null;

  if (!session?.user?.id) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] to-[#0f0f1a] py-20">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-5xl font-bold mb-4 text-center text-transparent">
          Import Your League
        </h1>
        <p className="text-center text-gray-400 mb-12">
          Sleeper or ESPN &mdash; we support both
        </p>

        <div className="space-y-12">
          <SleeperImportForm />
          <EspnImportForm />
        </div>
      </div>
    </div>
  );
}
