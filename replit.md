# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform providing AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. It aims to be a comprehensive "AF Legacy" hub, leading the fantasy sports market with sophisticated AI analytical tools, robust league management, and integrated social sharing capabilities.

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
The project is built with Next.js 14 (App Router) and TypeScript, utilizing Tailwind CSS for styling. Data persistence is handled by PostgreSQL with Prisma ORM, and Zod schemas ensure data validation. Authentication is managed by Auth.js (NextAuth v4) using a Credentials provider with bcryptjs and JWT.

**UI/UX Decisions:**
The platform features a mobile-first design with a persistent Bottom Tab Bar, contextual AI Bottom Sheets, Universal AI Badges, and tabbed navigation. A universal theme system (Dark, Light, AF Legacy modes) is managed by `ThemeProvider`. The dashboard provides an AI Overview with user data, league info, bracket entries, and recommended actions.

**Technical Implementations:**
The core architecture uses a `One Engine API` integrating One Scoring Core, One Narrative System, and One Monitoring System.
-   **Authentication System:** A comprehensive system with password-based signup, email verification, login, password reset, optional Sleeper account linking, and a three-tier gating system (API-level, Route-level, Canonical email verification) with age confirmation and email/phone verification, all rate-limited.
-   **Universal Trade Engine**: A deterministic `runTradeAnalysis()` pipeline supporting various league scoring systems, team direction inference, and acceptance probability modeling. It includes a 2-Stage Trade Analysis Pipeline (Deterministic First), where Stage A (Deterministic Intelligence Layer) computes the primary verdict, and Stage B (Peer Review Layer) uses OpenAI and Grok for explanation and supplementation without overriding the deterministic outcome.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator with deterministic tiers, pick aging, and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with percentile-normalized scores and a League Demand Index, including an Adaptive Rankings v2 Engine that learns from historical trades.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection.
-   **Valuation Systems**: IDP & Kicker Valuation System and Devy Player Classification & Intelligence Engine.
-   **Monte Carlo Simulation Engine**: Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model**: A logistic regression model with isotonic regression for real-outcome calibrated predictions.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers.
-   **NCAA Bracket Challenge**: A full March Madness bracket system with league creation, ESPN March Madness-style UI, live game scores, and standings.
-   **Trade Improvement AI (Dual-Brain)**: Utilizes Agentic Grok and GPT-4o for parallel synthesis with a real-time thinking UI.
-   **Unified Canonical Context (v1)**: All trade tools share a single `TradeDecisionContextV1` via `buildUnifiedTradeContext()`, bridging legacy data with a canonical schema and providing freshness, coverage, and quality metadata.
-   **Data Quality Features**: Includes Source Freshness Scoring, Data Coverage Tier Scoring, and Confidence Guard Gates (Injury Compound Risk Guard, Missing Roster/Team Data Guard).
-   **Trade Analysis UI Badges**: Three expandable badges (`Freshness Badge`, `Coverage Badge`, `Disagreement Badge`) display data quality signals inline with trade results.
-   **3-Section Trade Response**: API responses are structured into Value Verdict, Viability Verdict, and Action Plan.
-   **Rivalry Week Mode**: A deterministic rivalry scoring engine that computes head-to-head records, trade friction, and matchup impact, producing narrative cards with AI-generated hype text.
-   **League Sync System**: A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage.
-   **Manager DNA Cards**: Opponent-specific draft behavior profiling system computing 5 behavioral signals per manager from roster/performance data, deriving archetypes.
-   **Live Board Volatility Meter**: Per-pick decision-risk overlay on the predicted draft board, using normalized Shannon entropy to classify pick windows and compute confidence bands.
-   **Snipe Radar**: Pre-pick threat detection system using Monte Carlo simulations to identify players likely to be taken before user picks.
-   **Trade-Window Optimizer**: Actionable draft-day trade optimizer generating top trade-up and trade-down offers ranked by risk-adjusted expected value.
-   **Board Drift Report**: Weekly "Monday morning draft intel" system comparing current ADP snapshots against the previous week to identify risers/fallers and changes in manager tendency projections.
-   **Explainable AI Scorecards**: Per-pick weighted-factor breakdown showing how each signal (ADP Position, Team Need, Manager Style, News Impact, Rookie Rank Boost) contributed to the AI's prediction.
-   **Scenario Lab**: User-controlled "what-if" simulation engine with toggle-able market assumptions, running parallel baseline vs scenario simulations.
-   **Draft-Day Assistant Mode**: On-the-clock decision intelligence providing instant top 3 picks, wait/take advice, and one-tap queue generation.
-   **Post-Draft Retrospective**: Compares AI predict-board predictions vs actual draft picks after real draft import, featuring per-manager prediction accuracy and automatic per-league model calibration.
-   **Market Timing Alerts**: AI-powered buy/sell signal system based on dynasty values and trends for NFL and Devy players.
-   **News-Driven Value Adjustments**: Real-time news sentiment analysis that modifies player values before deterministic trade calculations, with multipliers based on severity and sentiment.
-   **Definitive Player Classification Engine**: Multi-source cross-referencing system that definitively classifies every devy player into statuses: `college`, `declared`, `drafted`, `nfl_active`, or `returning`.
-   **CFBD v2 Enhanced Devy Intelligence**: Enriched devy valuations incorporating recruiting composite ratings (247/composite stars), transfer portal tracking (from/to schools, eligibility), player usage rates (UPI), Predicted Points Added (PPA), Wins-above-Expected Points Added (WEPA), SP+ team context ratings, and returning production percentages. New metrics feed into computeDraftProjectionScore, computeDevyDynastyValue, computeVolatilityScore, and computeDevyAcceptDrivers with weighted formulas (recruiting 20%, production 25%, PPA 10%, WEPA 5%, team context 5%, athletic 10%, breakout 10%, draft capital 15%).

