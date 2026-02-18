'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, RefreshCw, AlertCircle, CheckCircle, Loader2, X, Shield, ExternalLink, Search } from 'lucide-react';
import { toast } from 'sonner';

interface League {
  id: string;
  name: string | null;
  platform: string;
  platformLeagueId: string;
  leagueSize: number | null;
  scoring: string | null;
  isDynasty: boolean | null;
  syncStatus: string | null;
  syncError: string | null;
  lastSyncedAt: string | null;
}

export default function LeagueSyncDashboard() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [platform, setPlatform] = useState('sleeper');
  const [leagueId, setLeagueId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [yahooConnected, setYahooConnected] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  const [sleeperUsername, setSleeperUsername] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredLeagues, setDiscoveredLeagues] = useState<any[]>([]);

  const fetchLeagues = async () => {
    try {
      const res = await fetch('/api/league/list');
      if (res.status === 401) {
        setLeagues([]);
        return;
      }
      const data = await res.json();
      setLeagues(data.leagues || []);
    } catch {
      toast.error('Failed to load leagues');
    } finally {
      setLoading(false);
    }
  };

  const checkYahooAuth = async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/league/auth');
      if (!res.ok) return;
      const data = await res.json();
      const yahooAuth = (data.auths || []).find((a: any) => a.platform === 'yahoo');
      setYahooConnected(!!yahooAuth?.hasOauthToken);
    } catch {
      // ignore
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
    checkYahooAuth();

    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'yahoo_connected') {
      toast.success('Yahoo account connected! Now enter your league key to sync.');
      setYahooConnected(true);
      setShowAddModal(true);
      setPlatform('yahoo');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('error')?.startsWith('yahoo')) {
      toast.error(`Yahoo connection failed: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const syncLeague = async (plat: string, lgId: string) => {
    if (plat === 'sleeper') {
      const res = await fetch('/api/league/sleeper-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeperLeagueId: lgId }),
      });
      return res.json();
    }

    const res = await fetch('/api/league/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: plat, platformLeagueId: lgId }),
    });
    return res.json();
  };

  const addLeague = async () => {
    if (!leagueId.trim()) return;
    setIsAdding(true);
    try {
      const data = await syncLeague(platform, leagueId.trim());

      if (data.success) {
        toast.success(`League "${data.name || data.leagueName}" synced!`);
        setShowAddModal(false);
        setLeagueId('');
        await fetchLeagues();
      } else {
        toast.error(data.error || 'Failed to sync league');
      }
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsAdding(false);
    }
  };

  const reSync = async (league: League) => {
    setSyncingId(league.id);
    try {
      const data = await syncLeague(league.platform, league.platformLeagueId);

      if (data.success) {
        toast.success(`"${data.name || data.leagueName}" re-synced!`);
        await fetchLeagues();
      } else {
        toast.error(data.error || 'Re-sync failed');
      }
    } catch {
      toast.error('Network error during re-sync');
    } finally {
      setSyncingId(null);
    }
  };

  const platformLabel = (p: string) => {
    const map: Record<string, string> = {
      sleeper: 'Sleeper',
      mfl: 'MFL',
      yahoo: 'Yahoo',
      espn: 'ESPN',
      fantrax: 'Fantrax',
    };
    return map[p] || p.toUpperCase();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">League Sync</h1>
          <p className="text-sm text-slate-400 mt-1">Connect your fantasy leagues for AI-powered analysis</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl flex items-center gap-2 font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Add League
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : leagues.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16 border border-dashed border-slate-700 rounded-2xl"
        >
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg mb-2">No leagues synced yet</p>
          <p className="text-slate-500 text-sm mb-6">
            Add your first league to unlock roster-aware AI features
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-medium transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Your First League
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {leagues.map((lg, i) => (
            <motion.div
              key={lg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-slate-900/60 border border-slate-700/50 p-5 hover:border-slate-600 transition-colors"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base truncate">{lg.name || 'Unnamed League'}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {platformLabel(lg.platform)} &bull; {lg.leagueSize || '?'}-team &bull;{' '}
                    {lg.isDynasty ? 'Dynasty' : 'Redraft'} &bull;{' '}
                    {lg.scoring?.toUpperCase() || 'STD'}
                  </p>
                </div>
                {lg.syncStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 ml-2" />
                ) : lg.syncStatus === 'error' ? (
                  <div className="relative group flex-shrink-0 ml-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    {lg.syncError && (
                      <div className="absolute right-0 top-7 w-48 p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-red-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {lg.syncError}
                      </div>
                    )}
                  </div>
                ) : (
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin flex-shrink-0 ml-2" />
                )}
              </div>

              <div className="text-xs text-slate-500 mb-4">
                Last synced:{' '}
                {lg.lastSyncedAt
                  ? new Date(lg.lastSyncedAt).toLocaleString()
                  : 'Never'}
              </div>

              <button
                onClick={() => reSync(lg)}
                disabled={syncingId === lg.id}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 text-sm disabled:opacity-50 transition-colors"
              >
                {syncingId === lg.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Re-sync
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl bg-slate-900/60 border border-slate-700/50 p-6">
        <h3 className="text-lg font-bold mb-4">Discover Sleeper Leagues</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={sleeperUsername}
            onChange={(e) => setSleeperUsername(e.target.value)}
            placeholder="Enter your Sleeper username"
            className="flex-1 p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => e.key === 'Enter' && !discovering && sleeperUsername.trim() && document.getElementById('discover-btn')?.click()}
          />
          <button
            id="discover-btn"
            onClick={async () => {
              if (!sleeperUsername.trim()) return toast.error('Enter your Sleeper username');
              setDiscovering(true);
              setDiscoveredLeagues([]);
              try {
                const res = await fetch('/api/league/sleeper-discover', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sleeperUsername: sleeperUsername.trim() }),
                });
                const data = await res.json();
                if (data.success) {
                  setDiscoveredLeagues(data.leagues);
                  toast.success(`Found ${data.leagues.length} Sleeper leagues!`);
                } else {
                  toast.error(data.error || 'Discovery failed');
                }
              } catch {
                toast.error('Failed to discover leagues');
              } finally {
                setDiscovering(false);
              }
            }}
            disabled={discovering || !sleeperUsername.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl flex items-center gap-2 font-medium disabled:opacity-50 transition-all text-sm"
          >
            {discovering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {discovering ? 'Searching...' : 'Discover My Leagues'}
          </button>
        </div>

        {discoveredLeagues.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-400 mb-3">
              Found {discoveredLeagues.length} league{discoveredLeagues.length !== 1 ? 's' : ''}
            </h4>
            <div className="grid gap-4 md:grid-cols-2">
              {discoveredLeagues.map((l: any) => (
                <div key={l.sleeperLeagueId} className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700">
                  <h4 className="font-semibold">{l.name}</h4>
                  <p className="text-sm text-slate-400 mt-1">
                    {l.totalTeams}-team &bull; {l.isDynasty ? 'Dynasty' : 'Redraft'} &bull; {l.season}
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/league/sleeper-sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sleeperLeagueId: l.sleeperLeagueId }),
                        });
                        const d = await res.json();
                        if (d.success) {
                          toast.success(`Added ${l.name}`);
                          await fetchLeagues();
                        } else {
                          toast.error(d.error || 'Sync failed');
                        }
                      } catch {
                        toast.error('Failed to sync league');
                      }
                    }}
                    className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors"
                  >
                    Add & Sync
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold">Add a League</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <label className="block text-sm text-slate-400 mb-1.5">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 mb-4 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="sleeper">Sleeper</option>
                <option value="mfl">MyFantasyLeague (MFL)</option>
                <option value="yahoo">Yahoo</option>
                <option value="espn">ESPN</option>
                <option value="fantrax">Fantrax</option>
              </select>

              {platform === 'yahoo' && !yahooConnected ? (
                <div className="mb-4">
                  <p className="text-sm text-slate-300 mb-3">
                    Connect your Yahoo account first, then enter your league key to sync.
                  </p>
                  <a
                    href="/api/league/yahoo-auth"
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Connect Yahoo Account
                  </a>
                </div>
              ) : (
                <>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    {platform === 'yahoo' ? 'League Key' : 'League ID'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      platform === 'sleeper'
                        ? 'e.g. 1048345678901234567'
                        : platform === 'yahoo'
                        ? 'e.g. nfl.l.123456'
                        : 'Enter your league ID'
                    }
                    value={leagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 mb-2 text-sm focus:outline-none focus:border-cyan-500"
                    onKeyDown={(e) => e.key === 'Enter' && addLeague()}
                  />
                  {platform === 'sleeper' && (
                    <p className="text-xs text-slate-500 mb-4">
                      Find this in the Sleeper app under League Settings &rarr; General
                    </p>
                  )}
                  {platform === 'yahoo' && yahooConnected && (
                    <p className="text-xs text-emerald-400/80 mb-4">
                      Yahoo connected &#10003; &mdash; Enter your league key (e.g. nfl.l.123456)
                    </p>
                  )}
                  {platform === 'fantrax' && (
                    <p className="text-xs text-amber-400/80 mb-4">
                      Fantrax sync is coming soon.
                    </p>
                  )}

                  <button
                    onClick={addLeague}
                    disabled={isAdding || !leagueId.trim() || (platform === 'fantrax')}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isAdding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Syncing...
                      </>
                    ) : (
                      'Add & Sync League'
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
