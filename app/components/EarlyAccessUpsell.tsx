"use client";

import { useState } from "react";

type UpsellVariant = "default" | "after_feedback" | "power_user";

interface EarlyAccessUpsellProps {
  variant?: UpsellVariant;
  onClose?: () => void;
}

const CONTENT = {
  default: {
    title: "Help shape the AI before launch",
    body: "AF Legacy is a live preview of the AI powering the AllFantasy app launching in 2026. Early access members help guide how the AI learns by using the tools, sharing feedback, and stress-testing real league scenarios.",
  },
  after_feedback: {
    title: "Thanks — this helps the AI learn",
    body: "Feedback like yours directly influences how the AllFantasy AI improves before launch. Want to be part of that process as new features roll out?",
  },
  power_user: {
    title: "You're already using the AI like an early tester",
    body: "Early access members get visibility into what's coming next and help shape the tools before the full app launch.",
  },
};

export default function EarlyAccessUpsell({
  variant = "default",
  onClose,
}: EarlyAccessUpsellProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const content = CONTENT[variant];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email,
          utm_source: "af_legacy",
          utm_medium: "inline_upsell",
          utm_campaign: variant,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <div className="text-3xl mb-3">🎉</div>
        <h3 className="text-lg font-semibold text-white mb-2">You're in!</h3>
        <p className="text-sm text-white/60">
          You'll be among the first to shape the AllFantasy AI. We'll be in touch soon.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 text-sm text-white/40 hover:text-white/60 transition"
          >
            Continue exploring
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-2">{content.title}</h3>
      <p className="text-sm text-white/60 mb-5 leading-relaxed">{content.body}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-cyan-500/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {loading ? "Joining..." : "Join Early Access"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        <p className="text-xs text-white/40">
          Free · No commitment · Built with players
        </p>
      </form>
    </div>
  );
}
