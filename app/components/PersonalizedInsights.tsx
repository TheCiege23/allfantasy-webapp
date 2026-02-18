'use client';

import { Sparkles, AlertTriangle } from 'lucide-react';

export default function PersonalizedInsights() {
  return (
    <div className="mt-16 space-y-8">
      <div className="bg-gradient-to-br from-purple-950/70 to-indigo-950/70 border border-purple-500/30 rounded-3xl p-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Sparkles className="w-7 h-7 text-amber-400" />
          Your Next Edge
        </h3>
        <div className="space-y-6">
          <div>
            <div className="text-lg font-semibold text-purple-300 mb-2">Focus Format Path</div>
            <div className="text-xl font-bold">Specialty Formats</div>
            <p className="text-slate-300 mt-2">
              53.8% adj. win rate (79 leagues) &mdash; this is where you have the most room to grow.
            </p>
          </div>

          <div>
            <div className="text-lg font-semibold text-purple-300 mb-2">Action</div>
            <div className="text-xl font-bold">Converting playoff runs into championships</div>
            <p className="text-slate-300 mt-2">
              Your next edge: converting playoff runs into championship finishes.
            </p>
          </div>

          <div className="bg-slate-950/50 p-5 rounded-2xl border border-purple-500/20">
            <div className="text-purple-300 mb-2">Your strongest lane</div>
            <p className="text-lg font-medium">
              Dynasty Career at 55.4% &mdash; apply those winning habits here.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-950/70 to-slate-950/70 border border-cyan-500/30 rounded-3xl p-8">
        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <AlertTriangle className="w-7 h-7 text-cyan-400" />
          Battle-tested in the toughest formats
        </h3>
        <p className="text-slate-300 text-lg leading-relaxed">
          Sustaining 43.1% win rate across 531 leagues while winning 12 championships is rare.
          Your 1.24x difficulty means raw stats understate your real skill. <strong>Keep stacking.</strong>
        </p>
      </div>
    </div>
  );
}
