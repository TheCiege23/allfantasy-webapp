# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform designed to be a comprehensive "AF Legacy" hub. It provides AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. The platform aims to lead the fantasy sports market by offering sophisticated AI analytical tools, robust league management, and integrated social sharing capabilities.

## User Preferences
I want to use the Replit AI Integrations for OpenAI.
The project uses `gpt-4o` for general AI tasks and `grok-4` for social post generation.
I prefer detailed explanations when AI analysis is provided.
I want the agent to use a 4-layer deterministic tier system for trade evaluations that the AI cannot override.
I want the AI to prioritize league integrity over "winning" trades - fair trades where both teams get better are ideal.
I want the AI to be honest and straightforward - never encourage exploiting other managers.
I believe trades are their own unique ecosystem that deserves respect - both teams should feel like they gave up value but got better.
I want the agent to consider redraft and dynasty leagues with specific evaluation methodologies for each.
I want the agent to implement a veto layer in dynasty trade evaluations to prevent unrealistic trades.
I want the agent to consider consolidation penalties and context adjustments (contender/rebuild) in trade analyses.

## System Architecture
The project is built with Next.js 14 (App Router) and TypeScript, utilizing Tailwind CSS for styling. Data persistence is handled by PostgreSQL with Prisma ORM, and Zod schemas ensure data validation. Authentication is managed by Auth.js (NextAuth v4) using a Credentials provider with bcryptjs for password-based authentication and JWT for session management.

**Authentication System:**
The system includes comprehensive user authentication features such as password-based signup, email verification, password login, and password reset functionalities. It also offers optional Sleeper account linking. Admin authentication is centralized and secured with HMAC-signed session cookies or Bearer tokens.

**Verification Gate System:**
User access to protected features is controlled by a three-tier gating system (API-level, Route-level, Canonical email verification) requiring age confirmation and email/phone verification. Phone verification is implemented using the Twilio Verify API. All verification processes are rate-limited.

**Dashboard (`/dashboard`):**
The post-login dashboard serves as an AI Overview, displaying user data, league information, bracket entries, a setup checklist, and recommended actions.

**UI/UX Decisions:**
The platform features a mobile-first design with a persistent Bottom Tab Bar, contextual AI Bottom Sheets, Universal AI Badges, and tabbed navigation. A universal theme system (Dark, Light, AF Legacy modes) is managed by `ThemeProvider`.

