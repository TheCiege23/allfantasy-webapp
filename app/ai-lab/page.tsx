import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bracket Lab | FanCred Brackets",
  description:
    "Explore simulations, compare bracket styles, and understand tournament volatility with data-driven tools.",
};

type Tier = {
  name: string;
  price: string;
  cadence?: string;
  tagline: string;
  cta: { label: string; href: string };
  highlight?: boolean;
  badges?: string[];
  features: string[];
  finePrint?: string[];
};

const TIERS: Tier[] = [
  {
    name: "Free (Included)",
    price: "$0",
    tagline: "Data-backed matchup cards and transparent sources for everyone.",
    cta: { label: "Open Bracket", href: "/" },
    features: [
      "Matchup cards with sourced stats + \u201CData last updated\u201D",
      "Basic confidence indicator based on available sources",
      "League + global leaderboards",
      "Brackets Busted feed (league + global)",
      "Live scoring and bracket reactions",
    ],
    finePrint: [
      "Free features never require payment.",
      "Free features are not designed or marketed as a way to win prizes or money.",
    ],
  },
  {
    name: "Bracket Lab Pass",
    price: "$9.99",
    cadence: "per tournament",
    tagline:
      "Run simulations, compare strategies, and learn how volatility changes outcomes.",
    cta: { label: "Start Lab Pass", href: "/donate?mode=lab" },
    highlight: true,
    badges: ["Most Popular", "Research Tools"],
    features: [
      "10,000+ simulation runs per bracket (Monte Carlo)",
      "Compare bracket styles: Chalk vs Balanced vs Chaos",
      "Strategy sliders (risk, uniqueness, upset tolerance)",
      "Round-by-round recalibration dashboard (post-round updates)",
      "Exportable reports: bracket health, volatility, scenario summaries",
      "Faster refresh cadence for Lab charts during peak windows",
    ],
    finePrint: [
      "Bracket Lab is a research and visualization tool. It does not guarantee outcomes.",
      "We do not run, host, or pay out prize contests. League dues/payouts (if any) happen elsewhere.",
      "All numeric claims displayed in Lab views must show a source and last-updated timestamp.",
    ],
  },
  {
    name: "Supporter",
    price: "Donate",
    tagline:
      "Help keep brackets free and fund performance, data costs, and new features.",
    cta: { label: "Donate", href: "/donate" },
    badges: ["Optional", "Cosmetic Perks"],
    features: [
      "Supporter badge (cosmetic)",
      "Early access to new themes (cosmetic)",
      "Priority feedback channel (non-gameplay)",
      "Keeps brackets free for everyone",
    ],
    finePrint: [
      "Donations are optional and do not unlock competitive advantages.",
    ],
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Is Bracket Lab designed to help me win money?",
    a: "No. Bracket Lab is positioned as a research and experimentation tool: it runs simulations, visualizes volatility, and summarizes sourced information. It is not marketed as an \u201Cedge,\u201D and it does not guarantee outcomes.",
  },
  {
    q: "Do you collect entry fees or pay prizes?",
    a: "No. FanCred Brackets hosts bracket experiences and provides stats/simulation tools. If your group uses dues/payouts elsewhere, that\u2019s handled outside of this platform.",
  },
  {
    q: "Does Bracket Lab change scoring or gameplay?",
    a: "No. The bracket format, scoring rules, and leaderboards are the same for everyone. Bracket Lab adds analysis, comparisons, and simulation views.",
  },
  {
    q: "Where does your information come from?",
    a: "From configured sports data providers (for schedule/live scoring/play-by-play) and approved sources for stats/news/availability. Every numeric claim shown includes a source link and a last-updated time.",
  },
  {
    q: "Can I use Bracket Lab without sharing my bracket publicly?",
    a: "Yes. Bracket Lab can run on your own bracket privately. Leagues can also configure pick visibility rules (e.g., hide picks until lock).",
  },
];

function cn(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/80">
      {children}
    </span>
  );
}

function Check() {
  return (
    <span
      aria-hidden
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-white/5"
    >
      &#10003;
    </span>
  );
}

