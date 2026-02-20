# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform designed as a comprehensive "AF Legacy" hub. It provides AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. The platform aims to lead the fantasy sports market by offering sophisticated AI analytical tools, robust league management, and integrated social sharing capabilities, focusing on business vision, market potential, and project ambitions.

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

**UI/UX Decisions:**
The platform features a mobile-first design with a persistent Bottom Tab Bar, contextual AI Bottom Sheets, Universal AI Badges, and tabbed navigation. A universal theme system (Dark, Light, AF Legacy modes) is managed by `ThemeProvider`. The dashboard provides an AI Overview with user data, league info, bracket entries, and recommended actions.

**Technical Implementations:**
The core architecture is built upon three pillars: One Scoring Core, One Narrative System, and One Monitoring System, all integrated via a universal `One Engine API`.
-   **Authentication System:** A comprehensive system with password-based signup, email verification, login, password reset, and optional Sleeper account linking. It includes a three-tier gating system (API-level, Route-level, Canonical email verification) with age confirmation and email/phone verification, all rate-limited.
-   **Universal Trade Engine**: A deterministic `runTradeAnalysis()` pipeline supporting various league scoring systems, team direction inference, and acceptance probability modeling. It includes a 2-Stage Trade Analysis Pipeline (Deterministic First), where Stage A (Deterministic Intelligence Layer) computes the primary verdict, and Stage B (Peer Review Layer) uses OpenAI and Grok for explanation and supplementation without overriding the deterministic outcome.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator with deterministic tiers, pick aging, and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with percentile-normalized scores and a League Demand Index, including an Adaptive Rankings v2 Engine that learns from historical trades.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection. Features a rich per-player injury model, a backtest engine, and a calibratable composite weight config system. Includes `rankChangeDrivers`, `forwardOdds` via Monte Carlo simulation, `confidenceBadge`, and `rankSparkline`.
-   **Valuation Systems**: IDP & Kicker Valuation System and Devy Player Classification & Intelligence Engine.
-   **Monte Carlo Simulation Engine**: Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model**: A logistic regression model with isotonic regression for real-outcome calibrated predictions.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers.
-   **NCAA Bracket Challenge**: A full March Madness bracket system with league creation, ESPN-style UI, live polling, and shareable invite links.
-   **Trade Improvement AI (Dual-Brain)**: Utilizes Agentic Grok and GPT-4o for parallel synthesis with a real-time thinking UI.
-   **Unified Canonical Context (v1)**: All trade tools share a single `TradeDecisionContextV1` via `buildUnifiedTradeContext()`, bridging legacy data with a canonical schema and providing freshness, coverage, and quality metadata.
-   **Data Quality Features**: Includes Source Freshness Scoring (5-tier grading), Data Coverage Tier Scoring (FULL, PARTIAL, MINIMAL), and Confidence Guard Gates (Injury Compound Risk Guard, Missing Roster/Team Data Guard).
-   **Trade Analysis UI Badges**: Three expandable badges (`Freshness Badge`, `Coverage Badge`, `Disagreement Badge`) display data quality signals inline with trade results.
-   **3-Section Trade Response**: API responses are structured into Value Verdict, Viability Verdict, and Action Plan.
-   **Rivalry Week Mode**: A deterministic rivalry scoring engine that computes head-to-head records, trade friction, and matchup impact, producing narrative cards with AI-generated hype text.
-   **Migration Proof**: Split-screen "Before → After" comparison showing Sleeper raw snapshot vs AF AI-enhanced intelligence.
-   **League Sync System**: A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage.
-   **Manager DNA Cards**: Opponent-specific draft behavior profiling system computing 5 behavioral signals (reach frequency, positional aggression by round, rookie appetite, stack tendency, panic response) per manager from roster/performance data. Derives archetypes (e.g., "The Calculator", "Dynasty Architect") and feeds DNA-informed tendencies into predict-board and pick-path simulations. Located in `lib/mock-draft/manager-dna.ts` with API at `/api/mock-draft/manager-dna`.
-   **Live Board Volatility Meter**: Per-pick decision-risk overlay on the predicted draft board. Uses normalized Shannon entropy to classify each pick window as low/medium/high chaos, computes confidence bands (top pick, top 3, top 6 probability coverage), and identifies stable vs fragile tier moments based on concentration and positional spread. Includes a board-level volatility summary bar.
-   **Snipe Radar**: Pre-pick threat detection system that runs Monte Carlo simulations to identify which top players are likely to be taken before each user pick. Shows snipe probability, which managers are most likely to snipe each player, expected value lost if sniped, and urgency levels (critical/warning/watch). Located at `/api/mock-draft/snipe-radar`.
-   **Trade-Window Optimizer**: Actionable draft-day trade optimizer that generates top 3 trade-up and trade-down offers ranked by risk-adjusted expected value. Includes acceptance odds per manager DNA profile, minimum ask thresholds, walk-away cost limits, and verdict summaries. Located at `/api/mock-draft/trade-optimizer`.
-   **Board Drift Report**: Weekly "Monday morning draft intel" system that compares current ADP snapshots against the previous week to identify who moved most (risers/fallers), why (injury/news/rookie/role signals), which managers changed tendency projections, and what this means for the user's next 3 draft rounds. Stores weekly snapshots in SportsDataCache for week-over-week comparison. Located in `lib/mock-draft/board-drift.ts` with API at `/api/mock-draft/board-drift`.
-   **Explainable AI Scorecards**: Per-pick weighted-factor breakdown showing how much each signal (ADP Position, Team Need, Manager Style, News Impact, Rookie Rank Boost) contributed to the AI's prediction. Computed by decomposing `scorePlayerForManager()` into normalized percentages, aggregated across Monte Carlo simulations, and rendered as a stacked color bar with factor legend on each Predict Board target.
-   **Scenario Lab**: User-controlled "what-if" simulation engine with 4 toggle-able market assumptions (Heavy Rookie Hype, RB Scarcity Spike, Injury Risk Conservative, League Overvalues QBs). Runs parallel baseline vs scenario simulations via `predict-board` API with scenario multipliers applied to scoring weights and position targets. Displays side-by-side forecast comparison with probability deltas and SHIFTED badges for picks that changed between scenarios.
-   **Draft-Day Assistant Mode**: On-the-clock decision intelligence triggered from the mock draft board. Runs a fast 100-sim forecast focused on the user's active pick, providing: instant top 3 picks ranked by confidence with fallback, "if available at +4 picks, wait; else take now" wait/take advice based on snipe probability analysis, and one-tap queue generation showing best 6 targets across upcoming draft slots. Integrates with `predict-board` API via `assistantMode` and `focusPickOverall` parameters.
-   **Post-Draft Retrospective**: After real draft import, compares AI predict-board predictions vs actual draft picks. Features per-manager prediction accuracy (exact hit rate + top-3 hit rate), biggest misses with scorecard-driven explanations (position surprise, tendency overweight, ADP-driven miss, etc.), and automatic per-league model calibration. Calibration weights (ADP, Need, Tendency, News, Rookie) are stored per league/season and automatically applied to future predict-board runs via EMA smoothing, making the system learn league-specific tendencies over time. Located at `lib/mock-draft/retrospective.ts` with API at `/api/mock-draft/retrospective`. DB models: `DraftPredictionSnapshot`, `DraftRetrospective`, `LeagueDraftCalibration`.

-   **Player/Manager Image System**: Shared Sleeper player cache (`lib/sleeper/players-cache.ts`) with 6-hour TTL resolves player names to Sleeper IDs for headshot URLs (`sleepercdn.com/content/nfl/players/thumb/{id}.jpg`). Team logos from ESPN CDN. Manager avatars from Sleeper user API. `MiniPlayerImg` component (`components/MiniPlayerImg.tsx`) handles all image display with React-state-driven fallback to initials. All mock-draft API routes include `sleeperId` and `avatarUrl` fields in responses.

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
-   **Twilio Verify API**: Phone verification.
-   **OpenWeatherMap API**: Game-day weather data.
-   **NewsAPI.org**: Secondary news source.
-   **Serper**: Web search for Trade Improvement AI.
-   **xAI**: Keyword search for Trade Improvement AI.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.