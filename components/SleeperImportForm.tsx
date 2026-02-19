'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SleeperImportForm() {
  const [userId, setUserId] = useState('');
  const [season, setSeason] = useState(2025);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!userId.trim()) return;
    setLoading(true);

    try {
      const userRes = await fetch(`https://api.sleeper.app/v1/user/${userId.trim()}`);
      if (!userRes.ok) {
        toast.error('Sleeper username not found. Please check and try again.');
        setLoading(false);
        return;
      }
      const userData = await userRes.json();

      const res = await fetch('/api/import-sleeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleeperUserId: userData.user_id,
          sport: 'nfl',
          season,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Imported ${data.imported} league${data.imported !== 1 ? 's' : ''}! View them on the Rankings page.`);
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-cyan-900/30 bg-black/40 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold">S</span>
          Import from Sleeper
        </CardTitle>
        <CardDescription>
          Enter your Sleeper username to import all your NFL leagues and weekly data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="sleeper-username" className="mb-1 block text-sm text-gray-400">
            Sleeper Username
          </label>
          <Input
            id="sleeper-username"
            placeholder="e.g. cjabar (find at sleeper.app)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={loading}
            className="border-cyan-600/40 bg-gray-900 focus:border-cyan-500"
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
            className="w-full rounded-md border border-cyan-600/40 bg-gray-900 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            disabled={loading}
          >
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
            <option value={2023}>2023</option>
          </select>
        </div>

        <Button
          onClick={handleImport}
          disabled={loading || !userId.trim()}
          className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 disabled:opacity-50"
        >
          {loading ? 'Importing...' : 'Import Leagues & Weekly Data'}
        </Button>
      </CardContent>
    </Card>
  );
}
