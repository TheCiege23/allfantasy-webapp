import { withApiUsage } from "@/lib/telemetry/usage"
import { NextRequest, NextResponse } from "next/server";
import {
  WaiverRequestSchema,
  WaiverResponseSchema,
  WAIVER_AI_SYSTEM_PROMPT,
  buildWaiverUserPrompt,
} from "@/lib/waiver-ai-prompt";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { openaiChatJson, parseJsonContentFromChatCompletion } from "@/lib/openai-client";
import { trackLegacyToolUsage } from "@/lib/analytics-server";
import { enrichRawWaiverSuggestionsWithGrok } from "@/lib/waiver-engine/waiver-grok-adapter";

type AnyObj = Record<string, any>;

function safeBool(v: any): boolean {
  return !!v;
}

function safeStr(v: any): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function extractLeagueMeta(body: AnyObj) {
  const league = body?.league ?? body?.context?.league ?? body?.settings?.league ?? {};
  const leagueName =
    safeStr(league?.name) ||
    safeStr(body?.league_name) ||
    safeStr(body?.leagueName) ||
    safeStr(body?.league?.name) ||
    undefined;

  const format =
    safeStr(league?.format) ||
    safeStr(body?.format) ||
    safeStr(body?.league_format) ||
    safeStr(body?.leagueFormat) ||
    undefined;

  const superflex =
    safeBool(league?.superflex) ||
    safeBool(body?.superflex) ||
    safeBool(body?.is_superflex) ||
    safeBool(body?.isSuperflex);

  const tep =
    safeBool(league?.tep) ||
    safeBool(body?.tep) ||
    safeBool(body?.is_tep) ||
    safeBool(body?.isTEP);

  const idp =
    safeBool(league?.idp) ||
    safeBool(body?.idp) ||
    safeBool(body?.is_idp) ||
    safeBool(body?.isIDP);

  return { leagueName, format, superflex, tep, idp };
}

function buildTeamContextNotes(body: AnyObj): string[] {
  const notes: string[] = [];

  const prefs = body?.preferences ?? body?.prefs ?? {};

  const intent = safeStr(prefs?.intent) || safeStr(body?.intent);
  if (intent) notes.push(`Team intent: ${intent}.`);

  const style = safeStr(prefs?.style) || safeStr(body?.style);
  if (style) notes.push(`Preference: ${style}.`);

  if (!notes.length) {
    notes.push("Prioritize weekly floor and depth where the roster is thin.");
    notes.push("Avoid short-term rentals unless the team is clearly contending.");
  }

  return notes.slice(0, 4);
}

export const POST = withApiUsage({ endpoint: "/api/waiver-ai", tool: "WaiverAi" })(async (request: NextRequest) => {
  const ip = getClientIp(request) || "unknown";

  let remaining = 0;
  let retryAfterSec = 0;

  try {
    const rl = consumeRateLimit({
      scope: 'ai',
      action: 'waiver',
      sleeperUsername: 'anonymous',
      ip,
      maxRequests: 10,
      windowMs: 60_000,
      includeIpInKey: true,
    });
    remaining = rl?.remaining ?? 0;
    retryAfterSec = rl?.retryAfterSec ?? 0;

    if (!rl.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          retryAfterSec: rl.retryAfterSec,
          remaining: rl.remaining,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }
  } catch {
    // fail-open
  }

  let rawBody: AnyObj;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsedReq = WaiverRequestSchema.safeParse(rawBody);
  if (!parsedReq.success) {
    return NextResponse.json(
      { success: false, error: "Request validation failed.", issues: parsedReq.error.issues },
      { status: 400 }
    );
  }

  const body = parsedReq.data;
  const bodyAny = body as AnyObj;

  trackLegacyToolUsage('waiver_ai', null, null, {
    sleeperUsername: safeStr(bodyAny?.sleeper_username),
    leagueId: safeStr(bodyAny?.league_id) || safeStr(bodyAny?.league?.league_id),
  });

  try {
    const userPrompt = buildWaiverUserPrompt(body);

    const completion = await openaiChatJson({
      messages: [
        { role: 'system', content: WAIVER_AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 1400,
    });

    if (!completion.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Waiver AI OpenAI call failed.",
          validated: false,
          rate_limit: { remaining, retryAfterSec },
        },
        { status: 500 }
      );
    }

    const responseData = parseJsonContentFromChatCompletion(completion.json);

    const parsedRes = WaiverResponseSchema.safeParse(responseData);
    if (!parsedRes.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Waiver AI response validation failed.",
          validated: false,
          issues: parsedRes.error.issues,
          rate_limit: { remaining, retryAfterSec },
        },
        { status: 500 }
      );
    }

    const validatedData = parsedRes.data as AnyObj;

    let grokDebug: any = undefined;

    const { leagueName, format, superflex, tep, idp } = extractLeagueMeta(bodyAny);
    const teamContextNotes = buildTeamContextNotes(bodyAny);

    if (validatedData.top_adds && Array.isArray(validatedData.top_adds)) {
      try {
        const enriched = await enrichRawWaiverSuggestionsWithGrok(validatedData.top_adds, {
          enabled: process.env.GROK_ENRICH_WAIVERS_ENABLED !== "false",
          leagueMeta: { leagueName, format, superflex, tep, idp },
          teamContextNotes,
          maxSuggestions: 10,
          concurrency: 3,
        });

        validatedData.top_adds = enriched.suggestions;
        grokDebug = enriched.grok;
      } catch (e) {
        console.error('Grok waiver enrichment failed:', e);
      }
    }

    return NextResponse.json({
      success: true,
      data: validatedData,
      validated: true,
      rate_limit: { remaining, retryAfterSec },
      grok: grokDebug,
    });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Waiver AI request failed.",
        message: msg,
        validated: false,
        rate_limit: { remaining, retryAfterSec },
      },
      { status: 500 }
    );
  }
})
