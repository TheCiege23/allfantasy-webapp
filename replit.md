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

**Authentication and Verification:**
A comprehensive authentication system includes password-based signup, email verification, login, password reset, and optional Sleeper account linking. Admin authentication uses HMAC-signed session cookies or Bearer tokens. A three-tier gating system (API-level, Route-level, Canonical email verification) with age confirmation and email/phone verification (Twilio Verify API) controls access to protected features, all rate-limited.

**UI/UX Decisions:**
The platform features a mobile-first design with a persistent Bottom Tab Bar, contextual AI Bottom Sheets, Universal AI Badges, and tabbed navigation. A universal theme system (Dark, Light, AF Legacy modes) is managed by `ThemeProvider`. The dashboard provides an AI Overview with user data, league info, bracket entries, and recommended actions.

**Technical Implementations:**
The core architecture is built upon three pillars: One Scoring Core, One Narrative System, and One Monitoring System, all integrated via a universal `One Engine API`. Key features include:
-   **Universal Trade Engine**: A deterministic `runTradeAnalysis()` pipeline supporting various league scoring systems, team direction inference, and acceptance probability modeling.
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator with deterministic tiers, pick aging, and veto layer, Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with percentile-normalized scores and a League Demand Index, including an Adaptive Rankings v2 Engine that learns from historical trades.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) with five core scores, AI Coach Box, Motivational Framing System, Luck Meter, and Win Window projection.
-   **Dynasty Outlook AI**: A dedicated dynasty analysis endpoint using an expert system prompt, providing structured JSON output.
-   **Valuation Systems**: IDP & Kicker Valuation System integrated with league ranking auto-detection and the trade engine; Devy Player Classification & Intelligence Engine for NCAA to NFL player classification.
-   **Monte Carlo Simulation Engine**: Performs matchup, season, and championship delta simulations.
-   **Acceptance Probability Model**: A logistic regression model with isotonic regression for real-outcome calibrated predictions, recalibrated weekly.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers.
-   **NCAA Bracket Challenge**: A full March Madness bracket system with league creation, ESPN-style UI, live polling, and shareable invite links.
-   **Trade Improvement AI (Dual-Brain)**: Utilizes Agentic Grok (multi-turn tool loop with web_search via Serper + x_keyword_search via xAI) and GPT-4o for parallel synthesis, featuring a real-time thinking UI and a feedback system.
-   **2-Stage Trade Analysis Pipeline (v2 — Deterministic First)**: Stage A (Deterministic Intelligence Layer) assembles a canonical `TradeDecisionContextV1` object, computing deterministic confidence, fact-grounded reasons, structured warnings, and counter-proposal baselines. Stage B (Peer Review Layer) uses OpenAI and Grok with the same prompt contract to explain and supplement, not invent, the baseline. A quality gate boosts confidence based on LLM agreement or penalizes for contradiction, merging deterministic-first content.
-   **Unified LeagueDecisionContext**: A single canonical `LeagueDecisionContext` object, assembled by `buildLeagueDecisionContext()`, ensures identical valuations, roster analysis, manager tendencies, and data freshness across all trade-related tools.
-   **Source Freshness Scoring**: Every context includes a `sourceFreshness` object grading data sources on a 5-tier scale (`fresh` to `unavailable`), applying graduated confidence penalties and a weighted composite score.
-   **Data Coverage Tier Scoring**: Synthesizes asset coverage, source freshness, and data completeness into a composite score (0-100) mapped to `FULL`, `PARTIAL`, or `MINIMAL` tiers, each with UI badge metadata and confidence adjustments.
-   **Confidence Guard Gates**: Two hard guards: an **Injury Compound Risk Guard** caps confidence when injury risk, stale data, and thin value delta co-occur; a **Missing Roster/Team Data Guard** forces a "Conditional" recommendation if critical data is expired or unavailable.
-   **3-Section Trade Response**: API responses are structured into: (1) **Value Verdict** (fairness grade, value delta, confidence, veto risk, reasons, freshness, recommendation type); (2) **Viability Verdict** (acceptance likelihood, partner fit, timing fit, league activity, acceptance signals, Rankings Impact, Injury-Adjusted Replacement Value, and Starter vs Bench Impact Delta); and (3) **Action Plan** (best offer assessment, counter baselines, suggested message text).
-   **League Sync System**: A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage and a shared sync core.

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