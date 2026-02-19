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

**Legacy Hub (`/af-legacy`):**
The Legacy Hub is the central authenticated hub embedding full feature routes in-tab via iframe. Rankings (`/rankings`) and Dynasty Trade Analyzer (`/dynasty-trade-analyzer`) are rendered in-tab rather than as launcher cards. The standalone routes still function independently (rankings has refresh + dynasty outlook actions; trade analyzer mounts `DynastyTradeForm`). Transfer FK recovery guard is active in the backend `POST /api/legacy/transfer` route.

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
-   **Acceptance Probability Model**: A logistic regression model to predict trade acceptance.
-   **Game Theory Counter Builder**: Mathematically optimized counter offers.
-   **NCAA Bracket Challenge**: A full March Madness bracket system with league creation, ESPN-style UI, live polling, and shareable invite links.
-   **Trade Improvement AI (Dual-Brain)**: Utilizes Agentic Grok (multi-turn tool loop with web_search via Serper + x_keyword_search via xAI) and GPT-4o for parallel synthesis, featuring a real-time thinking UI and a feedback system that personalizes future suggestions.

**League Sync System:**
A multi-platform league sync system supports Sleeper, MFL, ESPN, and Yahoo, with encrypted credential storage and a shared sync core.

## Launch Week Status (Feb 2026)
**Feature Freeze: ACTIVE** - Legacy Hub is frozen for launch. Only bugfixes accepted.
- Release commit: `e623d85` (checkpoint before hardening)
- Smoke test suite: 29 Playwright tests (CI-required gate)
- Golden path tests cover: auth redirects, rankings, trade analyzer, strategy, share, API auth guards
- Verification matrix: A (Legacy Hub tabs), B (direct route fallbacks), C (critical backend guards)
- Observability: 5xx alerting on `/api/legacy/transfer`, `/api/trade-finder`, `/api/strategy/generate`
- Redirect loop detection active via Next.js middleware on /login (logs + cookie-based counting)
- Preflight script: `npm run preflight` validates all env vars, DB connection, migrations, auth config
- CI: `.github/workflows/smoke-tests.yml` runs Playwright as required merge gate with HTML report artifact
- Rollback: Use Replit checkpoints to restore to last known-good state. Current checkpoint commit: `e623d85`

### Go-Live Checklist Status
| # | Task | Status |
|---|------|--------|
| 1 | Env sanity (NEXTAUTH_URL, secret, DB, AI keys) | PASS - 0 failures, 4 warnings (table casing) |
| 2 | Auth flow for protected routes | PASS - 7 routes verified redirect to /login |
| 3 | Legacy Hub visual check | PASS - redirects to login when unauthenticated (expected) |
| 4 | Feature parity (rankings refresh, trade analyzer) | PASS - Refresh AI Analysis button + Power Rankings heading confirmed |
| 5 | Legacy transfer FK guard | PASS - returns 401 unauthenticated, FK recovery guard in code |
| 6 | API guardrail check | PASS - all protected APIs return 401/403/400, never 500 |
| 7 | CI gate (Playwright required) | PASS - `.github/workflows/smoke-tests.yml` configured |
| 8 | Deploy canary | PENDING - requires production deploy |
| 9 | 24h observability | READY - alerting module active, admin endpoint at `/api/admin/observability` |
| 10 | Full rollout | PENDING - after 24h observe period |

### Fast Triage Map
- **White/washed cards on Legacy Hub**: Check route is rendering current token overrides on hub container
- **Trade analyzer in Legacy tab shows login/error**: Auth-protected route in iframe; verify session cookie domain/proxy setup and auth env vars
- **User sees "sample/no data" on rankings**: Rankings can render with userId=null; ensure signed-in + synced leagues
- **Transfer throws FK/user errors**: Confirm fallback user creation path executes (lines 98-121 of transfer/route.ts) and DB constraints healthy

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