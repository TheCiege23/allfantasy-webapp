# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform designed to provide advanced analytical tools for fantasy football enthusiasts. It offers AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. The platform aims to become a leading hub in the fantasy sports market by leveraging sophisticated AI analytics, robust league management, and integrated social sharing to enhance the fantasy sports experience and establish an "AF Legacy."

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
The core architecture is based on a `One Engine API` that integrates a One Scoring Core, One Narrative System, and One Monitoring System. Key features include:
-   **Authentication System:** Password-based signup, email/phone verification, login, and optional Sleeper account linking.
-   **Universal Trade Engine:** A deterministic `runTradeAnalysis()` pipeline with a 2-Stage Trade Analysis (Deterministic Intelligence Layer and Peer Review Layer for explanation).
-   **AI-Powered Analysis:** Instant Trade Check, Personalized AI Chat (Chimmy), AI Trade Evaluator with deterministic tiers and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings:** Multi-dimensional player ranking system with a League Demand Index and an Adaptive Rankings v2 Engine.
-   **League Rankings V2 (Team-Level):** Two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, and Win Window projection.
-   **Monte Carlo Simulation Engine:** Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model:** A logistic regression model for calibrated predictions.
-   **Manager Psychology Profiles:** AI-powered psychological analysis of league managers based on their activity.
-   **Game Theory Counter Builder:** Generates mathematically optimized counter offers.
-   **NCAA Bracket Challenge (Sleeper-Style):** Full March Madness bracket system with dark navy theme, simplified pool creation, BracketTreeView, multiple scoring modes, interactive canvas, and SSE Live Updates.
-   **Trade Improvement AI (Dual-Brain):** Utilizes Agentic Grok and GPT-4o for parallel synthesis.
-   **Unified Canonical Context (v1):** All trade tools share a `TradeDecisionContextV1` for consistent data.
-   **Data Quality Features:** Includes Source Freshness Scoring, Data Coverage Tier Scoring, and Confidence Guard Gates.
-   **3-Section Trade Response:** API responses are structured into Value Verdict, Viability Verdict, and Action Plan.
-   **Rivalry Week Mode:** Deterministic rivalry scoring engine for narrative cards.
-   **League Sync System:** Multi-platform league sync supporting Sleeper, MFL, ESPN, and Yahoo.
-   **Manager DNA Cards:** Opponent-specific draft behavior profiling.
-   **Live Board Volatility Meter & Snipe Radar:** Draft-day decision support.
-   **Trade-Window Optimizer:** Actionable draft-day trade offers.
-   **Enhanced Mock Draft System:** League import, multi-pool ADP, AI opponent picking, and AI DM suggestions.
-   **Draft-Day Assistant Mode:** On-the-clock decision intelligence.
-   **Market Timing Alerts:** AI-powered buy/sell signals for players.
-   **News-Driven Value Adjustments:** Real-time news sentiment analysis impacting player values.
-   **Definitive Player Classification Engine:** Classifies devy players into statuses.
-   **CFBD v2 Enhanced Devy Intelligence:** Enriched devy valuations using college football data.
-   **Stripe Payment Integration:** Handles payments for paid bracket pools.
-   **FanCred EDGE Scoring Mode:** Headline scoring with R64=1, R32=2, S16=5, E8=10, F4=18, CH=30, Upset Delta Bonus, Leverage Bonus, and Insurance Token.
-   **Public Pools Directory:** Browseable public leagues with scoring mode filters and one-tap join.
-   **Global Leaderboard:** Points, percentile, accuracy%, risk index with league-aware scoring.
-   **Entry Controls:** Allow/disallow bracket copying, pick visibility (hidden until lock), insurance token toggle.
-   **Provider Adapter System:** Mock + HTTP providers with capability scoring and auto-selection.

## External Dependencies
-   **OpenAI**: General AI analysis.
-   **Grok**: Social media post generation and AI tools.
-   **PostgreSQL**: Primary database.
-   **Sleeper API**: User league data and trending player information.
-   **Rolling Insights Sports API**: Primary NFL sports data (depth charts, team stats).
-   **API-Sports.io**: Secondary NFL data provider.
-   **TheSportsDB API**: Tertiary sports data fallback.
-   **ESPN API**: Live scores, news, team rosters, injuries.
-   **CollegeFootballData.com API (CFBD v2)**: College football data.
-   **Resend**: Email notifications.
-   **Twilio Verify API**: Phone verification.
-   **OpenWeatherMap API**: Game-day weather data.
-   **NewsAPI.org**: News intelligence, sentiment analysis.
-   **Serper**: Google Search API for AI tools.
-   **FantasyCalc API**: Primary source for trade values, tiers, and player directories.
-   **Multi-Platform ADP Data**: Local CSV for redraft and dynasty ADP.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.
-   **Stripe**: Payment processing for bracket pools.