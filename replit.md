# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform designed to provide AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. Its main purpose is to offer a comprehensive "AF Legacy" hub for league management, sophisticated AI analytical tools, and integrated social sharing capabilities, aiming to be a leading solution in the fantasy sports market.

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
The project is built with Next.js 14 (App Router) and TypeScript, utilizing Tailwind CSS for styling. PostgreSQL with Prisma ORM handles database operations, and Zod schemas are used for validation. API security is managed via signed JWT-like tokens in HTTP-only cookies, with origin/referer validation for AI endpoints.

**UI/UX Decisions:**
The platform features a mobile-first design system including a persistent Bottom Tab Bar, contextual AI Bottom Sheets, and Universal AI Badges. It emphasizes clear calls to action and tabbed navigation. A universal theme system supports Dark, Light, and AF Legacy modes via CSS custom properties and is managed by `ThemeProvider`.

**Technical Implementations:**
The core architecture is built upon three pillars:
1.  **One Scoring Core**: All analytical features use four consistent scoring dimensions: Lineup Delta, Replacement/VORP, Market Value, and Manager Behavior.
2.  **One Narrative System**: AI-generated narratives must cite specific drivers and evidence, validated via `NarrativeValidationLog`.
3.  **One Monitoring System**: A Calibration Dashboard (`/admin?tab=calibration`) monitors for quality degradation and facilitates weekly auto-recalibration.

4.  **One Engine API**: Universal shared engine (`lib/engine/*`) providing standardized LeagueContext, PlayerState, Asset models, capability flags, and feature-flagged graceful degradation. All tools consume the same truth: scoring adjustments, positional scarcity, contender/rebuild classification, manager archetypes, and LDI-driven acceptance probability. Includes `runEngine()` universal entry point with DB snapshot caching (`EngineSnapshot` model), production-safe feature flags (`lib/engine/flags.ts`), context builder from Sleeper data, and Replit-safe iteration caps on Monte Carlo (prod: 2,000 max).

