# AllFantasy

## Overview
AllFantasy is an AI-powered fantasy sports platform providing AI-driven trade evaluations, waiver wire recommendations, and personalized career insights. It aims to be a leading tool in the fantasy sports market by offering a comprehensive "AF Legacy" hub for league management, sophisticated AI analytical tools, and integrated social sharing capabilities.

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
The platform features a mobile-first design system including a persistent Bottom Tab Bar, contextual AI Bottom Sheets, and Universal AI Badges (confidence + risk chips + expandable "Why?" accordion). It emphasizes clear calls to action, success pages with onboarding questionnaires, and tabbed navigation. A universal theme system supports Dark, Light, and AF Legacy modes via CSS custom properties (`--bg`, `--panel`, `--panel2`, `--border`, `--text`, `--muted`, `--muted2`, `--accent`). ThemeProvider (`components/theme/ThemeProvider.tsx`) sets `data-mode` on `<html>` and persists to localStorage. ModeToggle (`components/theme/ModeToggle.tsx`) is placed in the admin header and landing page. The landing page (`app/page.tsx`) uses CSS variable tokens for all body text, panels, inputs, and borders — brand gradients (cyan/purple) remain fixed across themes.

**Technical Implementations:**
The core architecture is built upon three pillars:
1.  **One Scoring Core**: All analytical features use four consistent scoring dimensions: Lineup Delta, Replacement/VORP, Market Value, and Manager Behavior.
2.  **One Narrative System**: AI-generated narratives must cite specific drivers and evidence, failing closed if citations are not possible, and are validated via `NarrativeValidationLog`.
3.  **One Monitoring System**: A Calibration Dashboard (`/admin?tab=calibration`) actively monitors for quality degradation, including reliability, segment failures, input drift, narrative integrity, and intercept drift, with weekly auto-recalibration of the intercept.