export default function BracketLabLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <Hero />
        <TrustBar />
        <TierGrid />
        <HowItWorks />
        <FAQSection />
        <FooterCTA />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">FanCred Brackets</div>
            <div className="text-xs text-white/60">Bracket Lab</div>
          </div>
        </a>

        <nav className="flex items-center gap-2">
          <a
            href="#pricing"
            className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
          >
            Plans
          </a>
          <a
            href="#faq"
            className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
          >
            FAQ
          </a>
          <a
            href="/donate"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Donate
          </a>
          <a
            href="/"
            className="rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:opacity-95"
          >
            Open Bracket
          </a>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 sm:p-12">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-cyan-500/15 via-transparent to-violet-500/15" />

      <div className="max-w-2xl">
        <div className="flex flex-wrap gap-2">
          <Badge>All brackets free</Badge>
          <Badge>Data-first</Badge>
          <Badge>Sources + timestamps</Badge>
          <Badge>Simulations</Badge>
        </div>

        <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
          Bracket Lab: simulations and strategy exploration &mdash; not promises.
        </h1>

        <p className="mt-4 text-base text-white/75 sm:text-lg">
          Use Bracket Lab to explore how tournament volatility can reshape
          outcomes. Compare bracket styles, run simulations, and read matchup
          summaries built from sourced information with clear timestamps.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-semibold text-slate-950 hover:opacity-95"
          >
            View Lab Plans
          </a>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
          >
            Use Free Brackets
          </a>
        </div>

        <p className="mt-4 text-xs text-white/55">
          Bracket Lab is a research/visualization tool. It does not guarantee
          outcomes. FanCred Brackets does not collect entry fees or pay prizes.
        </p>
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { title: "Sourced claims", desc: "Every numeric claim includes a source." },
    { title: "Last updated", desc: "Clear timestamps on live + AI." },
    { title: "No pay-to-win", desc: "Scoring and gameplay are identical." },
    { title: "Fast live updates", desc: "WebSockets + cached leaderboards." },
  ];

  return (
    <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.title}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <div className="text-sm font-semibold">{it.title}</div>
          <div className="mt-1 text-sm text-white/70">{it.desc}</div>
        </div>
      ))}
    </section>
  );
}

function TierGrid() {
  return (
    <section id="pricing" className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Plans</h2>
          <p className="mt-1 text-white/70">
            Keep brackets free. Add Bracket Lab if you want deeper simulations
            and comparisons.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              "relative rounded-3xl border bg-white/5 p-6",
              tier.highlight
                ? "border-violet-400/40 shadow-[0_0_0_1px_rgba(167,139,250,0.2)]"
                : "border-white/10"
            )}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-6 flex gap-2">
                {(tier.badges ?? []).map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 px-3 py-1 text-xs font-semibold text-slate-950"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{tier.name}</div>
                <div className="mt-1 text-sm text-white/70">{tier.tagline}</div>
              </div>
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <div className="text-3xl font-semibold">{tier.price}</div>
              {tier.cadence && (
                <div className="text-sm text-white/60">{tier.cadence}</div>
              )}
            </div>

            <a
              href={tier.cta.href}
              className={cn(
                "mt-5 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold",
                tier.highlight
                  ? "bg-gradient-to-r from-cyan-400 to-violet-500 text-slate-950 hover:opacity-95"
                  : "border border-white/15 bg-white/5 hover:bg-white/10"
              )}
            >
              {tier.cta.label}
            </a>

            <ul className="mt-6 space-y-3">
              {tier.features.map((f) => (
                <li key={f} className="flex gap-3 text-sm text-white/80">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {tier.finePrint && tier.finePrint.length > 0 && (
              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-white/60">
                {tier.finePrint.map((fp) => (
                  <p key={fp}>&bull; {fp}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "1) Pick for free",
      desc: "Build brackets in any league. Core gameplay and scoring are the same for everyone.",
    },
    {
      title: "2) Open a matchup card",
      desc: "See sourced stats, injury/availability notes (when provided), and a last-updated timestamp.",
    },
    {
      title: "3) Explore in Bracket Lab",
      desc: "Run simulations and compare strategies like Chalk vs Chaos. No promises\u2014just models and transparency.",
    },
    {
      title: "4) Follow the chaos",
      desc: "Brackets Busted feed highlights league-wide swings and major eliminations in real time.",
    },
  ];

  return (
    <section className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
      <h2 className="text-2xl font-semibold">How it works</h2>
      <p className="mt-1 text-white/70">
        Bracket Lab is designed to be honest and transparent: data + timestamps,
        plus simulations you can inspect.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <div
            key={s.title}
            className="rounded-2xl border border-white/10 bg-slate-950/30 p-5"
          >
            <div className="text-sm font-semibold">{s.title}</div>
            <div className="mt-1 text-sm text-white/70">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="mt-14">
      <h2 className="text-2xl font-semibold">FAQ</h2>
      <p className="mt-1 text-white/70">
        Clear answers and clear boundaries.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {FAQ.map((item) => (
          <div
            key={item.q}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="text-sm font-semibold">{item.q}</div>
            <div className="mt-2 text-sm text-white/70">{item.a}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-xs text-white/60">
        <p className="font-semibold text-white/70">Transparency note</p>
        <p className="mt-2">
          Bracket Lab outputs are derived from available sources and models and
          can be wrong. We show &ldquo;Data last updated&rdquo; and citations so you can
          verify inputs. We do not guarantee outcomes.
        </p>
      </div>
    </section>
  );
}

function FooterCTA() {
  return (
    <section className="mt-14 rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-semibold">
            Keep brackets free. Fund performance.
          </h3>
          <p className="mt-1 text-white/70">
            Donate to support servers, data costs, and new features &mdash; or unlock
            Bracket Lab for simulations and strategy exploration.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a
            href="/donate"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-semibold hover:bg-white/10"
          >
            Donate
          </a>
          <a
            href="/donate?mode=lab"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-3 font-semibold text-slate-950 hover:opacity-95"
          >
            Get Bracket Lab
          </a>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/55">
        We do not collect entry fees or pay prizes. If your league uses dues or
        payouts elsewhere, that happens outside this platform.
      </p>
    </section>
  );
}
