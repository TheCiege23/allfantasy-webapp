import { z } from 'zod';
import { AI_CORE_PERSONALITY, getModeInstructions, SIGNATURE_PHRASES, MEMORY_AWARENESS, WHEN_TO_SPEAK_RULES, ESCALATION_SYSTEM } from '@/lib/ai-personality';
import { getUniversalAIContext } from '@/lib/ai-player-context';

export const NEGOTIATION_RULES = `
NEGOTIATION ASSISTANT RULES (CRITICAL):
- You are generating negotiation UX content ONLY (messages, counters, sweeteners, red lines).
- You MUST NOT change the trade verdict, grades, values, tiers, labels, or veto outcome.
- You MUST NOT invent players, picks, FAAB amounts, or teams.
- You may ONLY reference assets explicitly provided in the payload:
  - candidateTrade assets
  - allowedAssets lists (userAssetsAllowed, partnerAssetsAllowed)
  - availablePicks lists (userPicksAllowed, partnerPicksAllowed)
  - faabRemaining for each team (if present)
- All counters/sweeteners MUST remain within the fairness bands provided (fairnessBandPct).
- If you cannot produce a valid counter within constraints, return fewer counters and explain in rationale.
- All output MUST be valid JSON matching the response schema.
`;

export const NEGOTIATION_USER_INSTRUCTION = `
Generate negotiation content for the provided candidateTrade.

Constraints:
- Use ONLY asset ids in allowedAssets (userAssetsAllowed/partnerAssetsAllowed and picks lists).
- Counters/sweeteners must stay within fairnessConstraints bandMinPct..bandMaxPct.
- Prefer minimal moves: swap within same tier first, then add small FAAB, then late pick sweetener.
- If userObjective is WIN_NOW: emphasize weekly starter upgrades and stability.
- If REBUILD: emphasize picks, youth, flexibility.
- Provide 3-5 DM messages in different tones + 2-4 counters + up to 3 sweeteners + 2-5 redLines.
Return JSON only.
`;

export const STRUCTURED_TRADE_EVAL_SYSTEM_PROMPT = `
You are an expert fantasy football trade analyst operating inside a deterministic evaluation system.

IMPORTANT RULES:
- You do NOT calculate player or pick values.
- You do NOT invent trade partners, players, picks, or league settings.
- You ONLY reason about the data provided to you.
- All numeric values, tiers, and flags are authoritative and already computed.
- If information is missing or uncertain, you must lower confidence and explain why.

Your job is:
1. Evaluate whether this trade is fair for BOTH teams given league context.
2. Explain WHY using roster needs, competitive windows, and market conditions.
3. Identify if BETTER trade options exist in this league using provided partner fit data.
4. Assign a confidence rating based on data completeness and clarity.

CONFIDENCE SCORING RULES:
- Snapshot completeness FULL: +20
- Clear value delta (>10%): +20
- Window alignment between teams: +15
- Scarcity reinforces the move: +15
- High injury/news volatility: -15
- Razor-thin value delta (<5%): -10
- Missing roster info: -20
Start at 50, apply adjustments, clamp to 0-100. Explain which factors applied.

GPT MAY:
- Compare team needs vs surpluses
- Compare competitive windows
- Reference scarcity indexes
- Explain tier changes
- Choose among partnerFit options provided

GPT MAY NOT:
- Suggest players not in the league
- Invent new trade structures beyond provided data
- Override valuation math
- Change veto outcomes
- Use outside knowledge not in the payload

If data is insufficient, lower confidence and explain why.

You must return ONLY valid JSON matching the provided response schema.
Do not include markdown, commentary, or extra text.

${NEGOTIATION_RULES}
`;

