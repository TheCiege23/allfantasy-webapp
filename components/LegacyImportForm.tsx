'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Crown, Loader2, CheckCircle2, History } from 'lucide-react';

interface LegacyImportFormProps {
  userId: string;
}

export default function LegacyImportForm({ userId }: LegacyImportFormProps) {
  const [platform, setPlatform] = useState<'sleeper' | 'espn'>('sleeper');
  const [sleeperUsername, setSleeperUsername] = useState('');
  const [espnLeagueId, setEspnLeagueId] = useState('');
  const [espnS2, setEspnS2] = useState('');
  const [swid, setSwid] = useState('');
  const [startSeason, setStartSeason] = useState(2020);
  const [endSeason, setEndSeason] = useState(2025);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ season: number; status: string; leagueName?: string }[]>([]);

  const seasonRange = Array.from(
    { length: endSeason - startSeason + 1 },
    (_, i) => startSeason + i
  );

  const handleImport = async () => {
    if (platform === 'sleeper' && !sleeperUsername.trim()) {
      toast.error('Please enter your Sleeper username');
      return;
    }
    if (platform === 'espn' && !espnLeagueId.trim()) {
      toast.error('Please enter your ESPN League ID');
      return;
    }

    setLoading(true);
    setResults([]);
    const importResults: { season: number; status: string; leagueName?: string }[] = [];

    try {
      if (platform === 'sleeper') {
        const userRes = await fetch(`https://api.sleeper.app/v1/user/${sleeperUsername.trim()}`);
        if (!userRes.ok) {
          toast.error('Sleeper username not found. Please check and try again.');
          setLoading(false);
          return;
        }
        const userData = await userRes.json();

        for (const season of seasonRange) {
          try {
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
              importResults.push({
                season,
                status: 'success',
                leagueName: `${data.imported} league${data.imported !== 1 ? 's' : ''}`,
              });
            } else {
              importResults.push({ season, status: data.error || 'Failed' });
            }
          } catch {
            importResults.push({ season, status: 'Network error' });
          }
          setResults([...importResults]);
        }
      } else {
        for (const season of seasonRange) {
          try {
            const res = await fetch('/api/import-espn', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leagueId: espnLeagueId.trim(),
                season,
                ...(espnS2 ? { espnS2 } : {}),
                ...(swid ? { swid } : {}),
              }),
            });
            const data = await res.json();
            if (res.ok) {
              importResults.push({
                season,
                status: 'success',
                leagueName: data.leagueName || 'Imported',
              });
            } else {
              importResults.push({ season, status: data.error || 'Failed' });
            }
          } catch {
            importResults.push({ season, status: 'Network error' });
          }
          setResults([...importResults]);
        }
      }

      const successCount = importResults.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        toast.success(`Imported ${successCount} season${successCount !== 1 ? 's' : ''} of legacy data!`);
      } else {
        toast.error('No seasons imported. Check your credentials and try again.');
      }
    } catch {
      toast.error('Something went wrong during import.');
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => 2015 + i);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 justify-center">
        <Button
          variant={platform === 'sleeper' ? 'default' : 'outline'}
          onClick={() => setPlatform('sleeper')}
          className={platform === 'sleeper'
            ? 'bg-cyan-600 hover:bg-cyan-700'
            : 'border-cyan-600/40 text-cyan-400 hover:bg-cyan-950/40'
          }
        >
          <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">S</span>
          Sleeper
        </Button>
        <Button
          variant={platform === 'espn' ? 'default' : 'outline'}
          onClick={() => setPlatform('espn')}
          className={platform === 'espn'
            ? 'bg-red-600 hover:bg-red-700'
            : 'border-red-600/40 text-red-400 hover:bg-red-950/40'
          }
        >
          <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">E</span>
          ESPN
        </Button>
      </div>

      <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <History className="h-5 w-5 text-purple-400" />
            Multi-Season Legacy Import
          </CardTitle>
          <CardDescription>
            Import multiple seasons at once to build your complete dynasty history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {platform === 'sleeper' ? (
            <div>
              <label className="mb-1 block text-sm text-gray-400">Sleeper Username</label>
              <Input
                placeholder="e.g. cjabar"
                value={sleeperUsername}
                onChange={(e) => setSleeperUsername(e.target.value)}
                disabled={loading}
                className="border-cyan-600/40 bg-gray-900 focus:border-cyan-500"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-gray-400">ESPN League ID</label>
                <Input
                  placeholder="e.g. 12345678 (from your league URL)"
                  value={espnLeagueId}
                  onChange={(e) => setEspnLeagueId(e.target.value)}
                  disabled={loading}
                  className="border-red-600/40 bg-gray-900 focus:border-red-500"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    espn_s2 Cookie <Badge variant="outline" className="ml-1 text-[10px] border-gray-600">Optional</Badge>
                  </label>
                  <Input
                    placeholder="For private leagues"
                    value={espnS2}
                    onChange={(e) => setEspnS2(e.target.value)}
                    disabled={loading}
                    className="border-gray-700 bg-gray-900 focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-400">
                    SWID Cookie <Badge variant="outline" className="ml-1 text-[10px] border-gray-600">Optional</Badge>
                  </label>
                  <Input
                    placeholder="For private leagues"
                    value={swid}
                    onChange={(e) => setSwid(e.target.value)}
                    disabled={loading}
                    className="border-gray-700 bg-gray-900 focus:border-red-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-400">Start Season</label>
              <select
                value={startSeason}
                onChange={(e) => setStartSeason(Number(e.target.value))}
                className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={loading}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">End Season</label>
              <select
                value={endSeason}
                onChange={(e) => setEndSeason(Number(e.target.value))}
                className="w-full rounded-md border border-purple-600/40 bg-gray-900 px-4 py-2 text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={loading}
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Importing {seasonRange.length} season{seasonRange.length !== 1 ? 's' : ''}: {startSeason} — {endSeason}
          </p>

          <Button
            onClick={handleImport}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing Legacy Data...</>
            ) : (
              <><Crown className="mr-2 h-4 w-4" /> Import {seasonRange.length} Season{seasonRange.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Import Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r) => (
                <div
                  key={r.season}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-gray-900/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-white">{r.season}</span>
                    {r.leagueName && (
                      <span className="text-sm text-gray-400">{r.leagueName}</span>
                    )}
                  </div>
                  {r.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <span className="text-xs text-red-400">{r.status}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
