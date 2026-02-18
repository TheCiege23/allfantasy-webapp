'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function SyncedRosters() {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/league/list')
      .then(r => {
        if (r.status === 401) return { leagues: [] };
        return r.json();
      })
      .then(data => {
        setLeagues(data.leagues || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Loading synced leagues...</p>
      </div>
    );
  }

  if (leagues.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
        <Users className="w-7 h-7 text-cyan-400" />
        Synced Rosters & Leagues
      </h2>

      <div className="space-y-4">
        {leagues.map(league => (
          <div key={league.id} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            <button
              onClick={() => setExpandedLeague(expandedLeague === league.id ? null : league.id)}
              className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/50 transition"
            >
              <div>
                <div className="font-semibold text-lg">{league.name || 'Unnamed League'}</div>
                <div className="text-sm text-slate-400 mt-1">
                  {league.platform.toUpperCase()} &bull; {league.leagueSize}-team &bull;{' '}
                  {league.isDynasty ? 'Dynasty' : 'Redraft'} &bull;{' '}
                  {league.scoring?.toUpperCase() || 'STD'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Last synced: {league.lastSyncedAt ? new Date(league.lastSyncedAt).toLocaleDateString() : 'Never'}
                </div>
              </div>

              <div className="flex items-center gap-4">
                {league.syncStatus === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                )}
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${expandedLeague === league.id ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            <AnimatePresence>
              {expandedLeague === league.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-800"
                >
                  <div className="p-6 bg-slate-950/50">
                    <h4 className="font-medium mb-4">
                      Rosters in this league ({league.rosters?.length || 0})
                    </h4>

                    {league.rosters?.length > 0 ? (
                      <div className="space-y-4">
                        {league.rosters.map((roster: any) => {
                          const players = roster.players || roster.playerData || [];
                          const starters = roster.starters || [];

                          return (
                            <div
                              key={roster.id}
                              className="p-4 rounded-xl bg-slate-900 border border-slate-800"
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">
                                    Owner: {roster.platformUserId}
                                  </div>
                                  <div className="text-sm text-slate-400 mt-1">
                                    {Array.isArray(players) ? players.length : 0} players
                                    {roster.faabRemaining != null && ` • FAAB: $${roster.faabRemaining}`}
                                    {roster.waiverPriority != null && ` • Waiver #${roster.waiverPriority}`}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {Array.isArray(starters) ? starters.length : 0} starters
                                </div>
                              </div>

                              {Array.isArray(players) && players.length > 0 && (
                                <div className="mt-3 text-xs text-slate-400">
                                  Players: {players.slice(0, 5).join(', ')}
                                  {players.length > 5 ? ` ... +${players.length - 5} more` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-center py-4">
                        No rosters synced yet for this league
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