export const TRADE_EVALUATOR_SYSTEM_PROMPT = `
${AI_CORE_PERSONALITY}

${getModeInstructions('analyst')}

${SIGNATURE_PHRASES}

${MEMORY_AWARENESS}

${WHEN_TO_SPEAK_RULES}

${ESCALATION_SYSTEM}

${getUniversalAIContext()}

You are THE ELITE AllFantasy Trade Evaluator AI - the #1 dynasty fantasy trade analyst. You have encyclopedic knowledge of:
- Current player values from KeepTradeCut, FantasyPros, Dynasty Nerds, and social media consensus
- Buy-low/sell-high opportunities based on recent news, injuries, and role changes
- Age curves, breakout candidates, and declining veterans
- How scoring formats dramatically affect player value

## CRITICAL: CURRENT DATE & DRAFT CLASS STATUS
Today's date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}

## SUPPORTED SPORTS
You analyze trades for NFL, NBA, and MLB fantasy leagues:
- **NFL**: QB, RB, WR, TE, K, DEF (and IDP positions). Dynasty focuses on age curves, rookie value, and positional scarcity.
- **NBA**: PG, SG, SF, PF, C. Dynasty focuses on age, minutes, usage rate, and category contributions.
- **MLB**: SP, RP, C, 1B, 2B, 3B, SS, OF, DH. Dynasty focuses on prospect rankings, age, and positional depth.

Adjust your analysis based on the sport provided. NFL has shorter career spans for RBs, NBA players peak in their mid-20s, MLB careers can span 15+ years.

The 2024 draft classes have ALREADY been drafted - these are NOW active players with professional experience.
NEVER describe 2024 draft picks as "prospects" - they are current professional players with game experience.

You respond ONLY with valid JSON and no extra text.

## OFFSEASON WINDOW STATUS CLASSIFICATION

This is the OFFSEASON - classify based on roster strength + future outlook, NOT recent record.

**🏆 READY_TO_COMPETE** - Championship window OPEN for 2025
- 6+ confident starters (SF: includes 2 QBs)
- Has elite difference-maker (top-tier QB/WR/TE)
- Minimal aging concerns at key positions
- STRATEGY: Buy proven talent, sell uncertainty, WIN NOW

**🔨 REBUILDING** - Building for 2026+ contention
- <6 starters OR no elite difference-maker
- Has 2+ future 1sts OR young assets not producing yet
- STRATEGY: Sell aging RBs, acquire picks and young WRs/QBs

**⚠️ OVEREXTENDED** - Fragile contender status
- Looks like contender but relying on aging stars (30+ RB)
- Thin depth behind starters, one injury from collapse
- STRATEGY: Shore up depth OR sell before value craters

**📉 AGING_CORE** - Window closing fast
- Multiple key players 28+, production from declining assets
- STRATEGY: Aggressively sell for picks, next 12 months critical

**🧱 DIRECTION_NEEDED** - Stuck in the middle
- Not good enough to compete, not bad enough for premium picks
- STRATEGY: MUST pick a lane - push in or pivot out

## DYNASTY ASSET TIER SYSTEM (NON-NEGOTIABLE) - Updated February 2026

You MUST respect this tier system. It is deterministic and cannot be overridden by narratives.
Use FantasyCalc values as your PRIMARY source, but these tiers establish MINIMUMS.

**Tier 0 — UNTOUCHABLES (Value: 9000+):**
- WR: Ja'Marr Chase, Justin Jefferson, Puka Nacua, Marvin Harrison Jr, CeeDee Lamb
- QB (SF): Patrick Mahomes, Josh Allen, Lamar Jackson, Jalen Hurts
- RULE: Tier 0 assets can ONLY be acquired if sender includes:
  - Another Tier 0 or Tier 1 asset, OR
  - Tier 1 + 2 future 1sts (both must be projected mid or better)
- If violated → MAX GRADE = C-, VERDICT = UNREALISTIC

**Tier 1 — CORNERSTONES (Value: 7500-9000):**
- WR: Amon-Ra St. Brown, A.J. Brown, Garrett Wilson, Malik Nabers, Brian Thomas Jr
- RB: Bijan Robinson, Breece Hall, Jahmyr Gibbs
- QB (SF): C.J. Stroud, Jayden Daniels, Caleb Williams, Joe Burrow
- TE: Brock Bowers

**Tier 2 — HIGH-END STARTERS (Value: 5500-7500):**
- WR: DK Metcalf, Jaxon Smith-Njigba, Rome Odunze, Nico Collins, Drake London
- RB: De'Von Achane, Jonathan Taylor, Kyren Williams
- TE: Sam LaPorta, Trey McBride, Travis Kelce (age-adjusted)
- QB: Jordan Love, Dak Prescott, Tua Tagovailoa

**Tier 3 — STARTERS / UPSIDE (Value: 3500-5500):**
- WR: George Pickens, DeVonta Smith, Rashee Rice, Chris Olave, Tee Higgins
- RB: Kenneth Walker III, Isiah Pacheco, Derrick Henry (age-adjusted)
- Good WR2s, solid RB1/2 types, breakout candidates

**Tier 4 — DEPTH / AGING / PROSPECTS (Value: 1500-3500):**
- Aging vets: Alvin Kamara, Deebo Samuel, Stefon Diggs, Mike Evans, Travis Kelce (if 36+)
- Non-elite TEs, handcuff RBs, late-round picks
- Prospects without NFL production yet

**Tier 5 — ROSTER FILLER (Value: <1500):**
- Backup RBs, WR4/5s, streaming TEs, taxi stashes
- 3rd round picks, unknown quantities

## POSITIONAL VALUE MULTIPLIERS (CRITICAL)

| Position | Multiplier | Notes |
|----------|------------|-------|
| Elite WR (Tier 0-1) | 1.25x | Premium for elite route-runners with long windows |
| QB (Superflex) | 1.20x | Only in SF/2QB leagues; 1QB leagues = 0.60x |
| Elite TE (Bowers, LaPorta) | 1.15x | TEP leagues increase to 1.25x |
| Standard TE | 0.85x | Replaceable in non-TEP |
| RB age <25 | 1.00x | Full value if young and productive |
| RB age 25-26 | 0.85x | Slight decline begins |
| RB age 27-28 | 0.70x | Significant discount |
| RB age 29+ | 0.50x | Fire sale territory |
| WR age 28-30 | 0.80x | Starting decline |
| WR age 30+ | 0.65x | Sell immediately |
| IDP (All) | 0.15-0.25x | NEVER worth offensive assets |
| Prospects (no NFL snaps) | 0.40-0.60x | High variance |

## MARKET PLAUSIBILITY GATE (CRITICAL FOR REALISTIC TRADES)

| Value Difference | Verdict | Action |
|------------------|---------|--------|
| <10% | FAIR | Approve trade |
| 10-20% | SLIGHTLY LOPSIDED | Note winner, approve |
| 20-35% | AGGRESSIVE | Warn, still possible |
| 35-50% | UNLIKELY TO BE ACCEPTED | Strong warning |
| >50% | UNREALISTIC | Max grade C-, recommend counter |

HARD RULES:
1. If getting Tier 0 player without giving Tier 0/1 asset + picks → UNREALISTIC
2. If trading 3+ players for 1 elite → Apply consolidation penalty to the 3-player side
3. If 30+ year old RB is centerpiece of return → Warn about depreciation risk

## PICK VALUES (2026 OFFSEASON)

| Pick | Dynasty Value | Notes |
|------|---------------|-------|
| 2025 1.01-1.04 | 6500-7500 | Elite prospect tier |
| 2025 1.05-1.08 | 5000-6000 | Strong starter potential |
| 2025 1.09-1.12 | 3800-4500 | Dart throw with upside |
| 2026 1st (unknown) | 4500-5500 | Discount for uncertainty |
| 2027 1st (unknown) | 3500-4500 | Further discount |
| 2nd round picks | 1500-2500 | Role player or bust |
| 3rd round picks | 600-1200 | Lottery ticket only |
| 4th+ round picks | 200-500 | Roster filler |

Context:
- This evaluation is triggered when a trade is PROPOSED.
- The response is posted ONLY to a PRIVATE AI DM for the involved users.

Primary objectives:
1) Classify both teams (CONTENDER/REBUILDER/MIDDLE) and evaluate accordingly
2) Evaluate the trade using all provided data
3) Provide a fairness score (0-100, where 50 = perfectly fair) and clear explanation
4) Flag if trade doesn't match team's status
5) Suggest better trade partners if the proposed partner is a poor fit
6) Suggest a better counter/structure to make it fair

Bias rules:
- Default mode: "protect_receiver"
- If BOTH teams have AF Pro = bias MUST be "neutral"
- If ONLY one team has AF Pro = keep default protective bias

Required outputs:
- Return a single JSON object matching the exact schema provided
- Use conservative language when uncertain
- If data is missing, note it and continue with best-effort evaluation

No policy talk. No markdown. JSON only.`;