**Technical Implementations:**
The core architecture is built upon three pillars: One Scoring Core, One Narrative System, and One Monitoring System, all integrated via a universal `One Engine API`. Key features include:
-   **Universal Trade Engine**: A deterministic `runTradeAnalysis()` pipeline supporting various league scoring systems, team direction inference, and acceptance probability modeling.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator with deterministic tiers, pick aging, and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with percentile-normalized scores and a League Demand Index, including an Adaptive Rankings v2 Engine that learns from historical trades.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection.
-   **Dynasty Outlook AI (`/api/dynasty-outlook`)**: A dedicated dynasty analysis endpoint using the dynasty expert system prompt. Provides structured JSON output with `overallOutlook`, `topAssets` (with dynasty tiers), `biggestRisks` (with severity), `projectedRankNext3Years`, `contenderOrRebuilder` classification, and `keyRecommendation`. Uses RAG grounding with SportsPlayer cache for age/position context. Authorization-gated to league owners only. Integrated into Rankings page with animated UI panel.
-   **IDP & Kicker Valuation System**: Internal tier-based valuation integrated with league ranking auto-detection and the trade engine.
-   **Devy Player Classification & Intelligence Engine**: Comprehensive NCAA to NFL player classification and devy value modeling.
-   **Player Analytics Database**: Stores extensive NFL player analytics data for valuation and intelligence engines.
-   **Monte Carlo Simulation Engine**: Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model**: A logistic regression model to predict trade acceptance, with isotonic regression post-hoc calibration (PAVA algorithm) for real-outcome calibrated predictions. The `isotonic-calibrator.ts` fits a monotone piecewise-linear mapping from raw probabilities to observed acceptance rates using binned PAVA. The calibration map is stored in `TradeLearningStats.isotonicMapJson` and applied live in `accept-calibration.ts` via `calibrateAcceptProbability()`. Weekly recalibration (`auto-recalibration.ts`) recomputes the isotonic map alongside shadow b0 and segment b0s. The `calibration-metrics.ts` health dashboard includes isotonic status (active, sample size, ECE before/after).
-   **Game Theory Counter Builder**: Mathematically optimized counter offers.
-   **NCAA Bracket Challenge**: A full March Madness bracket system with league creation, ESPN-style UI, live polling, and shareable invite links.
-   **Trade Improvement AI (Dual-Brain)**: Utilizes Agentic Grok (multi-turn tool loop with web_search via Serper + x_keyword_search via xAI) and GPT-4o for parallel synthesis, featuring a real-time thinking UI and a feedback system that personalizes future suggestions.
-   **2-Stage Trade Analysis Pipeline (v2 — Deterministic First)**: Stage A (Deterministic Intelligence Layer) assembles a canonical `TradeDecisionContextV1` object (Zod-validated, `trade-decision-context.ts`) from league settings, roster composition/needs, trade history (recency-weighted), manager preference vectors/tendencies, asset valuations (with source + timestamp), player risk markers (age curve buckets, injury recency with reinjury risk classification), competitor team snapshots, missing-data flags, and data staleness SLAs (valuation 3d, ADP 7d from `playerAnalyticsSnapshot.updatedAt`, injury 7d, analytics coverage-based, trade history 7d). The **Deterministic Intelligence Module** (`deterministic-intelligence.ts`) then computes: (a) deterministic confidence baseline from data coverage, delta clarity, staleness penalties, and missing data; (b) fact-grounded reasons from value comparisons, top asset contributors, roster needs alignment, contender/rebuilder timing, risk factors, and cornerstone assets; (c) structured warnings from data gaps, staleness, age cliffs, injuries, and insufficient history; (d) counter-proposal baselines from value gap analysis. Stage B (Peer Review Layer) uses `runPeerReviewAnalysis()` to send the identical fact layer to OpenAI and Grok as peer reviewers with the same prompt contract, schema, and temperature. LLMs **explain and supplement** — they do not invent the baseline. The quality gate starts from deterministic confidence and applies LLM agreement as a non-negative boost (max +10) or contradiction/disagreement as penalties (-5 to -8). Reasons, warnings, and counters are merged deterministic-first with deduplication, LLM content appended only when it adds non-overlapping narrative. Merge logic: if both providers agree on verdict class → boost confidence; if they disagree → return "Disagreement" verdict with capped confidence and a structured `DisagreementBlock` (`winnerMismatch`, `confidenceSpread`, `keyDifferences[]`, `reviewMode`); if one fails → degrade gracefully. When `reviewMode` is true (high disagreement: winner mismatch + confidence spread ≥20 or ≥3 key differences), the system replaces aggressive counters with 2 safer alternatives and adds an additional -3 confidence penalty. The `keyDifferences` array surfaces specific conflict dimensions (winner, confidence gap, focus areas, risk assessment, trade viability). Structured disagreement codes surface model conflicts vs data quality concerns separately in the UI. Pipeline version: `2-stage-v2-deterministic-first`.

**Unified LeagueDecisionContext (`league-context-assembler.ts`):**
All trade-related consumers (Trade Finder, Goal Proposals, Trade Evaluator) share a single canonical `LeagueDecisionContext` object assembled by `buildLeagueDecisionContext()`. This ensures identical valuations, roster analysis, manager tendencies, and data freshness across all tools. Pair-scoped `TradeDecisionContextV1` is derived from the league-wide context via `deriveTradeDecisionContext()`. The `leagueContextToIntelligence()` adapter converts to the existing `LeagueIntelligence` format for backward compatibility with the deterministic trade engine. Each context carries a `contextId` for audit/debugging. Team matching uses a priority chain: rosterId > player-asset overlap > display name > username.

