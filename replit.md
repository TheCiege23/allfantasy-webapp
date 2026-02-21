# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform designed to provide advanced analytical tools for fantasy football enthusiasts. It offers AI-driven trade evaluations, waiver wire recommendations, and personalized career insights, aiming to become a leading hub in the fantasy sports market through sophisticated AI analytics, robust league management, and integrated social sharing. The platform seeks to establish an "AF Legacy" by delivering comprehensive tools that enhance the fantasy sports experience.

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
The AllFantasy platform is built with Next.js 14 (App Router) and TypeScript, styled using Tailwind CSS. Data is managed with PostgreSQL and Prisma ORM, with Zod for schema validation. Authentication relies on Auth.js (NextAuth v4) using a Credentials provider with bcryptjs and JWT.

**UI/UX Decisions:**
The design is mobile-first, featuring a persistent Bottom Tab Bar, contextual AI Bottom Sheets, Universal AI Badges, and tabbed navigation. A universal theme system (Dark, Light, AF Legacy) is controlled by `ThemeProvider`. The dashboard offers an AI Overview displaying user data, league information, and recommended actions.

**Technical Implementations:**
The core architecture is based on a `One Engine API` that integrates a One Scoring Core, One Narrative System, and One Monitoring System.
-   **Authentication System:** Features password-based signup, email verification, login, password reset, optional Sleeper account linking, and a three-tier gating system with age/email/phone verification, all rate-limited.
-   **Universal Trade Engine:** A deterministic `runTradeAnalysis()` pipeline supports various league scoring, team direction inference, and acceptance probability modeling. It uses a 2-Stage Trade Analysis Pipeline: Stage A (Deterministic Intelligence Layer) provides the primary verdict, and Stage B (Peer Review Layer) uses OpenAI and Grok for explanation without overriding the deterministic outcome.
-   **AI-Powered Analysis:** Includes Instant Trade Check, Personalized AI Chat, AI Trade Evaluator with deterministic tiers, pick aging, and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings:** A multi-dimensional player ranking system with percentile-normalized scores and a League Demand Index, incorporating an Adaptive Rankings v2 Engine that learns from historical trades.
-   **League Rankings V2 (Team-Level):** A two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection.
-   **Valuation Systems:** Features IDP & Kicker Valuation and a Devy Player Classification & Intelligence Engine.
-   **Monte Carlo Simulation Engine:** Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model:** A logistic regression model with isotonic regression for calibrated predictions.
-   **Game Theory Counter Builder:** Generates mathematically optimized counter offers.
-   **NCAA Bracket Challenge:** A full March Madness bracket system with league creation, ESPN-style UI, live scores, and standings.
-   **Trade Improvement AI (Dual-Brain):** Utilizes Agentic Grok and GPT-4o for parallel synthesis with a real-time UI.
-   **Unified Canonical Context (v1):** All trade tools share a `TradeDecisionContextV1` via `buildUnifiedTradeContext()`, bridging legacy data with a canonical schema and providing freshness, coverage, and quality metadata.
-   **Data Quality Features:** Includes Source Freshness Scoring, Data Coverage Tier Scoring, and Confidence Guard Gates (Injury Compound Risk Guard, Missing Roster/Team Data Guard).
-   **Trade Analysis UI Badges:** Three expandable badges (`Freshness Badge`, `Coverage Badge`, `Disagreement Badge`) display data quality signals.
-   **3-Section Trade Response:** API responses are structured into Value Verdict, Viability Verdict, and Action Plan.
-   **Rivalry Week Mode:** A deterministic rivalry scoring engine computes head-to-head records, trade friction, and matchup impact, generating narrative cards with AI-generated hype text.
-   **League Sync System:** A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage.
-   **Manager DNA Cards:** Opponent-specific draft behavior profiling system computing 5 behavioral signals per manager from roster/performance data, deriving archetypes.
-   **Live Board Volatility Meter:** Per-pick decision-risk overlay on the predicted draft board, using normalized Shannon entropy to classify pick windows and compute confidence bands.
-   **Snipe Radar:** Pre-pick threat detection system using Monte Carlo simulations to identify players likely to be taken before user picks.
-   **Trade-Window Optimizer:** Actionable draft-day trade optimizer generating top trade-up and trade-down offers ranked by risk-adjusted expected value.
-   **Board Drift Report:** Weekly "Monday morning draft intel" system comparing current ADP snapshots against the previous week to identify risers/fallers and changes in manager tendency projections.
-   **Explainable AI Scorecards:** Per-pick weighted-factor breakdown showing how each signal (ADP Position, Team Need, Manager Style, News Impact, Rookie Rank Boost) contributed to the AI's prediction.
-   **Scenario Lab:** User-controlled "what-if" simulation engine with toggle-able market assumptions, running parallel baseline vs scenario simulations.
-   **Draft-Day Assistant Mode:** On-the-clock decision intelligence providing instant top 3 picks, wait/take advice, and one-tap queue generation.
-   **Post-Draft Retrospective:** Compares AI predict-board predictions vs actual draft picks after real draft import, featuring per-manager prediction accuracy and automatic per-league model calibration.
-   **Market Timing Alerts:** AI-powered buy/sell signal system based on dynasty values and trends for NFL and Devy players.
-   **News-Driven Value Adjustments:** Real-time news sentiment analysis that modifies player values before deterministic trade calculations, with multipliers based on severity and sentiment.
-   **Definitive Player Classification Engine:** Multi-source cross-referencing system that definitively classifies every devy player into statuses: `college`, `declared`, `drafted`, `nfl_active`, or `returning`.
-   **CFBD v2 Enhanced Devy Intelligence:** Enriched devy valuations incorporating recruiting composite ratings, transfer portal tracking, player usage rates, Predicted Points Added (PPA), Wins-above-Expected Points Added (WEPA), SP+ team context ratings, and returning production percentages.

## External Dependencies
-   **OpenAI**: Used for general AI analysis.
-   **Grok**: Used for social media post generation.
-   **PostgreSQL**: The primary database.
-   **Sleeper API**: Integrates user league data and trending player information.
-   **Rolling Insights Sports API**: Provides primary NFL sports data, including depth charts and team season statistics.
-   **API-Sports.io**: A secondary NFL data provider with comprehensive endpoint coverage, including teams, players, statistics, and games.
-   **TheSportsDB API**: Serves as a tertiary sports data fallback.
-   **ESPN API**: Provides live scores, news, team rosters, injuries, game summaries, and standings.
-   **CollegeFootballData.com API (CFBD v2)**: Provides college football data, including rosters, stats, recruiting ratings, and advanced player metrics.
-   **Resend**: Used for email notifications.
-   **Twilio Verify API**: Used for phone verification.
-   **OpenWeatherMap API**: Provides game-day weather data.
-   **NewsAPI.org**: Comprehensive news intelligence, including keyword searches, top headlines, sentiment detection, and player/team tagging.
-   **Serper**: Google Search API for web and news searches, utilized by AI tools for real-time information retrieval.
-   **xAI**: Used for keyword search in the Trade Improvement AI.
-   **FantasyCalc API**: The primary source for trade values, including dynasty/redraft values, tiers, and player directories with cross-platform IDs.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.