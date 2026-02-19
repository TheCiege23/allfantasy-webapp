'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EspnImportForm() {
  const [leagueId, setLeagueId] = useState("");
  const [espnS2, setEspnS2] = useState("");

  return (
    <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-sm font-bold">E</span>
          Import from ESPN
        </CardTitle>
        <CardDescription>
          Enter your ESPN league ID and authentication cookie to import
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label htmlFor="espn-league-id" className="mb-1 block text-sm text-gray-400">
              ESPN League ID
            </label>
            <input
              id="espn-league-id"
              type="text"
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              placeholder="e.g. 12345678"
              className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label htmlFor="espn-s2" className="mb-1 block text-sm text-gray-400">
              ESPN S2 Cookie (for private leagues)
            </label>
            <input
              id="espn-s2"
              type="password"
              value={espnS2}
              onChange={(e) => setEspnS2(e.target.value)}
              placeholder="Optional - only needed for private leagues"
              className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <Button
            type="submit"
            disabled
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 opacity-50 cursor-not-allowed"
          >
            ESPN Import Coming Soon
          </Button>

          <p className="text-xs text-gray-500 text-center">
            ESPN integration is in development. Sleeper is fully supported now.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