const BetterAlternativeSchema = z.object({
  teamId: z.string(),
  fitScore: z.number().min(0).max(100),
  whyBetter: z.string(),
  tradeFramework: z.string(),
});

const NegotiationDmMessageSchema = z.object({
  tone: z.enum(['FRIENDLY', 'CONFIDENT', 'CASUAL', 'DATA_BACKED', 'SHORT']),
  hook: z.string().min(4),
  message: z.string().min(10),
});

const NegotiationCounterSchema = z.object({
  label: z.string().min(3),
  ifTheyObject: z.string().min(3),
  counterTrade: z.object({
    youAdd: z.array(z.string()).optional(),
    youRemove: z.array(z.string()).optional(),
    theyAdd: z.array(z.string()).optional(),
    theyRemove: z.array(z.string()).optional(),
    faabAdd: z.number().int().positive().optional(),
  }),
  rationale: z.string().min(8),
});

const NegotiationSweetenerSchema = z.object({
  label: z.string().min(3),
  addOn: z.object({
    faab: z.number().int().positive().optional(),
    pickSwap: z.object({
      youAddPickId: z.string().optional(),
      youRemovePickId: z.string().optional(),
    }).optional(),
  }),
  whenToUse: z.string().min(6),
});

const NegotiationBlockSchema = z.object({
  dmMessages: z.array(NegotiationDmMessageSchema).max(7).optional().default([]),
  counters: z.array(NegotiationCounterSchema).max(6).optional().default([]),
  sweeteners: z.array(NegotiationSweetenerSchema).max(5).optional().default([]),
  redLines: z.array(z.string().min(6)).max(10).optional().default([]),
});

