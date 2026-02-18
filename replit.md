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
The project is built with Next.js 14 (App Router) and TypeScript, using Tailwind CSS for styling. PostgreSQL with Prisma ORM handles database operations, and Zod schemas are used for validation. Auth.js (NextAuth v4) provides password-based authentication via Credentials provider with bcryptjs. Session strategy is JWT. Custom Prisma adapter maps to `app_users`, `auth_accounts`, `auth_sessions`, `auth_verification_tokens` tables.

**Authentication System:**
-   **Password signup**: `/signup` page collects username (unique, required), email, password, display name, phone (optional), Sleeper username (optional with live lookup), 18+ age confirmation. Registration via `/api/auth/register`. Sends hashed email verification token on signup.
-   **Email verification**: Separate from login. Token-based with SHA-256 hashed storage (`EmailVerifyToken`). Register sends token email; `/verify` page has "Send verification email" button for resend (requires session). `/verify/email?token=` hashes token, validates, sets `AppUser.emailVerified`. Redirects to `/verify?verified=email` or `/verify?error=...`.
-   **Password login**: `/login` page with password-only form. Credentials provider accepts email or username + password. No magic link login.
-   **Password reset**: `/forgot-password` page sends reset email. Token stored hashed (`PasswordResetToken`, 30min expiry). `/reset-password?token=` page accepts new password. Confirm endpoint at `/api/auth/password/reset/confirm`. Password must include letter + number.
-   **Sleeper connect**: Optional during signup. Server-side lookup via `https://api.sleeper.app/v1/user/{username}`. Stores `sleeperUsername`, `sleeperUserId`, `sleeperLinkedAt`. Display-only, not verified ownership. Badge shows "Connected" not "Verified".
-   **signIn event**: Only ensures `UserProfile` exists via upsert. Does NOT write `emailVerifiedAt` on login — verification only happens through explicit verify-email flow.

**Verification Gate System:**
User access to protected features requires age confirmation + email/phone verification. Three-tier gating:
-   **API-level**: `requireVerifiedUser()` from `lib/auth-guard.ts` returns 401 (UNAUTHENTICATED), 403 (AGE_REQUIRED), or 403 (VERIFICATION_REQUIRED). Applied to all bracket mutation endpoints.
-   **Route-level**: `requireVerifiedSession()` from `lib/require-verified.ts` redirects unauthenticated users to /login and unverified users to /verify.
-   **Canonical email verification**: Trusts `AppUser.emailVerified` (set only by verify-email endpoint), NOT `UserProfile.emailVerifiedAt`.
-   **Phone verification**: Twilio Verify API via `/api/verify/phone/start` and `/api/verify/phone/check`. E.164 normalization, rate limited (3 sends/2min, 5 checks/5min). Sets `UserProfile.phoneVerifiedAt`.
-   **Gating rule**: `isUserVerified(emailVerified, phoneVerifiedAt) = !!emailVerified || !!phoneVerifiedAt`. Full onboarding requires verification AND ageConfirmedAt AND profileComplete=true.
-   **Post-login routing**: Verified users → `/dashboard`, logged out → `/login`. Dashboard shows setup checklist for unverified users.
-   **Client-side pages** (leagues/new, join) handle VERIFICATION_REQUIRED and AGE_REQUIRED by redirecting to /verify.
-   **Rate limiting**: Signup (5/10min), email verify send (3/2min), password reset (5/10min), phone start (3/2min), phone check (5/5min). All per-IP+user bucketed.

**Dashboard (`/dashboard`):**
Post-login landing page (AI Overview). Server component fetches user data, leagues, entries. Shows:
-   Welcome banner with username/Sleeper identity
-   Setup completion checklist (verification, age, profile)
-   My Leagues grid with member counts
-   My Bracket Entries grid with scores
-   Recommended Actions (create league, fill bracket, view brackets, AF Legacy tools)
-   Top bar with Create League + Join League buttons + profile menu with sign out

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
-   **NCAA Bracket Challenge**: Full March Madness bracket system with league creation, invite codes, ESPN-style bracket UI (`BracketProView`), live polling via `useBracketLive` hook (15s intervals), animated `Leaderboard` with rank change tracking, optimistic picks with rollback, mobile horizontal round scroller, seasonal nav CTA (`BracketsNavLinks`), and shareable invite links with auto-fill. Routes: `/brackets`, `/bracket/[tournamentId]/entry/[entryId]`, `/brackets/join?code=...`, `/march-madness` (redirect alias).

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