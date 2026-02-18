'use client';
import { useEffect, useState } from 'react';
import { User, AlertTriangle, TrendingUp } from 'lucide-react';

export default function UserTradeProfile() {
  const [profile, setProfile] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/trade-profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data.summary || 'Not enough feedback yet to build your trade profile.');
        setLoading(false);
      })
      .catch(() => {
        setProfile('Unable to load profile.');
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

      {profile ? (
        <div className="space-y-4 text-sm">
          {profile.split('\n').filter(Boolean).map((line, i) => (
            <div key={i} className="flex items-start gap-3">
              {line.includes('dislikes') || line.includes('sensitive') ? (
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

      <p className="text-xs text-center text-[var(--muted2)] mt-8">
        This updates automatically from your feedback. Reset anytime in settings.
      </p>
    </div>
  );
}
