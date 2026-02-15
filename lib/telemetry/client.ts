export async function logLegacyToolUsage(args: {
  tool: string
  leagueId?: string
  action: string
  meta?: Record<string, any>
}) {
  try {
    await fetch("/api/admin/usage/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: args.tool,
        leagueId: args.leagueId ?? null,
        meta: { action: args.action, ...(args.meta ?? {}) }
      })
    })
  } catch {
  }
}
