import Link from "next/link";
import { ArrowUpRight, Calendar, Trophy, TrendingUp } from "lucide-react";

const SECTIONS = [
  {
    title: "Projected 1-Seeds",
    description: "Top teams expected on the No. 1 lines.",
    items: ["See latest ESPN projection"],
  },
  {
    title: "Last Four In",
    description: "Bubble teams currently projected to make the field.",
    items: ["See latest ESPN projection"],
  },
  {
    title: "First Four Out",
    description: "Closest teams currently outside the projected field.",
    items: ["See latest ESPN projection"],
  },
];

const ESPN_URL =
  "https://www.espn.com/espn/feature/story/_/page/bracketology/ncaa-bracketology-2026-march-madness-men-field-predictions";

export function BracketologySpotlight() {
  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-gray-900 to-gray-900 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
            <TrendingUp className="h-3.5 w-3.5" />
            2026 Bracketology Snapshot
          </div>
          <h2 className="mt-3 text-xl font-semibold text-white">ESPN Bracketology Hub</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-300">
            We added a cleaner, user-facing Bracketology section so users can quickly see what to track
            before making picks: projected top seeds, bubble teams, and who is trending up/down.
          </p>
        </div>

        <Link
          href={ESPN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
        >
          Open ESPN Bracketology
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {SECTIONS.map((section) => (
          <article key={section.title} className="rounded-xl border border-white/10 bg-black/25 p-4">
            <h3 className="text-sm font-semibold text-white">{section.title}</h3>
            <p className="mt-1 text-xs text-gray-400">{section.description}</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-200">
              {section.items.map((item) => (
                <li key={item} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <Calendar className="h-3.5 w-3.5" />
          Tip: refresh this section weekly during conference play.
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
          <Trophy className="h-3.5 w-3.5" />
          Use this with Pick Assist to compare model picks vs public projections.
        </div>
      </div>
    </section>
  );
}