Key features include:
-   **AI-Powered Analysis**: Instant Trade Check, Personalized AI Chat, AI Trade Evaluator (with deterministic tiers, pick aging, and veto layer), Deterministic Waiver AI, and a Goal-Driven AI Trade Proposal Generator.
-   **Trade Partner Matchmaking Engine**: A deterministic engine that scores and ranks trade partners based on need, availability, bias, and tendencies.
-   **Trade & League Management**: Trade Finder, League Rankings, Trade Notifications, a Deterministic Negotiation Toolkit, and Trade Ideas Fallback Opportunities.
-   **Adaptive Consensus + Context Rankings**: A multi-dimensional player ranking system with 4 percentile-normalized scores, 6 view modes, intent-aware weights, and a League Demand Index.
-   **Adaptive Rankings v2 Engine**: Features data-driven weight learning from historical trades per league class, correlation-based weight derivation, and user-specific adaptive layers with goal-based weights. Includes a weekly weight re-learning system with guardrails.
-   **League Demand Index Heatmap**: V2 production heatmap consuming computeLeagueRankingsV2 meta output. 2x2+ grid (QB/RB/WR/TE + FLEX/PICKS when available) with HOT(≥70)/COLD(≤35)/NEUTRAL/LEARNING tags, drawer-based evidence panels, proposal targets (55/30/15 scoring), and 3 CTAs per position. API: `/api/leagues/ldi-heatmap`.
-   **League Rankings V2 (Team-Level)**: A two-layer team ranking system (Power Rankings and Dynasty Outlook) based on five core scores: Win Score, Power Score, Luck Score, Market Value Score, and Manager Skill Score, with phase-based composite weights and an AI Coach Box. Includes Motivational Framing System, Luck Meter, Bounce-Back Index, Should-Be Record, weekly awards, and premium micro-panels: "What Changed" (rank movement + drivers), Tier Label (Contender/Rising/Rebuilder/Playoff Threat/Mid Pack), and Win Window (deterministic win timeline projection). V2 output exposes `meta` block with ldiByPos, partnerPosCounts, ldiSampleTotal, ldiTrend, and proposalTargets for downstream consumers.
-   **Exploit My League (Trade Hub)**: A three-panel component displaying hot/cold demand, best leverage opportunities, and partner tendencies.
-   **Enhanced Rankings System**: League and user-specific rankings with multiple views, a Team Fit Score, League RankScore, User RankScore, and an AI-generated dynasty roadmap.
-   **Model Drift Dashboard**: Comprehensive monitoring of model health using `TradeOfferEvent`, `TradeOutcomeEvent`, and `ModelMetricsDaily`, with UI for tracking calibration, drift, ranking quality, and narrative integrity.
-   **Data & Integrations**: Sports Data Router, Hybrid Valuation System, VORP Engine, and a Trade Engine Scoring Architecture.
-   **AI Confidence & Learning**: Three-tier AI Confidence System, Comprehensive Trade Learning System, AI Decision Guardian, Accept Probability Calibration, and Auto-Recalibration.
-   **Real-time Data**: Live Scores System, Background Sync System, Live News Crawl, and WeeklyMatchup DB Cache (lib/rankings-engine/sleeper-matchup-cache.ts) that persists Sleeper API matchup data with 30-minute freshness policy for the current week.
-   **Structured AI Interactions**: Structured Trade Evaluation Engine, League Decision Context System, GPT Fail-Closed Enforcement, and Negotiation GPT Contract.
-   **Weekly Awards Engine**: Server-side computation of 8 deterministic weekly awards (top_score, boss_win, high_score_margin, biggest_upset, unluckiest, luckiest, bounceback_alert, points_against_victim) from cached matchup data.
-   **Trade Hub Shortcuts**: LDI-powered per-team leverage scoring with deterministic CTAs ("Generate offers", "Find overpayers") when a team holds high-LDI position currency.
-   **Partner Tendencies**: Per-counterparty trade LDI and premium tracking from LeagueTrade data, with 6-trade minimum sample threshold.
-   **V2 Adapter Layer**: Clean isolation layer (`lib/rankings-engine/v2-adapter.ts`) for V2 output accessors — all new modules import through the adapter instead of coupling directly to V2 internals.
-   **Partner Strategy Profiles**: Deterministic partner behavior cards with overpay/discount positions, trade tags (Active Trader, Pick Hoarder, Aggressive), and per-position LDI breakdowns. API: `/api/leagues/partner-profiles`.
-   **Rankings Snapshots**: Weekly rank history persistence via Prisma (`rankings_snapshots` table) powering MomentumSparkline and trend analysis. APIs: `/api/leagues/snapshots` (POST), `/api/leagues/rank-history` (GET).
-   **Premium Panels (Server-Side)**: Server-side computation of Tier (Contender/Rising/Mid Pack/Rebuilder/Playoff Threat), Win Window (Now/1-2 Years/2-3 Years/Flexible), and What Changed summaries via `lib/rankings-engine/premium-panels.ts`.
-   **Momentum Sparkline**: SVG-based rank trend visualization component with directional color coding (green=improving, red=declining).
-   **Model Drift Storage**: `rankings_weights_snapshot` table for V3 adaptive weight learning with metrics and rollback reasons.
-   **Draft Grades Engine**: Deterministic V1 draft grading using post_draft composite + market/power components with percentile-based scoring, letter grades (A+ to F), and upsert persistence. Engine: `lib/rankings-engine/draft-grades.ts`. API: `/api/leagues/[leagueId]/draft-grades`.
-   **Hall of Fame / All-Time Leaderboard**: Multi-season leaderboard with championships (55%), dominance (30%), longevity (10%), efficiency (5%) weighting. SeasonResult persistence, HallOfFameRow rebuild, and season-specific leaderboard views. Engine: `lib/rankings-engine/hall-of-fame.ts`. APIs: `/api/leagues/[leagueId]/season-results`, `/api/leagues/[leagueId]/hall-of-fame`.
-   **V3 Weights Module**: Guardrailed weight management with defaults, normalization, clamped deltas (max 0.03), snapshot persistence, and rollback support. Engine: `lib/rankings-engine/v3-weights.ts`. API: `/api/leagues/[leagueId]/v3/weights`.
-   **Drift Metrics Module**: Model health monitoring recording ECE, Brier, AUC, PSI, narrative fail rate per day. Engine: `lib/rankings-engine/drift-metrics.ts`. API: `/api/leagues/[leagueId]/v3/drift`. UI: `DriftDashboard` component.
-   **Premium UI Layer**: `lib/api.ts` fetch helpers, `useLeagueRankingsPremium` hook orchestrating heatmap/profiles/history, `RankingsPremiumSection` orchestrator, `RankingsPremiumRow` (heatmap + tier/window/sparkline), `PartnerProfilesGrid`.
-   **Community & Gamification**: Community Insights Feed and an Achievement Badge System.
-   **Usage Analytics & Telemetry**: Full observability via `withApiUsage` wrapper on all 154+ API route exports (352 references). `ApiUsageEvent`/`ApiUsageRollup` models with 4-bucket rollup (hour/day/week/month). Client-side `logLegacyToolUsage` (lib/telemetry/client.ts) for fire-and-forget legacy tool tracking. `useAnalytics` hook auto-bridges `trackToolUse` to `/api/admin/usage/log`. `UsageAnalyticsPanel` supports global and league-scoped views with configurable defaults and Top-N cards (endpoints, tools, leagues, error rates, p95). `/api/admin/usage/summary` endpoint for Top-N grouped metrics. Intentional exclusions: health, test-keys, CORS OPTIONS handlers.
-   **Enhanced Admin Dashboards**: All 7 admin sections upgraded with Top-N cards, executable quick actions, and real-time metrics. AdminOverview has "Right Now" 60min strip, clickable health deep-links, executable Quick Actions (HoF rebuild, calibration, data sync), and Top Regions list. AdminSignups has staleness alerts, conversion funnel, Top Sources/Days cards. AdminTools has per-tool usage/error/p95 metrics with Top-N cards. AIIssueBacklog has Top-N cards (tools, severities, categories), SLO lens, and bulk triage. AdminQuestionnaire has empty state CTA, Top Answers by question, date/question filters. AdminEmail has send history placeholder, safety rails (confirmation >50 recipients, test send, char count). AdminCalibration/ModelDrift have actionable checklists replacing "Insufficient Data" and quick health strips.

## External Dependencies
-   **OpenAI**: For general AI analysis.
-   **Grok**: For social media post generation.
-   **PostgreSQL**: Primary database.
-   **Sleeper API**: For importing user league data.
-   **Rolling Insights Sports API**: Primary NFL sports data.
-   **API-Sports.io**: Secondary NFL data, primary for injuries.
-   **TheSportsDB API**: Tertiary sports data fallback.
-   **ESPN API**: Quaternary sports data fallback, primary for live scores and news.
-   **CollegeFootballData.com API (CFBD)**: College Football data.
-   **Resend**: For email notifications.
-   **OpenWeatherMap API**: For game-day weather data.
-   **NewsAPI.org**: Secondary news source.
-   **Community Trade Value Data**: Locally stored historical NFL player and pick values.
-   **Etsy Shop Integration**: Displays AllFantasy merchandise from `artbyciege.etsy.com`.