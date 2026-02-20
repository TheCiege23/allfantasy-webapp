'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';

export default function LegacyLeagueIdeaForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leagueTypeName: '',
    description: '',
    scoringRules: '',
    rulesSettings: '',
    sport: 'NFL',
    draftType: 'snake',
    teamSize: '12',
    creditName: '',
    email: '',
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (documentFile) body.append('document', documentFile);

      const response = await fetch('/api/submit-league', {
        method: 'POST',
        body,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit idea');
      }

      setSuccess('Submitted. Your idea is now in Admin → Ideas.');
      setForm({
        leagueTypeName: '',
        description: '',
        scoringRules: '',
        rulesSettings: '',
        sport: 'NFL',
        draftType: 'snake',
        teamSize: '12',
        creditName: '',
        email: '',
      });
      setDocumentFile(null);
    } catch (err: any) {
      setError(String(err?.message || 'Failed to submit idea'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cyan-400/30 bg-[#070b19] p-5 md:p-7">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-8 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" />
        <div className="absolute right-10 bottom-8 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl animate-pulse" />
      </div>

      <form onSubmit={submit} className="relative z-10 space-y-4">
        <div>
          <h2 className="text-2xl font-black text-white">Submit League Idea</h2>
          <p className="mt-1 text-sm text-cyan-100/80">Built for Legacy users — bright tab, quick submit, directly wired to Admin Ideas.</p>
        </div>

        {success && <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">{success}</div>}
        {error && <div className="rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="grid gap-3 md:grid-cols-2">
          <input required className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="League name" value={form.leagueTypeName} onChange={(e) => onChange('leagueTypeName', e.target.value)} />
          <input required className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="Your name" value={form.creditName} onChange={(e) => onChange('creditName', e.target.value)} />
          <input required type="email" className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 md:col-span-2" placeholder="Email" value={form.email} onChange={(e) => onChange('email', e.target.value)} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <select className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white" value={form.sport} onChange={(e) => onChange('sport', e.target.value)}>
            <option>NFL</option>
            <option>NBA</option>
            <option>MLB</option>
            <option>NHL</option>
            <option>Other</option>
          </select>
          <select className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white" value={form.draftType} onChange={(e) => onChange('draftType', e.target.value)}>
            <option value="snake">Snake</option>
            <option value="auction">Auction</option>
            <option value="linear">Linear</option>
            <option value="best-ball">Best Ball</option>
          </select>
          <input className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="Team size" value={form.teamSize} onChange={(e) => onChange('teamSize', e.target.value)} />
        </div>

        <textarea required className="min-h-[110px] w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="Describe the format" value={form.description} onChange={(e) => onChange('description', e.target.value)} />
        <textarea className="min-h-[90px] w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="Scoring rules" value={form.scoringRules} onChange={(e) => onChange('scoringRules', e.target.value)} />
        <textarea className="min-h-[90px] w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40" placeholder="Rules / settings" value={form.rulesSettings} onChange={(e) => onChange('rulesSettings', e.target.value)} />

        <div className="rounded-lg border border-white/20 bg-black/20 p-3">
          <label className="text-sm text-slate-300">Optional doc upload</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.rtf,.png,.jpg,.jpeg"
            className="mt-2 block w-full text-sm text-white/70"
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
          />
          {documentFile && <p className="mt-2 text-xs text-cyan-200">Attached: {documentFile.name}</p>}
        </div>

        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-300 disabled:opacity-60">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Submit Idea
        </button>
      </form>
    </div>
  );
}
