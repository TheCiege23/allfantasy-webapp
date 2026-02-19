'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function SleeperImportForm() {
  const [sleeperUsername, setSleeperUsername] = useState("");
  const [season, setSeason] = useState(2025);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; imported?: number; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sleeperUsername.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${sleeperUsername.trim()}`);
      if (!userRes.ok) {
        setResult({ error: "Sleeper username not found. Please check and try again." });
        setLoading(false);
        return;
      }
      const userData = await userRes.json();

      const res = await fetch("/api/import-sleeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sleeperUserId: userData.user_id,
          sport: "nfl",
          season,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, imported: data.imported });
      } else {
        setResult({ error: data.error || "Import failed" });
      }
    } catch {
      setResult({ error: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold">S</span>
          Import from Sleeper
        </CardTitle>
        <CardDescription>
          Enter your Sleeper username to import all your NFL leagues
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sleeper-username" className="mb-1 block text-sm text-gray-400">
              Sleeper Username
            </label>
            <input
              id="sleeper-username"
              type="text"
              value={sleeperUsername}
              onChange={(e) => setSleeperUsername(e.target.value)}
              placeholder="e.g. cjabar"
              className="w-full rounded-md border border-cyan-600/40 bg-gray-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="sleeper-season" className="mb-1 block text-sm text-gray-400">
              Season
            </label>
            <select
              id="sleeper-season"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="w-full rounded-md border border-cyan-600/40 bg-gray-900 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={loading}
            >
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <Button
            type="submit"
            disabled={loading || !sleeperUsername.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import Sleeper Leagues"}
          </Button>

          {result && (
            <div className={cn(
              "rounded-md p-3 text-sm",
              result.success
                ? "border border-green-600/40 bg-green-950/30 text-green-300"
                : "border border-red-600/40 bg-red-950/30 text-red-300"
            )}>
              {result.success
                ? `Successfully imported ${result.imported} league${result.imported !== 1 ? "s" : ""}! View them on the Rankings page.`
                : result.error}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
