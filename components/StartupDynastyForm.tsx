'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Trophy } from 'lucide-react';

export default function StartupDynastyForm({ userId }: { userId: string }) {
  const [leagueName, setLeagueName] = useState('');
  const [platform, setPlatform] = useState<'sleeper' | 'espn' | 'manual'>('sleeper');
  const [platformLeagueId, setPlatformLeagueId] = useState('');
  const [leagueSize, setLeagueSize] = useState('12');
  const [scoring, setScoring] = useState('ppr');
  const [format, setFormat] = useState<'dynasty' | 'keeper'>('dynasty');
  const [qbFormat, setQbFormat] = useState<'1qb' | 'sf'>('sf');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!leagueName.trim()) newErrors.leagueName = 'League name is required';
    if (platform !== 'manual' && !platformLeagueId.trim()) {
      newErrors.platformLeagueId = `${platform === 'sleeper' ? 'Sleeper' : 'ESPN'} League ID is required`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/league/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leagueName.trim(),
          platform,
          platformLeagueId: platform !== 'manual' ? platformLeagueId.trim() : undefined,
          leagueSize: Number(leagueSize),
          scoring,
          isDynasty: format === 'dynasty',
          isSuperflex: qbFormat === 'sf',
          userId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('This league already exists in your account');
        } else {
          toast.error(data.error || 'Failed to create league');
        }
        return;
      }

      toast.success('Dynasty league created! Redirecting...');
      setTimeout(() => {
        window.location.href = '/af-legacy';
      }, 1500);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-purple-500/30 bg-black/40 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <Trophy className="h-5 w-5 text-purple-400" />
          League Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="league-name">League Name</Label>
          <Input
            id="league-name"
            placeholder="e.g. Dynasty Dawgs"
            value={leagueName}
            onChange={(e) => { setLeagueName(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.leagueName; return n; }); }}
            disabled={loading}
            className={`bg-gray-900 focus:border-purple-500 ${errors.leagueName ? 'border-red-500' : 'border-purple-600/40'}`}
          />
          {errors.leagueName && <p className="text-red-400 text-sm mt-1">{errors.leagueName}</p>}
        </div>

        <div>
          <Label>Platform</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
            <SelectTrigger className="bg-gray-900 border-purple-600/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sleeper">Sleeper</SelectItem>
              <SelectItem value="espn">ESPN</SelectItem>
              <SelectItem value="manual">Manual Setup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {platform !== 'manual' && (
          <div>
            <Label htmlFor="platform-id">{platform === 'sleeper' ? 'Sleeper' : 'ESPN'} League ID</Label>
            <Input
              id="platform-id"
              placeholder={platform === 'sleeper' ? 'e.g. 123456789' : 'e.g. 12345678'}
              value={platformLeagueId}
              onChange={(e) => { setPlatformLeagueId(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.platformLeagueId; return n; }); }}
              disabled={loading}
              className={`bg-gray-900 focus:border-purple-500 ${errors.platformLeagueId ? 'border-red-500' : 'border-purple-600/40'}`}
            />
            {errors.platformLeagueId && <p className="text-red-400 text-sm mt-1">{errors.platformLeagueId}</p>}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>League Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as any)}>
              <SelectTrigger className="bg-gray-900 border-purple-600/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dynasty">Dynasty</SelectItem>
                <SelectItem value="keeper">Keeper</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>QB Format</Label>
            <Select value={qbFormat} onValueChange={(v) => setQbFormat(v as any)}>
              <SelectTrigger className="bg-gray-900 border-purple-600/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sf">Superflex (2QB)</SelectItem>
                <SelectItem value="1qb">1QB</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>League Size</Label>
            <Select value={leagueSize} onValueChange={setLeagueSize}>
              <SelectTrigger className="bg-gray-900 border-purple-600/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 Teams</SelectItem>
                <SelectItem value="10">10 Teams</SelectItem>
                <SelectItem value="12">12 Teams</SelectItem>
                <SelectItem value="14">14 Teams</SelectItem>
                <SelectItem value="16">16 Teams</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scoring</Label>
            <Select value={scoring} onValueChange={setScoring}>
              <SelectTrigger className="bg-gray-900 border-purple-600/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ppr">PPR</SelectItem>
                <SelectItem value="half_ppr">Half PPR</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="te_premium">TE Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
          size="lg"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating League...</>
          ) : (
            <><Trophy className="mr-2 h-4 w-4" /> Create Dynasty League</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
