# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform providing AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. It aims to be a comprehensive "AF Legacy" hub for league management, sophisticated AI analytical tools, and integrated social sharing, establishing itself as a leading solution in the fantasy sports market.

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
The project is built with Next.js 14 (App Router) and TypeScript, using Tailwind CSS for styling. PostgreSQL with Prisma ORM handles database operations, and Zod schemas are used for validation. API security is managed via signed JWT-like tokens in HTTP-only cookies, with origin/referer validation for AI endpoints. Auth.js (NextAuth v4) provides email magic link authentication via Resend, using a separate `AppUser` model with optional `LegacyUser` link. Custom Prisma adapter maps to `app_users`, `auth_accounts`, `auth_sessions`, `auth_verification_tokens` tables.

**UI/UX Decisions:**
The platform features a mobile-first design including a persistent Bottom Tab Bar, contextual AI Bottom Sheets, and Universal AI Badges. It emphasizes clear calls to action and tabbed navigation, with a universal theme system (Dark, Light, AF Legacy modes) managed by `ThemeProvider`.

**Technical Implementations:**
The core architecture is built upon three pillars:
1.  **One Scoring Core**: All analytical features use four consistent scoring dimensions: Lineup Delta, Replacement/VORP, Market Value, and Manager Behavior.
2.  **One Narrative System**: AI-generated narratives must cite specific drivers and evidence, validated via `NarrativeValidationLog`.
3.  **One Monitoring System**: A Calibration Dashboard (`/admin?tab=calibration`) monitors for quality degradation and facilitates weekly auto-recalibration.
4.  **One Engine API**: A universal shared engine (`lib/engine/*`) provides standardized LeagueContext, PlayerState, Asset models, capability flags, and feature-flagged graceful degradation. It includes `runEngine()` as a universal entry point with DB snapshot caching, production-safe feature flags, and context building from Sleeper data.

Key features include:
-   **Universal Trade Engine**: Deterministic `runTradeAnalysis()` pipeline supporting various league scoring systems, devy realism, team direction inference (contend/rebuild), and acceptance probability modeling.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator (with deterministic tiers, pick aging, and veto layer), Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with percentile-normalized scores, multiple view modes, intent-aware weights, and a League Demand Index.
-   **Adaptive Rankings v2 Engine**: Features data-driven weight learning from historical trades, correlation-based weight derivation, and user-specific adaptive layers.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) based on five core scores, with phase-based composite weights, an AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection. Includes 5-year portfolio trajectory projection.
-   **IDP & Kicker Valuation System**: Internal tier-based valuation for DL/LB/DB/K positions, integrated with league ranking auto-detection and the trade engine.
-   **Devy Player Classification System**: Comprehensive NCAA to NFL player classification, with an engine for roster ingestion, stats enrichment, graduation detection, and safety guards.
-   **Devy Intelligence Engine**: Provides comprehensive devy value modeling with DraftProjectionScore, FinalScore, dynasty value computation, and devy-specific acceptance probability drivers.
-   **Player Analytics Database**: Stores extensive NFL player analytics data (combine metrics, college production, comparables, draft info, advanced NFL stats) for use in valuation and intelligence engines.
-   **Monte Carlo Simulation Engine**: Performs matchup simulation, season simulation (expected wins, playoff probability), and championship delta computation.
-   **Acceptance Probability Model**: A logistic regression model with features like fairness, LDI alignment, needs fit, and archetype match to predict trade acceptance.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers that maximize acceptance probability and championship delta while minimizing value loss.
-   **Response Hardening System**: Shared defensive utilities for robust API responses, including structured error handling and fallback mechanisms.
-   **Model Drift Dashboard**: Monitors model health using various event data, tracking calibration, drift, ranking quality, and narrative integrity.

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

## Player Analytics Integration
The player analytics database (1,468+ NFL players, 355 columns) is integrated across three core systems:
-   **Waiver AI** (`lib/waiver-engine/waiver-scoring.ts`): Analytics-enhanced stash scoring (breakout age, athleticism, dominator rating bonuses), refined dynasty ceiling driver with combine/college data, and `wa_age_trajectory` analytics profile driver. Batch analytics fetched in `app/api/legacy/waiver/analyze/route.ts`.
-   **League Rankings V2** (`lib/rankings-engine/league-rankings-v2.ts`): Analytics-enhanced portfolio projections with breakout age (+5% curve bonus for year3/year5) and elite athleticism (+3% curve bonus). Weekly volatility from analytics scaled by market value for better risk bands.
-   **AI Chat** (`app/api/ai/chat/route.ts`): Player name extraction from user messages, batch analytics lookup, and concise analytics context injection into system prompt (athletic/college grades, breakout age, dominator rating, comparables, volatility). All integrations have graceful fallbacks when analytics unavailable.