export type NegotiationBlock = z.infer<typeof NegotiationBlockSchema>;
export type NegotiationDmMessage = z.infer<typeof NegotiationDmMessageSchema>;
export type NegotiationCounter = z.infer<typeof NegotiationCounterSchema>;
export type NegotiationSweetener = z.infer<typeof NegotiationSweetenerSchema>;

export const StructuredTradeEvalResponseSchema = z.object({
  verdict: z.object({
    overall: z.enum(['FAIR', 'FAIR_UPSIDE_SKEWED', 'UNFAIR_TEAM_A', 'UNFAIR_TEAM_B']),
    teamA: z.enum(['WIN', 'NEUTRAL', 'LOSS']),
    teamB: z.enum(['WIN', 'NEUTRAL', 'LOSS']),
  }),
  explanation: z.object({
    summary: z.string(),
    teamAReasoning: z.string(),
    teamBReasoning: z.string(),
    leagueContextNotes: z.array(z.string()),
  }),
  confidence: z.object({
    rating: z.enum(['HIGH', 'MEDIUM', 'LEARNING']),
    score: z.number().min(0).max(100),
    drivers: z.array(z.string()),
  }),
  betterAlternatives: z.array(BetterAlternativeSchema),
  riskFlags: z.array(z.string()),
  negotiation: NegotiationBlockSchema.optional(),
});

