'use client';
import { useEffect, useState } from 'react';
import { User, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';

interface ProfileData {
  summary: string | null;
  voteCount: number;
  version: number;
  lastUpdated: string | null;
}

export default function UserTradeProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/trade-profile')
      .then(r => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setProfile({ summary: null, voteCount: 0, version: 0, lastUpdated: null });
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 text-center">Loading your trade style...</div>;

  return (
    <div className="rounded-3xl bg-[var(--panel)] border border-[var(--border)] p-6 shadow-xl">
      <h3 className="font-bold text-xl mb-5 flex items-center gap-3">
        <User className="w-6 h-6 text-cyan-400" />
        What I&apos;ve Learned About Your Trade Style
      </h3>

      {profile?.summary ? (
        <div className="space-y-4 text-sm">
          {profile.summary.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} className="flex items-start gap-3">
              {line.includes('dislikes') || line.includes('sensitive') || line.includes('avoids') ? (
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-1" />
              ) : (
                <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
              )}
              <p>{line}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[var(--muted)]">Vote thumbs up/down on suggestions to help me understand your style better.</p>
      )}

      <div className="flex items-center justify-between mt-8 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        {profile && profile.voteCount > 0 ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted2)' }}>
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Based on {profile.voteCount} vote{profile.voteCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>v{profile.version}</span>
            {profile.lastUpdated && (
              <>
                <span>·</span>
                <span>Updated {new Date(profile.lastUpdated).toLocaleDateString()}</span>
              </>
            )}
          </div>
        ) : (
          <div />
        )}
        <p className="text-xs" style={{ color: 'var(--muted2)' }}>
          Updates automatically from your feedback.
        </p>
      </div>
    </div>
  );
}