Key features include:
-   **Universal Trade Engine** (`lib/engine/trade.ts`): Deterministic `runTradeAnalysis()` pipeline with league scoring awareness (TEP/SF/PPCarry/PPR), devy realism (DraftProjectionScore, breakout age, recruiting, ADP, injury severity), contend/rebuild team direction inference, acceptance probability (sigmoid with fairness/needs/volatility/LDI/partner tendencies/devy signals), counter suggestions, and risk assessment. New API at `/api/engine/trade/analyze`. Legacy route enriched with `engineAnalysis` field.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator (with deterministic tiers, pick aging, and veto layer), Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Trade & League Management**: Trade Partner Matchmaking Engine, League Rankings, Trade Notifications, Deterministic Negotiation Toolkit, and Trade Ideas.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with 4 percentile-normalized scores, 6 view modes, intent-aware weights, and a League Demand Index.
-   **Adaptive Rankings v2 Engine**: Features data-driven weight learning from historical trades per league class, correlation-based weight derivation, and user-specific adaptive layers. Includes a weekly weight re-learning system.
-   **League Demand Index Heatmap**: V2 production heatmap consuming `computeLeagueRankingsV2` meta output, displaying position demand with evidence panels and CTAs.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) based on five core scores, with phase-based composite weights and an AI Coach Box. Includes a Motivational Framing System, Luck Meter, and Win Window projection. Dynasty composite includes FutureCapitalScore at 10% weight (in-season: 20% win + 30% power + 8% luck + 17% market + 15% manager + 10% future capital). Includes 5-year portfolio trajectory projection with position-specific age curves (RB peaks 23, WR peaks 24), devy graduation probability by projected round, and year1/year3/year5 volatility bands.
-   **Exploit My League (Trade Hub)**: Displays hot/cold demand, best leverage opportunities, and partner tendencies.
-   **Enhanced Rankings System**: League and user-specific rankings with multiple views, a Team Fit Score, League RankScore, User RankScore, and an AI-generated dynasty roadmap.
-   **Model Drift Dashboard**: Monitors model health using various event data, tracking calibration, drift, ranking quality, and narrative integrity.
-   **Data & Integrations**: Sports Data Router, Hybrid Valuation System, VORP Engine, and a Trade Engine Scoring Architecture.
-   **AI Confidence & Learning**: Three-tier AI Confidence System, Comprehensive Trade Learning System, AI Decision Guardian, Accept Probability Calibration, and Auto-Recalibration.
-   **Acceptance Probability Model**: Logistic regression model (`lib/acceptance-model.ts`) with 6 features (fairness, LDI alignment, needs fit, archetype match, deal shape, volatility delta), liquidity-adjusted probability, and customizable weights. Training data stored in `TradeOutcomeTraining` model.
-   **League Liquidity Model**: Dynamic trade activity scoring (`lib/liquidity-model.ts`) from trades/30d, manager participation, and asset complexity. Five tiers (FROZEN→VERY_HIGH) with acceptance modifiers.
-   **Monte Carlo Simulation Engine**: Matchup simulation (`lib/monte-carlo.ts`) with Box-Muller normal distribution, season simulation (expected wins, playoff/bye probability), bracket playoff simulation, and championship delta computation (before/after trade odds).
-   **Portfolio Simulator**: 5-year dynasty simulation (`lib/portfolio-simulator.ts`) with position-specific age curves (QB/RB/WR/TE), devy graduation modeling, pick realization, injury volatility, and year1/year3/year5 projections with asset breakdown.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers (`lib/counter-builder.ts`) maximizing `acceptProb * champDelta - valueLoss * riskWeight`. Auto-builds sweetener candidates from bench, picks, and FAAB.
-   **Real-time Data**: Live Scores System, Background Sync System, Live News Crawl, and Weekly Matchup DB Cache.
-   **Structured AI Interactions**: Structured Trade Evaluation Engine, League Decision Context System, GPT Fail-Closed Enforcement, and Negotiation GPT Contract.
-   **Weekly Awards Engine**: Server-side computation of 8 deterministic weekly awards from cached matchup data.
-   **Trade Hub Shortcuts**: LDI-powered per-team leverage scoring with deterministic CTAs.
-   **Partner Tendencies**: Per-counterparty trade LDI and premium tracking from LeagueTrade data.
-   **V2 Adapter Layer**: Clean isolation layer for V2 output accessors.
-   **Partner Strategy Profiles**: Deterministic partner behavior cards with overpay/discount positions, trade tags, and per-position LDI breakdowns.
-   **Rankings Snapshots**: Weekly rank history persistence for Momentum Sparkline and trend analysis.
-   **Premium Panels (Server-Side)**: Server-side computation of Tier, Win Window, and What Changed summaries.
-   **Momentum Sparkline**: SVG-based rank trend visualization.
-   **Model Drift Storage**: Stores `rankings_weights_snapshot` for V3 adaptive weight learning.
-   **Draft Grades Engine**: Deterministic V1 draft grading with percentile-based scoring and letter grades.
-   **Hall of Fame / All-Time Leaderboard**: Multi-season leaderboard with weighted scoring.
-   **V3 Weights Module**: Guardrailed weight management with normalization, clamped deltas, snapshot persistence, and rollback support.
-   **Drift Metrics Module**: Model health monitoring recording ECE, Brier, AUC, PSI, narrative fail rate.
-   **Premium UI Layer**: Provides fetch helpers, hooks, and orchestrator components for premium features.
-   **Player Media System**: Standardized player headshot and team logo delivery via `lib/player-media.ts`, with historical team affiliations.
-   **Stable User Identity**: `sleeperUser` identity object `{ username, userId }` standardized across core AI endpoints.
-   **Devy Player Classification System**: Comprehensive NCAA→NFL player classification with `DevyPlayer` Prisma model (unique on normalizedName/position/school). Two engines: `lib/devy-classification.ts` (CFBD roster ingestion for 50 teams, stats enrichment, Sleeper API graduation detection) and `lib/devy-classifier.ts` (clean `syncDevyClassification` interface with position-aware matching, `autoGraduateOnDraft` with deterministic disambiguation, `getDevyEligibleOnly`/`isPlayerGraduated` helpers). Strict safety guard: devy board applies double filter (DB query + post-query) preventing graduated NFL players from appearing. Falls back to AI when safeCandidates < 6. APIs: `/api/admin/devy-sync` (daily sync), `/api/admin/devy-graduate` (draft-event graduation). Frontend badges (NCAA/NFL/Graduated) and data source indicators.
-   **Devy Intelligence Engine**: `lib/devy-intel.ts` provides comprehensive devy value modeling with DraftProjectionScore (25% recruiting + 30% production + 15% breakout age + 15% athletic profile + 15% draft capital), FinalScore (40% DPS + 20% ADP market + 20% league need + 10% scarcity + 10% volatility), dynasty value computation with contender/rebuilder time-horizon adjustments, and devy-specific acceptance probability drivers. Includes `DevyAdp` model for market drift tracking, breakout age computation with position-specific thresholds, NFL draft capital curve (Rd1→1.0 to Rd7→0.2), NIL impact scoring, injury severity/volatility assessment, and availability % V2 with ADP-aware computation. Integrated into sync pipeline via `enrichDevyIntelMetrics()` and trade engine via devy-specific AcceptDrivers (projected round, breakout age, injury risk, volatility, partner archetype).
-   **Community & Gamification**: Community Insights Feed and an Achievement Badge System.
-   **Usage Analytics & Telemetry**: Full observability via `withApiUsage` wrapper, `ApiUsageEvent`/`ApiUsageRollup` models, and client-side logging.
-   **Enhanced Admin Dashboards**: All admin sections upgraded with Top-N cards, executable quick actions, and real-time metrics.

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