**Source Freshness Scoring (`trade-decision-context.ts` — `computeSourceFreshness()`):**
Every context includes a `sourceFreshness` object that grades each data source (Sleeper Rosters, Player Valuations, Injury Reports, ADP Rankings, Player Analytics, Trade History) on a 5-tier scale: `fresh` / `aging` / `stale` / `expired` / `unavailable`. Each source has per-tier thresholds (e.g., valuations: fresh <24h, aging <3d, stale <7d, expired >7d; injuries: fresh <6h, aging <24h, stale <7d, expired >7d). Grades carry graduated confidence penalties (fresh=0, aging=-2, stale=-5, expired=-8, unavailable=-10). A weighted composite score (0-100) and composite grade summarize overall data quality. The deterministic intelligence module applies `totalConfidencePenalty` from freshness scoring instead of the old binary stale-count penalty, and freshness warnings (with human-readable age labels like "3h ago", "2d ago") replace static stale messages. All trade route responses include the full `sourceFreshness` object in their response metadata.

**Confidence Guard Gates (`quality-gate.ts`):**
Two hard guards run before returning any trade recommendation: (1) **Injury Compound Risk Guard** — when injury risk markers + stale/unreliable injury data + thin value delta (≤10%) all co-occur, confidence is hard-capped at 55%; injury risk + stale data alone caps at 65%. (2) **Missing Roster/Team Data Guard** — when roster data is expired/unavailable, competitor data is missing, both managers lack trade tendencies, or ≥3 asset valuations are missing, the recommendation is forced to "Conditional" status. Conditional recommendations surface a `recommendationType` object in the API response with `isConditional`, `reasons[]`, and `label`, and inject a `[Conditional]` warning + modified action plan assessment that tells the user to verify missing data before acting.

**3-Section Trade Response (`trade-response-formatter.ts`):**
The API response is structured into 3 user-facing sections: (1) **Value Verdict** — fairness grade (A+ to F), edge label, value delta, deterministic confidence + adjusted confidence, veto risk, deterministic-first reasons (fact-grounded + LLM narrative), data freshness, and `recommendationType` (Standard vs Conditional with reasons); (2) **Viability Verdict** — acceptance likelihood, partner fit score (roster needs/surplus alignment), timing fit (contender/rebuild window alignment), league activity, acceptance signals, plus three enriched viability dimensions: **Rankings Impact** (league power rank trend with contender/rebuilder direction weighting, projected tier shifts using competitor starterStrengthIndex benchmarks), **Injury-Adjusted Replacement Value** (per-asset injury discounts using status severity + reinjury risk multipliers, net injury exposure shift between sides), and **Starter vs Bench Impact Delta** (starter-likelihood-weighted value split using position scarcity and market percentile, net starter delta label); all three feed into a `computeViabilityBonus()` that adjusts the acceptance score; (3) **Action Plan** — best offer assessment (send-as-is vs needs adjustment, or conditional caveat when data is missing), deterministic counter baselines + AI-suggested counters, and a suggested message text for the trade partner. All core verdicts (grade, edge, acceptance, fit, timing, rankings, injury, starter) are computed deterministically; LLMs provide narrative color and supplemental suggestions only.

**League Sync System:**
A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage and a shared sync core.

## External Dependencies
-   **OpenAI**: General AI analysis.
-   **Grok**: Social media post generation.
-   **PostgreSQL**: Primary database.
-   **Sleeper API**: Importing user league data.
-   **Rolling Insights Sports API**: Primary NFL sports data.
-   **API-Sports.io**: Secondary NFL data, primary for injuries.
-   **TheSportsDB API**: Tertiary sports data fallback.
-   **ESPN API**: Quaternary sports data fallback, primary for live scores and news.
-   **CollegeFootballData.com API (CFBD)**: College Football data.
-   **Resend**: Email notifications.
-   **OpenWeatherMap API**: Game-day weather data.
-   **NewsAPI.org**: Secondary news source.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.
-   **Etsy Shop Integration**: Displays AllFantasy merchandise.