"use client";

import React from "react";

type GrokAI = {
  confidence?: "high" | "medium" | "low";
  narrative?: string[];
  tags?: string[];
  messageTemplate?: string;
  evidenceLinks?: Array<{ label: string; url: string }>;
};

export type WaiverSuggestionLike = {
  player_name?: string;
  tier?: string;
  priority?: number;
  reasoning?: string;
  team?: string;
  pos?: string;
  player_id?: string;
  ai?: GrokAI;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function confidencePill(c?: GrokAI["confidence"]) {
  if (!c) return null;
  const label = c === "high" ? "High confidence" : c === "medium" ? "Medium confidence" : "Learning";
  return (
    <span
      className={cx(
        "px-2 py-0.5 text-[11px] rounded-full border",
        c === "high" && "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        c === "medium" && "border-amber-400/25 bg-amber-500/10 text-amber-200",
        c === "low" && "border-sky-400/25 bg-sky-500/10 text-sky-200"
      )}
      title="AI confidence applies to narrative only (deterministic engine still ranks suggestions)."
    >
      {label}
    </span>
  );
}

export default function WaiverSuggestionCard({
  suggestion,
  onCopyMessage,
  onClick,
}: {
  suggestion: WaiverSuggestionLike;
  onCopyMessage?: (text: string) => void;
  onClick?: () => void;
}) {
  const name = suggestion.player_name ?? "Unknown Player";
  const tier = suggestion.tier ?? "Suggestion";
  const priority = typeof suggestion.priority === "number" ? suggestion.priority : undefined;

  const ai = suggestion.ai;
  const bullets = ai?.narrative?.filter(Boolean)?.slice(0, 4) ?? [];
  const tags = ai?.tags?.filter(Boolean)?.slice(0, 6) ?? [];

  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition p-4",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 relative">
          {suggestion.player_id ? (
            <img
              src={`https://sleepercdn.com/content/nfl/players/thumb/${suggestion.player_id}.jpg`}
              alt={name}
              className="w-12 h-12 rounded-xl object-cover bg-white/10 border border-white/10"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex') }}
            />
          ) : null}
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center text-lg font-bold text-white/60 ${suggestion.player_id ? 'hidden' : ''}`}>
            {name.charAt(0)}
          </div>
          {suggestion.team && (
            <img
              src={`https://a.espncdn.com/i/teamlogos/nfl/500/${suggestion.team}.png`}
              alt={suggestion.team}
              className="absolute -bottom-1 -right-1 w-5 h-5 object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white/90 truncate">{name}</h3>
                {suggestion.pos ? (
                  <span className="text-[11px] text-white/60 rounded-full border border-white/10 px-2 py-0.5">
                    {suggestion.pos}
                  </span>
                ) : null}
                {suggestion.team ? (
                  <span className="text-[11px] text-white/60 rounded-full border border-white/10 px-2 py-0.5">
                    {suggestion.team}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/70">{tier}</span>
                {typeof priority === "number" ? (
                  <span className="text-[11px] text-white/60 rounded-full border border-white/10 px-2 py-0.5">
                    Priority #{priority}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {confidencePill(ai?.confidence)}
            </div>
          </div>
        </div>
      </div>

      {suggestion.reasoning ? (
        <p className="mt-3 text-xs leading-relaxed text-white/70 whitespace-pre-wrap">
          {suggestion.reasoning}
        </p>
      ) : null}

      {bullets.length > 0 || tags.length > 0 || ai?.messageTemplate ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-white/50">
              AI Notes (Grok)
            </div>

            {ai?.messageTemplate ? (
              <button
                type="button"
                onClick={() => {
                  if (!ai.messageTemplate) return;
                  if (onCopyMessage) onCopyMessage(ai.messageTemplate);
                  else navigator.clipboard?.writeText?.(ai.messageTemplate);
                }}
                className="text-[11px] px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 transition"
                title="Copy a suggested message (optional) — does not change rankings."
              >
                Copy message
              </button>
            ) : null}
          </div>

          {tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-purple-400/20 bg-purple-500/10 text-purple-200"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {bullets.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {bullets.map((b, i) => (
                <li key={i} className="text-xs text-white/70 leading-relaxed">
                  <span className="text-white/50 mr-2">•</span>
                  {b}
                </li>
              ))}
            </ul>
          ) : null}

          {ai?.evidenceLinks?.length ? (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wide text-white/50">
                Sources
              </div>
              <div className="mt-1 space-y-1">
                {ai.evidenceLinks.slice(0, 3).map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-sky-200/80 hover:text-sky-200 underline underline-offset-2"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