## External Dependencies
-   **OpenAI**: General AI analysis.
-   **Grok**: Social media post generation.
-   **PostgreSQL**: Primary database.
-   **Sleeper API**: Importing user league data. Now includes trending players endpoints (`/players/{sport}/trending/add` and `trending/drop`) synced every 2 hours to `trending_players` DB table, providing "crowd wisdom" signals (hot_add/hot_drop/rising/falling) that feed into Waiver AI scoring and Market Timing Alerts.
-   **Rolling Insights Sports API**: Primary NFL sports data including depth charts (via `rosterByPosition` GraphQL field), team season stats (regular/post via `regularSeason`/`postSeason`), enhanced player fields (injury, formerTeams, allStar), team metadata (conference, bye, dome, arena, record). Synced to `depth_charts` and `team_season_stats` DB tables with 12h/24h TTLs respectively.
-   **API-Sports.io**: Secondary NFL data provider with full endpoint coverage: teams, players, player statistics, injuries, games (by season/week/date/team/h2h/live), game events (play-by-play), game team statistics, game player statistics, standings (with conference/division filters), conferences, divisions, odds (pre-match and per-game), bookmakers, bet types, leagues, seasons, and timezones. Rate-limit aware with per-minute throttling and IP block detection.
-   **TheSportsDB API**: Tertiary sports data fallback.
-   **ESPN API**: Quaternary sports data fallback, primary for live scores and news.
-   **CollegeFootballData.com API (CFBD v2)**: College Football data including rosters, stats, recruiting ratings (247/composite), transfer portal tracking, player usage/PPA, WEPA adjusted metrics, SP+ team ratings, returning production, and NFL draft picks. All endpoints cached via SportsDataCache with TTLs (7d recruiting, 1d usage/PPA/portal, 30d SP+/historical). Bulk fetch pattern to stay under 1,000 monthly API call limit.
-   **Resend**: Email notifications.
-   **Twilio Verify API**: Phone verification.
-   **OpenWeatherMap API**: Game-day weather data.
-   **NewsAPI.org**: Comprehensive news intelligence using all 3 endpoints: `/v2/everything` (keyword searches with sports domain filtering), `/v2/top-headlines` (breaking sports headlines via `category=sports`), and source metadata. Full field capture: title, description, content body, author, imageUrl (urlToImage), source ID/name, publishedAt. Enhanced with auto-classification (injury/trade/waiver/draft/contract/fantasy_advice/game_recap/discipline/coaching/dynasty/college), sentiment detection (positive/negative/mixed/trade/neutral), player name extraction (prefetched identity map), multi-team tagging, and rotating multi-query sync patterns for maximum coverage.
-   **Serper**: Web search for Trade Improvement AI.
-   **xAI**: Keyword search for Trade Improvement AI.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.