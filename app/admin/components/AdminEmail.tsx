"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, Send, Eye, Code, CheckCircle2, TriangleAlert, Clock, FlaskConical, History } from "lucide-react";

type BroadcastResponse =
  | {
      ok: true;
      dryRun?: boolean;
      recipients?: number;
      sample?: string[];
      sent?: number;
      failed?: number;
      errors?: Array<{ email: string; error: string }>;
    }
  | { ok?: false; error?: string };

function toHtmlFromText(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("<") && trimmed.includes(">")) return trimmed;

  const escaped = trimmed
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const parts = escaped.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
  const html = parts.map((p) => `<p style="margin:0 0 12px 0;line-height:1.5;">${p.replaceAll("\n", "<br/>")}</p>`).join("");

  return `
<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#111; font-size:16px;">
  ${html}
  <p style="margin-top:18px;color:#444;">— The AllFantasy.ai Team</p>
</div>
`.trim();
}

function TemplateButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
      type="button"
    >
      {label}
    </button>
  );
}

export default function AdminEmail() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [from, setFrom] = useState("");
  const [limit, setLimit] = useState<number>(0);
  const [dryRun, setDryRun] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [status, setStatus] = useState<
    | { type: "success" | "error" | "info"; message: string }
    | null
  >(null);

  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  const [result, setResult] = useState<BroadcastResponse | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  const html = useMemo(() => toHtmlFromText(body), [body]);

  const recipientCount = limit > 0 ? Math.min(limit, subscriberCount) : subscriberCount;

  async function loadCount() {
    setLoadingCount(true);
    try {
      const res = await fetch("/api/admin/signups/count", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSubscriberCount(Number(data.count || 0));
      }
    } catch {
    } finally {
      setLoadingCount(false);
    }
  }

  useEffect(() => {
    loadCount();
  }, []);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending && !testSending;

  async function sendBroadcast() {
    if (!subject.trim() || !body.trim()) {
      setStatus({ type: "error", message: "Subject and message are required." });
      return;
    }

    setSending(true);
    setStatus(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          html,
          dryRun,
          limit: limit > 0 ? limit : undefined,
          from: from.trim() ? from.trim() : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as BroadcastResponse | null;

      if (!res.ok) {
        setStatus({ type: "error", message: (data as any)?.error || "Failed to send broadcast." });
        setResult(data || { ok: false, error: "Failed to send broadcast." });
        return;
      }

      setResult(data || { ok: true });

      if ((data as any)?.dryRun) {
        setStatus({
          type: "info",
          message: `Dry run complete. Ready to send to ${(data as any)?.recipients ?? 0} recipients.`,
        });
      } else {
        setStatus({
          type: "success",
          message: `Broadcast sent. ${(data as any)?.sent ?? 0} sent, ${(data as any)?.failed ?? 0} failed.`,
        });
        setSubject("");
        setBody("");
      }

      loadCount();
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message || "Unknown error" });
    } finally {
      setSending(false);
    }
  }

  function handleSendClick() {
    if (!dryRun && recipientCount > 50) {
      setShowConfirm(true);
      return;
    }
    sendBroadcast();
  }

  function confirmSend() {
    setShowConfirm(false);
    sendBroadcast();
  }

  async function sendTestEmail() {
    if (!subject.trim() || !body.trim()) {
      setStatus({ type: "error", message: "Subject and message are required." });
      return;
    }

    setTestSending(true);
    setStatus(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `[TEST] ${subject.trim()}`,
          html,
          dryRun: false,
          limit: 1,
          from: from.trim() ? from.trim() : undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as BroadcastResponse | null;

      if (!res.ok) {
        setStatus({ type: "error", message: (data as any)?.error || "Failed to send test email." });
        return;
      }

      setStatus({
        type: "success",
        message: `Test email sent to admin. Check your inbox.`,
      });
    } catch (e: any) {
      setStatus({ type: "error", message: e?.message || "Unknown error" });
    } finally {
      setTestSending(false);
    }
  }

  function applyTemplate(template: "Welcome" | "Launch Update" | "Survey Request" | "Feature Tease") {
    if (template === "Welcome") {
      setSubject("Welcome to AllFantasy.ai Early Access ✅");
      setBody(
        `Hi there,

You're on the early access list for AllFantasy.ai.

We're building the next-gen fantasy sports experience: legacy imports, AI insights, custom league formats, and a clean mobile-first dashboard.

Stay tuned — you'll be the first to get access when we open the gates.

Thanks,
The AllFantasy.ai Team`
      );
    }

    if (template === "Launch Update") {
      setSubject("AllFantasy.ai Progress Update 🚀");
      setBody(
        `Hi there,

Quick update: our Legacy Import + AI Grade system is now stable and working end-to-end.

Next up:
- confirmation emails + onboarding flow
- more league formats
- admin analytics dashboard

We'll notify you the moment early access opens.

— The AllFantasy.ai Team`
      );
    }

    if (template === "Survey Request") {
      setSubject("Help shape AllFantasy.ai (2-minute survey)");
      setBody(
        `Hi there,

We're building AllFantasy.ai around what fantasy players actually want.

If you have 2 minutes, reply with:
1) Your favorite sport (NFL/NBA/MLB)
2) Your favorite league type (redraft/dynasty/bestball/etc)
3) The #1 pain point you want solved

Thank you — your answers directly guide what we build next.

— The AllFantasy.ai Team`
      );
    }

    if (template === "Feature Tease") {
      setSubject("Sneak peek: Legacy Grade + Share Card 🔥");
      setBody(
        `Hi there,

We just launched something fun internally:
- Legacy Grade (0–100)
- archetype labels
- strengths/weaknesses
- shareable "Grok-style" recap posts

When early access opens, you'll be able to import your history and generate your own.

— The AllFantasy.ai Team`
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-2xl font-semibold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Broadcast
          </div>
          <div className="text-sm text-white/60">
            Send updates to your early access list (Resend)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCount}
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-60"
            disabled={loadingCount}
            type="button"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingCount ? "animate-spin" : ""}`} />
            Refresh count
          </button>

          <button
            onClick={() => setShowPreview((v) => !v)}
            className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
          >
            {showPreview ? <Code className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Subscribers</div>
          <div className="mt-1 text-2xl font-semibold">
            {subscriberCount.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-white/40">
            (Loaded from /api/admin/signups)
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/50">Mode</div>
              <div className="mt-1 text-sm text-white/80">
                {dryRun ? "Dry Run (no send)" : "Live Send"}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-white"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              Dry Run
            </label>
          </div>

          <div className="mt-3 text-xs text-white/50">
            Dry run returns recipient count + sample emails.
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs text-white/50">Optional Limits</div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-white/50 mb-1">From (optional)</div>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="updates@allfantasy.ai"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
            </div>

            <div>
              <div className="text-[11px] text-white/50 mb-1">Limit (0 = all)</div>
              <input
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value || 0))}
                type="number"
                min={0}
                max={5000}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-2 text-xs text-white/50">
            Useful for test sends before going wide.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
        <div className="text-sm font-semibold">Subject</div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. AllFantasy.ai Early Access Update"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Message</div>
            <div className="text-xs text-white/50">
              Paste plain text or HTML. Plain text is auto-converted to HTML.
            </div>
          </div>
          <div className="text-xs text-white/40 tabular-nums">
            {body.length.toLocaleString()} chars
          </div>
        </div>

        {!showPreview ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            className="mt-3 h-64 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
          />
        ) : (
          <div className="mt-3 rounded-xl border border-white/10 bg-white p-4 text-black">
            <div className="text-xs text-black/50 mb-2">Preview</div>
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )}
      </div>

      {status && (
        <div
          className={[
            "rounded-2xl border p-4 text-sm",
            status.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : status.type === "info"
              ? "border-white/10 bg-white/5 text-white/80"
              : "border-red-500/20 bg-red-500/10 text-red-200",
          ].join(" ")}
        >
          <div className="flex items-start gap-2">
            {status.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
            ) : status.type === "error" ? (
              <TriangleAlert className="h-5 w-5 mt-0.5" />
            ) : (
              <Mail className="h-5 w-5 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="font-medium">{status.message}</div>

              {result && (result as any).ok && (
                <div className="mt-2 text-xs text-white/60 space-y-1">
                  {"recipients" in (result as any) && (
                    <div>Recipients: {(result as any).recipients ?? 0}</div>
                  )}
                  {"sent" in (result as any) && (
                    <div>Sent: {(result as any).sent ?? 0}</div>
                  )}
                  {"failed" in (result as any) && (
                    <div>Failed: {(result as any).failed ?? 0}</div>
                  )}
                  {(result as any).dryRun && (result as any).sample?.length ? (
                    <div className="mt-2">
                      <div className="text-white/70">Sample recipients:</div>
                      <ul className="mt-1 list-disc pl-5">
                        {(result as any).sample.slice(0, 5).map((e: string) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(result as any).errors?.length ? (
                    <div className="mt-2">
                      <div className="text-white/70">Top errors:</div>
                      <ul className="mt-1 list-disc pl-5">
                        {(result as any).errors.slice(0, 5).map((x: any) => (
                          <li key={x.email}>
                            {x.email}: {x.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <TriangleAlert className="h-5 w-5 mt-0.5 text-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-amber-200">
                You're about to send to {recipientCount.toLocaleString()} recipients. Are you sure?
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={confirmSend}
                  className="inline-flex items-center rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/30"
                  type="button"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Yes, send now
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-white/50">
          You are about to {dryRun ? "simulate" : "send"} to{" "}
          <span className="text-white/80 font-medium">
            {recipientCount.toLocaleString()}
          </span>{" "}
          recipients.
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={sendTestEmail}
            disabled={!canSend}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
            type="button"
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            {testSending ? "Sending test…" : "Test Send"}
          </button>

          <button
            onClick={handleSendClick}
            disabled={!canSend}
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15 disabled:opacity-60"
            type="button"
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? (dryRun ? "Running dry run…" : "Sending…") : dryRun ? "Run dry run" : "Send broadcast"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold mb-3">Templates</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TemplateButton label="Welcome" onClick={() => applyTemplate("Welcome")} />
          <TemplateButton label="Launch Update" onClick={() => applyTemplate("Launch Update")} />
          <TemplateButton label="Survey Request" onClick={() => applyTemplate("Survey Request")} />
          <TemplateButton label="Feature Tease" onClick={() => applyTemplate("Feature Tease")} />
        </div>
        <div className="mt-3 text-xs text-white/40">
          Templates fill Subject + Message using plain text (auto-converted to HTML).
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="h-5 w-5 text-white/50" />
          <div className="text-sm font-semibold">Send History</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Subject</th>
                <th className="pb-2 pr-4 font-medium">Recipients</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 font-medium">Open Rate</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="pt-8 pb-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-white/20" />
                    <div className="text-sm text-white/40">Send history will appear here</div>
                    <div className="text-xs text-white/25">
                      Past broadcasts will be logged once a history endpoint is configured
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