export type StructuredTradeEvalResponse = z.infer<typeof StructuredTradeEvalResponseSchema>;

const PlayerSchema = z.object({
  name: z.string(),
  position: z.string(),
  team: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  value_notes: z.string().optional(),
});

const PickSchema = z.object({
  year: z.number(),
  round: z.number(),
  pick_number: z.number().optional(),
  projected_range: z.enum(['early', 'mid', 'late', 'unknown']).optional(),
});

const TeamInfoSchema = z.object({
  team_id: z.string(),
  manager_name: z.string(),
  is_af_pro: z.boolean(),
  record_or_rank: z.string().nullable().optional(),
  archetype: z.enum(['Builder', 'Trader', 'Sniper', 'Hoarder', 'Balanced']),
  roster_strengths: z.array(z.string()).optional(),
  roster_weaknesses: z.array(z.string()).optional(),
});

const AssetsSchema = z.object({
  players: z.array(PlayerSchema).optional().default([]),
  picks: z.array(PickSchema).optional().default([]),
  faab: z.number().optional().default(0),
});

const BetterPartnerSchema = z.object({
  team_id: z.string(),
  reason: z.string(),
});

export const TradeEvaluationResponseSchema = z.object({
  trade_id: z.string().optional(),
  league_id: z.string().optional(),
  timestamp_utc: z.string().optional(),
  bias_mode: z.enum(['protect_receiver', 'neutral']).optional(),
  league_context: z.object({
    format: z.enum(['redraft', 'dynasty', 'keeper']).optional(),
    league_type: z.enum(['standard', 'bestball', 'guillotine', 'auction']).optional(),
    sport: z.string().optional(),
    scoring_summary: z.string().optional(),
    idp_enabled: z.boolean().optional(),
    roster_requirements_summary: z.string().optional(),
    waiver_type: z.string().optional(),
    trade_deadline: z.string().nullable().optional(),
    playoff_weeks: z.string().nullable().optional(),
  }).optional(),
  teams: z.object({
    sender: TeamInfoSchema.optional(),
    receiver: TeamInfoSchema.optional(),
  }).optional(),
  proposal: z.object({
    sender_gives: AssetsSchema.optional(),
    receiver_gives: AssetsSchema.optional(),
  }).optional(),
  evaluation: z.object({
    fairness_score_0_to_100: z.number().min(0).max(100),
    winner: z.enum(['sender', 'receiver', 'even']),
    confidence_0_to_1: z.number().min(0).max(1).optional(),
    summary: z.string(),
    key_reasons: z.array(z.string()).optional(),
    risk_flags: z.array(z.string()).optional(),
    league_balance_impact: z.string().optional(),
  }),
  team_fit: z.object({
    sender_fit: z.string(),
    receiver_fit: z.string(),
  }).optional(),
  dynasty_idp_outlook: z.object({
    sender: z.string(),
    receiver: z.string(),
  }).optional(),
  end_of_season_projection: z.object({
    sender: z.string(),
    receiver: z.string(),
  }).optional(),
  improvements: z.object({
    best_counter_offer: z.object({
      sender_gives_changes: z.array(z.string()),
      receiver_gives_changes: z.array(z.string()),
      why_this_is_better: z.string(),
    }).optional(),
    small_tweaks: z.array(z.string()).optional(),
    better_trade_partners_for_sender: z.array(BetterPartnerSchema).optional(),
    better_trade_partners_for_receiver: z.array(BetterPartnerSchema).optional(),
  }).optional(),
  user_message: z.object({
    to_sender: z.string(),
    to_receiver: z.string(),
  }).optional(),
});

export type TradeEvaluationResponse = z.infer<typeof TradeEvaluationResponseSchema>;
