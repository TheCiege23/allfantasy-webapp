"use client";

import { useCallback, useMemo } from "react";

function getOrCreateSessionId() {
  try {
    const key = "af_session_id";
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const id = crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

async function post(event: string, payload: any) {
  try {
    await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload }),
      keepalive: true,
    });
  } catch {
  }
}

async function postUsageLog(toolKey: string, meta?: Record<string, any>) {
  try {
    await fetch("/api/admin/usage/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: toolKey,
        leagueId: meta?.league_id ?? meta?.leagueId ?? undefined,
        meta: meta ?? null
      }),
      keepalive: true,
    });
  } catch {
  }
}

export function useAnalytics() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const trackPageView = useCallback(
    (path: string) => post("page_view", { sessionId, path, referrer: document.referrer || null }),
    [sessionId]
  );

  const trackToolUse = useCallback(
    (toolKey: string, meta?: Record<string, any>) => {
      post("tool_use", { sessionId, toolKey, path: location.pathname, meta: meta || null })
      postUsageLog(toolKey, meta)
    },
    [sessionId]
  );

  return { sessionId, trackPageView, trackToolUse };
}
