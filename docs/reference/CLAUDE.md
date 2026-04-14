# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint via next lint
npx vitest run       # Run unit tests
npx vitest           # Run tests in watch mode
npm start            # Run production build
npx supabase db push # Push migrations to remote Supabase

# Connectivity test — verifies full credential pipeline (Supabase → decrypt → sign → Kalshi API)
node scripts/test-kalshi-connection.mjs
```

## Architecture

Next.js 16 App Router dashboard for monitoring a Kalshi crypto trading bot. Deployed on Vercel with Supabase for auth, storage, and realtime. Public landing page at `/` with lead capture form.

### Pages

- **Landing page** (`/`) — Public marketing page for Parachute Bot Trader. Sections: Hero, Ticker, Features ("Your Software"), How It Works, Pricing (3 tiers: Self-Hosted, Cloud, Scale), Lead Form, Footer. Lead form saves to `leads` table.
- **Login** (`/login`) — Sign-in only, no self-registration. Invite-only access. Three modes: login (default), forgot password (`Forgot password?` link), set password (`?mode=set-password`, reached via recovery link).
- **Auth callback** (`/auth/callback`) — Client-side page that handles Supabase implicit flow hash fragments. Parses `#access_token=...&type=recovery`, calls `setSession()`, redirects to set-password or dashboard. Root layout inline script detects hash fragments on any page and redirects here.
- **Dashboard** (`/dashboard/*`) — Authenticated dashboard with collapsible sidebar. Uses **client-side tab routing** via `DashboardShell` — views mount on first visit and stay alive (hidden via CSS), so switching tabs is instant with no re-rendering. Owners see 6 tabs (Overview, Positions, History, Analysis, Bot Control, Settings). Viewers see 5 (Bot Control hidden). View components live in `app/dashboard/_views/`. The `page.tsx` files return null (shell handles rendering). Browser back/forward works via `pushState` + `popstate`. Tab state initializes to `'overview'` for consistent SSR hydration, then syncs to actual URL in `useEffect`.
  - **Overview** — Row 1: Total Balance (available + portfolio, green), Today's P&L, Win Rate, Open Positions (green when >0). Row 2: Signals Detected (with "out of X scanned" subtitle from `market_scans`), Scans Ran (count of `execution_runs` today), Bot Status, Kill Switch. Recent Trades (last 5, fills show `Nx @ Xc` format, settlements show P&L). Bot Activity (last 5 heartbeats).
  - **Positions** — Live BTC/ETH price cards (WebSocket via `CryptoPriceProvider`), balance summary cards (Available, Portfolio Value, Total), 3-hour candlestick chart (Recharts, 1-minute candles from Coinbase Exchange API, BTC/ETH toggle, strike-price overlays for open positions), position table with hoverable row highlighting.
    - **Position signal detail** — bot positions are expandable (inline accordion) showing the signal decision trail per consolidated entry. Data fetched eagerly on page load via `GET /api/kalshi/positions/signals` (bulk endpoint joining kalshi_fills → execution_orders → market_scans → trades). Entry time column shows earliest fill timestamp for all positions. Key files: `components/positions/PositionSignalDetail.tsx`, `app/api/kalshi/positions/signals/route.ts`, `lib/types/signalDetail.ts`.
  - **History** — Stat cards (Settlements, Total P&L, Win Rate, Sharpe Ratio with tooltip). Cumulative P&L chart. Hourly P&L heatmap (GitHub contribution graph style, 7 days, 4x6 day blocks). Trade history table with filtering/sorting/pagination.
  - **Analysis** — Decision quality analysis. Three sections: Non-Executed Trades (toggled: Rejected signals that would have won/lost, and Scan-Only mode missed opportunities with hourly win rate chart), Bot Loss Analysis (which gates let losers through? three-level drill-down), Early Sell Analysis (did owner interventions help or hurt?). Shared date range filter (7d/30d/90d/All) and series filter (BTC/ETH/All). Data from `market_scans`, `kalshi_settlements`, `kalshi_fills`, `execution_runs`.
  - **Bot Control** (owner-only) — ProcessStatus (heartbeat, PID, hostname, metrics), KillSwitch toggle with confirmation, TickerBlacklist (add/remove patterns with expiry), Trading Configuration (lock→unlock→edit→save→deploy workflow for ~83 trading parameters in 14 accordion groups, owner-only, hidden from viewers), ExecutionDiagnostics (fill rate, funnel, skip reasons, slippage charts).

### Data flow

- **Kalshi data sync**: `POST /api/kalshi/sync` fetches fills and settlements from the Kalshi API and upserts them into Supabase (`kalshi_fills`, `kalshi_settlements`). The sync filters to crypto tickers only and data after 2026-02-17. The Overview and History pages read from these Supabase tables, not the Kalshi API directly. Sync is triggered on page load via the `useKalshiSync` hook.
- **Kalshi API proxy routes** (`app/api/kalshi/*`) still exist for direct Kalshi access (positions, balance, orders, and debugging fills/settlements). Credentials never reach the client. Each route loads credentials from Supabase, instantiates `KalshiClient`, and forwards the request with RSA-PSS signing.
- **Bot telemetry** (the `trades`, `execution_runs`, `bot_heartbeat`, `market_scans` tables) is written by the bot process (separate repo). The `trades` table records what the bot *thinks* it did — `kalshi_fills` records what *actually* happened on Kalshi. `bot_heartbeat` includes fail-safe status columns (015). `market_scans` includes decision pipeline columns for fine-tuning analysis — base fair value, momentum shift, ITM bias, micro edge score, Kelly sizing, gate results (016).
- **Reconciliation**: `GET /api/kalshi/reconciliation` compares `kalshi_fills` against bot `trades` using ticker, side, and a 60-second timestamp window to surface discrepancies.
- **Lead capture**: `POST /api/leads` saves name, email, Kalshi account status, and investment basis to the `leads` table. Public (anon insert via RLS).
- **Profile**: `GET/POST /api/settings/profile` reads/updates `first_name`, `last_name`, `avatar_emoji`. Role-aware: owners use `accounts` table, viewers use `account_viewers` table. Default emoji: `🙂` (owners), `🔭` (viewers).
- **Viewer invites**: `POST /api/settings/viewers` auto-creates Supabase auth users if they don't exist, sends branded invite emails via Resend. `PATCH` resends invite. `GET` enriches viewer list with emails via `getUserById()`.
- **Password reset**: `POST /api/auth/reset-password` generates recovery link via Supabase admin API, sends via Resend. Rate limited (3/email/hour). Always returns success to prevent enumeration.
- **Login audit**: `POST /api/auth/log-login` logs login events with IP/user-agent. Uses service role client. 5-minute dedup. `LoginLogger` component fires on dashboard load.
- **Trading config**: `GET/PUT /api/bot/config` reads/updates the draft config. `POST /api/bot/config/deploy` copies draft→active with version history. `GET /api/bot/config/versions` returns deploy audit trail. Two rows per account in `bot_trading_config` (draft + active). 83 typed columns across 14 groups with CHECK constraints and cross-field validation. Owner-only.
- **Bot bundle** (`GET /api/bot/bundle`): Single endpoint consolidating all control-plane data for bot instances. Authenticated via per-bot API token (SHA-256 hashed in `bot_api_tokens` table). Returns kill switch state, active ticker blacklist, active trading config, and server-computed daily P&L (from `kalshi_settlements`, bot-origin, ET day boundary). Bot calls this once per loop instead of reading `bot_control`, `ticker_blacklist`, and `bot_trading_config` directly. Uses service role client (not user session).
- **Bot token** (`POST /api/bot/token`): Mints a scoped 24h Supabase JWT for bot instances. Authenticated via bot API token. JWT contains `account_id` claim; RLS policies (migration 030) restrict DB access to the bot's own account. Bot calls on startup and refreshes 1h before expiry. Replaces service role key on VPS.
- **Bot credentials** (`GET /api/bot/credentials`): Returns decrypted Kalshi API credentials (key ID, PEM, API base). Authenticated via bot API token. Bot calls on startup and retries on Kalshi auth failure (credential rotation). Audit-logged. Replaces local credential files on VPS.
- **Retention cleanup**: `POST /api/admin/retention` deletes old rows from high-volume telemetry tables. Triggered daily at 4AM UTC by Vercel Cron (`vercel.json`). Protected by `CRON_SECRET`. Retention: `market_scans` 30d, `rejected_signals` 30d, `bot_heartbeat` 14d, `execution_orders` 90d, `execution_runs` 90d. Deletes in batches of 10K to avoid locks.
- **Alerting**: `POST /api/admin/alerts` checks all accounts every 5 min (Vercel Cron). Alerts: stale heartbeat (15 min), daily loss limit exceeded (per-account from `bot_trading_config`), kill switch active, sync failure (no execution_runs in 15 min, market hours only). Email via Resend. 1 alert per type per account per day, tracked in `alert_log` table.
- **Settlement sync cron**: `POST /api/admin/sync-settlements` runs at :07 past every hour (`7 * * * *`), with a runtime market hours guard (9AM-5PM ET, DST-aware via `America/New_York` timezone). Fetches settlements from Kalshi API for all accounts with credentials, upserts to `kalshi_settlements`. Settlements only — no fills, no origin tagging (rows land as `origin='pending'`). The bundle endpoint includes both `'bot'` and `'pending'` origin in its daily P&L calculation so cron-synced settlements are counted. Protected by `CRON_SECRET`.
- **Supabase queries** happen both server-side (API routes using `lib/supabase/server.ts`) and client-side (hooks using `lib/supabase/client.ts`). RLS policies enforce access control at the database level.
- **Realtime** subscriptions (bot heartbeats) use Supabase postgres_changes on the client. Presence uses Supabase Realtime presence channels (`presence:account:{accountId}`) for live user indicators.
- **Email**: Transactional emails (viewer invites, password reset) sent via Resend API (`lib/email/resend.ts`). HTML templates built inline in `lib/email/templates.ts`. Supabase auth emails (confirm signup, magic link, etc.) use Resend SMTP configured in Supabase dashboard.
- **Crypto prices**: `CryptoPriceProvider` (`components/crypto/CryptoPriceProvider.tsx`) wraps `DashboardShell` and connects to Coinbase WebSocket for BTC-USD and ETH-USD on login. Consumers use `useBtcPrice()` / `useEthPrice()` hooks. Prices are instant on Positions page since WebSocket is already connected.
- **Crypto candles**: `GET /api/crypto/candles?product=BTC-USD` proxies the Coinbase Exchange REST API (`api.exchange.coinbase.com`) for 1-minute candles (last 3 hours). Public endpoint, no auth. CDN-cached with `public, s-maxage=30, stale-while-revalidate=60`.
- **Strike price parsing**: `lib/utils/parseStrikePrice.ts` extracts asset type and strike price from Kalshi crypto tickers (e.g., `KXBTCD-26MAR2416-T70599.99` → `{ asset: 'BTC', strike: 70599.99 }`).
- **Stripe webhook**: `POST /api/webhooks/stripe` receives Stripe events (invoice.paid, payment_failed, subscription.updated/deleted) and updates `accounts.subscription_status`. Verifies signature via `STRIPE_WEBHOOK_SECRET`.
- **Onboarding**: `POST /api/onboarding/provision` creates DB rows needed before VPS provisioning: bot API token (hash in `bot_api_tokens`), `bot_control` row (kill switch off), `bot_instances` row (status `'provisioning'`). Called after trading config deploy in the wizard. Raw token stays server-side. Note: each customer ends up with 2 bot API tokens — one from the wizard (unused) and one from `provision-bot.sh` (used on VPS). `POST /api/onboarding/complete` stamps `onboarding_completed_at` after first heartbeat, gating wizard vs dashboard display.

### Auth & roles

Two roles enforced by RLS: **owner** (full access) and **viewer** (read-only). The `useAccountRole()` hook determines role by checking the `accounts` table (owner) then `account_viewers` table (viewer). If neither exists, it auto-creates an owner account via upsert. Login page is sign-in only — no self-registration. Viewers are invited by owners via email; if the user doesn't have a Supabase auth account, one is auto-created. Viewer profiles (name, emoji) are stored on `account_viewers`, not `accounts`.

### Kalshi API signing

`lib/kalshi/auth.ts` signs every request with RSA-PSS SHA-256. The signature message is `timestamp + method + fullPath` where `fullPath` must include the `/trade-api/v2/` prefix (e.g., `/trade-api/v2/portfolio/balance`). The API base URL is `https://api.elections.kalshi.com/trade-api/v2`.

### P&L calculation

P&L is computed in the `kalshi_settlements` table via a Postgres generated column: `pnl_cents = (winning side payout) - yesCost - noCost - feeCents`. The History page reads this directly. Total P&L also subtracts fill fees. Only crypto tickers are included (prefixes: `KXBTC`, `KXETH`, `KXBTCD`, `KXETHD`). Data is filtered to after 2026-02-17. Raw Kalshi API data is still accessible via the proxy routes (`/api/kalshi/fills`, `/api/kalshi/settlements`) for debugging.

### API route pattern

All Kalshi proxy routes follow: authenticate user → `loadKalshiCredentials()` → instantiate `KalshiClient` → call Kalshi → return response or 502. Write operations (orders, bot control) additionally verify ownership before proceeding.

## Design

See `docs/design-brief.md` for the full design brief. Key principles:

- **Brand tone**: Innovative yet relaxed. Confident, not aggressive. AI handles the grunt work so users can relax.
- **Dark/light/system mode**: Tailwind `class` strategy with `dark:` prefixes. Three modes: `system` (default, follows OS `prefers-color-scheme`), `light`, `dark`. Mode persists in localStorage as `theme`. `next/script` with `strategy="beforeInteractive"` inside `<body>` in `layout.tsx` applies the correct class before paint to prevent flash (must be inside `<body>` in App Router, not between `<html>` and `<body>`). 700ms transition on toggle.
- **Fonts**: Geist Sans (body) and Geist Mono (numbers/tickers/code) via the `geist` package.
- **Colors**: Emerald/teal accents on deep slate (dark) or clean white (light). Flat card backgrounds (`dark:bg-slate-900/80`), no heavy gradients on data surfaces.
- **Light mode text**: Black (`text-slate-900`) for values, `text-slate-600` for secondary, `text-slate-400` minimum for tertiary. No lighter grays.
- **Motion**: 700ms theme transitions, smooth scroll, subtle landing page animations. Nothing snaps. Dashboard uses 500ms page fade-in, 200ms content crossfade, 30ms staggered card entrance, animated sidebar active state.

### Layout components

- **DashboardShell** (`components/dashboard/DashboardShell.tsx`) — Core SPA shell. Manages active tab state, lazy-loads views, keeps visited tabs mounted. Renders Sidebar, Header, and all views. Wraps content with `CryptoPriceProvider` for WebSocket price preloading.
- **Sidebar** (`components/layout/Sidebar.tsx`) — Collapsible (w-52 expanded, w-16 collapsed). Auto-collapses on screens < 1024px (tablets/mobile) via `useIsMobile` hook with `matchMedia`. Gradient active state with animated transitions. Receives `activeTab`/`onNavigate` props from DashboardShell (no Next.js `<Link>` — uses buttons + `pushState`). Prefetches data on hover. Role-aware: hides Bot Control for viewers.
- **Header** (`components/layout/Header.tsx`) — h-14, page title + subtitle (from `activeTab` prop), Live indicator with real-time presence avatars, theme toggle, user menu dropdown.
- **UserMenu** (`components/layout/UserMenu.tsx`) — Avatar dropdown with profile editing via shared `ProfileEditor` component in portal modal.
- **ProfileEditor** (`components/settings/ProfileEditor.tsx`) — Shared emoji picker + name fields. Used in UserMenu (compact) and Settings page (full). Emoji palette: `['🙂', '😎', '🚀', '💰', '👷‍♀️', '🎯', '⚡', '🍻', '🧠', '🔥', '💎', '🐯', '🐕', '🎲', '📈', '🍑']`.
- **StatCard** (`components/layout/StatCard.tsx`) — Color-aware cards with light/dark gradients.
- **ThemeToggle** (`components/theme/ThemeToggle.tsx`) — Cycles system (monitor icon) → light (sun) → dark (moon) with rotate/scale animation.
- **ThemeProvider** (`components/theme/ThemeProvider.tsx`) — React context with three modes (`system`/`light`/`dark`). Exposes `mode`, `resolvedTheme`, `setMode`, and legacy `toggleTheme`. Listens for OS `prefers-color-scheme` changes when in system mode. localStorage persistence and 700ms transition class.

## Key conventions

- `'use client'` directive on all client components; pages and layouts are server components by default
- Hooks return `{ data, loading, error }` pattern
- Supabase queries use `.maybeSingle()` for lookups that may not exist
- API routes return 401 (unauthed), 403 (not owner), 404 (no credentials), 502 (Kalshi error)
- Database migrations are numbered sequentially in `supabase/migrations/` (currently 001–032). See `supabase/MIGRATIONS.md` for the full inventory, dependency graph, and table summaries. This repo owns all migrations; `kalshi-bot` keeps a synced copy.
- Private keys are encrypted with AES-256-GCM before storage in the `kalshi_private_key_pem_encrypted` column. Encryption/decryption happens in `lib/kalshi/crypto.ts`. Credential writes go through `POST /api/settings/credentials` (server-side). Legacy plaintext PEM keys are auto-detected on load and will be encrypted on next save.
- All UI components support both light and dark mode via `dark:` Tailwind prefixes
- Modals that need to escape `overflow-hidden` containers use `createPortal` to render on `document.body`
- **Supabase query pagination** — Supabase returns max 1000 rows by default with NO warning. Any query on growing tables (`kalshi_fills`, `kalshi_settlements`, `execution_orders`, `market_scans`) must paginate with `.range(offset, offset + PAGE_SIZE - 1)`. Avoid large `.in()` clauses (600+ values hit PostgREST URL length limits) — fetch all and filter in-memory instead.
- **Session cache** (`lib/cache/sessionCache.ts`) — in-memory cache that persists across client-side navigations. Hooks and components initialize state from cache for instant renders on return visits, then fetch fresh data in background. Cache clears on page refresh.
- **Browser caching** — read-only API routes (balance, positions, fills, settlements, bot/status) return `Cache-Control: private, max-age=15, stale-while-revalidate=60` headers
- **Dashboard prefetch** (`components/auth/DashboardPrefetch.tsx`) — warms the session cache 1.5s after login for Positions and Bot Control data
- **Shared UI components** (`components/shared/`): `SideBadge` (yes/no badge), `SkeletonCards` (loading stat cards), `SkeletonTable` (loading table placeholder), `EmptyState` (no-data card), `GradientBar` (red percentage bar). Used across analytics, positions, and history.
- **Shared formatters** (`lib/utils/format.ts`): `dollarFmt` (Intl formatter), `fmtCents` (cents→$), `fmtPct` (fraction→%), `fmtTime` (ISO→"Mar 5, 3:04 PM"), `fmtShortTime` (ISO→"3:04 PM"), `fmtDollars` (raw $), `fmtCentsSigned` (cents→"+$1.23"), `relativeTime` (ISO→"5m ago"). The old `components/analytics/_formatters.ts` re-exports from here.
- **Shared utilities** (`lib/utils/`):
  - `consolidateFills.ts` — groups partial fills by ticker+side+minute into single rows with weighted avg price. Used by `useTradeHistory` (full key with action) and `OverviewView` (simple key without action).
  - `origin.ts` — `originEmoji(origin)` returns 🤖/👤/❓. Used by `PositionRow` and `TradeHistoryTable`.
  - `parseStrikePrice.ts` — extracts asset and strike from Kalshi tickers.
  - `parseTickerHour.ts` — extracts ET hour from daily crypto tickers (KXBTCD/KXETHD).
  - `stats.ts` — `computeSharpe()` for Sharpe ratio calculation.
- **Memoization** — derived computations in hooks and views (filtering, sorting, summaries) must be wrapped in `useMemo`. `Intl.NumberFormat` instances must be hoisted to module level, not created per call.
- **ESLint** — uses `eslint.config.mjs` (flat config for ESLint 9 / Next.js 16). Run via `npm run lint`.

## Origin Filter (Bot vs Owner Attribution)

A global origin filter in the dashboard header lets users view trades attributed to the bot (🤖), the owner (👤), or all combined. Origin is determined during Kalshi sync by cross-referencing fill `order_id`s against the bot's `execution_orders` table.

### How it works
- `kalshi_fills` and `kalshi_settlements` tables have an `origin` column: `'bot'`, `'owner'`, or `'pending'`
- The sync endpoint (`app/api/kalshi/sync/route.ts`) tags origin using `tagFillOrigin()` and `tagSettlementOrigin()` from `app/api/kalshi/sync/origin.ts`
- Settlement origin is assigned to whichever origin holds the majority of contracts for that ticker
- Global filter state lives in `OriginFilterProvider` (`lib/hooks/useOriginFilter.tsx`), consumed via `useOriginFilter()` hook
- URL synced via `?origin=bot` / `?origin=owner` query param

### Per-page behavior
- **Overview:** Today's P&L and Win Rate filter. All other cards stay constant.
- **Positions:** Table rows and Portfolio Value filter. Sum row always shows full portfolio. Origin emoji is the first column. Realized P&L column removed.
- **History:** Full filtering — stat cards, charts, and trade table all filter.
- **Analytics / Bot Control / Settings:** No filter effect.

### Key files
- `components/layout/OriginToggle.tsx` — pill toggle (desktop) + dropdown (mobile)
- `lib/hooks/useOriginFilter.tsx` — React context + hook
- `app/api/kalshi/sync/origin.ts` — origin tagging logic
- `supabase/migrations/018_origin_attribution.sql` — origin column + indexes

## Architecture Decisions

### Trading config handshake (decided 2026-03-28, updated 2026-04-01)
**Decision:** Bot fetches all control-plane data (kill switch, ticker blacklist, trading config, daily P&L) via a single `GET /api/bot/bundle` call each loop. Authenticated by per-bot API token. No direct Supabase reads for control-plane data.

**Draft → Deploy model:** Config edits save as a draft. Owner must explicitly "Deploy" to mark a config version as active. Bot only reads the active version (via bundle endpoint). This gives version history and rollback for free.

**UI security flow:** Locked by default → unlock to view → edit → save (updates draft, returns to view) → deploy (from view mode, shows diff, confirms). Save and Deploy are separate steps.

**KalshiBot handoff:** Bot calls `GET /api/bot/bundle` with its API token each loop. See `docs/handoff/bot-bundle-endpoint.md` for response schema and migration guide.

**If this doesn't work:** If 2-minute polling delay is too slow for the kill switch, we could add a separate Supabase Realtime subscription for `bot_control` as a hybrid approach alongside the bundle endpoint.

## Testing

- **Framework**: Vitest + @testing-library/react, configured in `vitest.config.ts`
- **Tests live alongside code**: `lib/hooks/__tests__/useProfile.test.ts`
- **Run**: `npx vitest run` (CI) or `npx vitest` (watch mode)

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CREDENTIALS_ENCRYPTION_KEY    # 32-byte hex (64 chars) for AES-256-GCM encryption of private keys
RESEND_API_KEY                # Resend API key for transactional emails (viewer invites, password reset)
CRON_SECRET                   # Vercel Cron secret for admin endpoints (retention cleanup)
BOT_API_TOKEN                 # Per-bot API token for /api/bot/bundle authentication (bot-side only)
STRIPE_SECRET_KEY             # Stripe API secret key (server-side only)
STRIPE_WEBHOOK_SECRET         # Webhook signature verification
SUPABASE_JWT_SECRET           # Supabase JWT secret for minting bot-scoped JWTs (Settings > API in dashboard)
```

## TODO

### P0
- [x] Scan-only mode triggers — bot manages all state transitions internally (volume spike, daily loss, fail-safe) based on thresholds in `bot_trading_config`. Dashboard displays the reason via `volume_regime`, `config_snapshot.scan_only_reason`, and `config_snapshot.daily_loss_stop_active` from heartbeat. Shared utility `lib/utils/botStatusReason.ts`. "May be down" warning at 15min stale.
- [x] Trading variables interface — `bot_trading_config` table (021), `bot_config_versions` audit trail, 83 typed columns across 14 groups (including ITM Bias via 022). Draft/active two-row model. API routes: GET/PUT `/api/bot/config`, POST `/api/bot/config/deploy`, GET `/api/bot/config/versions`. Lock→unlock→edit→save→deploy UI on Bot Control page. KalshiBot handoff at `docs/handoff/trading-config-kalshi-bot.md`.

### P1
- [x] New user onboarding + bot provisioning — guided setup wizard, Stripe billing, Docker provisioning
- [x] Email notifications for lead form submissions — auto-sends welcome email with Calendly link (or Kalshi signup + Calendly if no account). Notifies `derek@parachute.fund` on every submission.
- [x] Multi-account support — `AccountProvider` context replaces `useAccountRole` internals. Account switcher in user menu, `?account=` URL param, all API routes accept `account_id` via `resolveAccountAccess` utility. Viewer indicator in header.
- [x] Alerting system — `POST /api/admin/alerts` cron (every 5 min). Stale heartbeat (15 min), daily loss limit (per-account from `bot_trading_config`), kill switch, sync failure (market hours). Email via Resend, 1 alert/type/account/day. `alert_log` table (027) for cooldown tracking.
- [x] Error tracking — Sentry (`@sentry/nextjs`) with error monitoring, tracing (10% prod), session replay (10% baseline, 100% on error). Global error boundary in `app/global-error.tsx`. Source maps via `withSentryConfig()`. Tunnel route at `/monitoring`.
- [x] Health endpoint — `GET /api/health` checking Supabase connectivity + bot heartbeat freshness. Needed for uptime monitoring.
- [x] Uptime monitoring — UptimeRobot on `GET /api/health` with per-account `?account_id=` support for 5-minute checks + email alerts.
- [x] Environment validation — `instrumentation.ts` checks all required env vars on server startup and logs missing ones.
- [x] Settlement sync cron — `POST /api/admin/sync-settlements` at :07 past each market hour. Ensures bundle P&L is fresh for daily loss limit without depending on dashboard page loads. Uses same Kalshi API credentials (shares rate budget with bot).
- [ ] Kill switch UX redesign — current toggle is ambiguous, hard to tell if it activated or deactivated. Needs unmistakable visual feedback on state change (this is a safety control, not a preference toggle).

### P2 — Done
- [x] Kalshi API retry logic — exponential backoff (500ms, 1s) for transient failures (429, 5xx) on GET requests. POST requests (orders) are not retried.
- [x] React error boundaries — `ViewErrorBoundary` wraps each dashboard view in `DashboardShell`. Errors are captured by Sentry with view name tag.
- [x] Rate limiting on API routes — `lib/rateLimit.ts` shared utility. Applied to `/api/leads` (5/IP/hour) and `/api/kalshi/orders` (10/user/min).
- [x] Structured logging — `lib/logger.ts` outputs JSON lines with request ID, user ID, path, timing. Compatible with Vercel log drains.
- [x] Audit trail — `audit_log` table (028). `lib/audit.ts` utility. Wired into kill switch toggle, config deploy, credential updates.
- [x] Role check on PositionRow Close button — `canClose` now checks `isOwner` prop passed from `PositionTable`.

### P2 — Before next customer (mechanical)
- [x] Provisioning script (`scripts/provision-bot.sh`) — automates VPS setup: Docker install, repo clone, .env generation, key decryption, docker compose up, bot_instances record.
- [x] Subscription payment failure alerting — Stripe `invoice.payment_failed` webhook sends email to customer + owner with invoice link.
- [x] Verify `execution_orders.phase` value — confirmed actual values: `limit_place`, `reprice_limit`, `market_fallback`, `final_cancel`. Fixed resting conversion filter from `'resting'` → `'reprice_limit'`.
- [x] Bot update script (`scripts/update-all-bots.sh`) — reads `bot_instances` table, SSHs into each, git pull + rebuild + restart. Supports `--provider`/`--region` filters and `--dry-run`.

### P2 — Before 5 customers
- [x] Bot instance health reconciliation — integrated into `/api/admin/alerts` cron. Sets `bot_instances.status` to `'error'` when heartbeat is stale (>15 min).
- [x] Customer self-service credential rotation — bot fetches Kalshi credentials from `GET /api/bot/credentials` at startup. Customer updates in Settings, bot picks up on next auth failure. No SSH needed.
- [x] Per-account scoped Supabase keys — bot uses scoped 24h JWT (minted via `POST /api/bot/token`) instead of service role key. RLS restricts access to own account. Migration 030.
- [x] Customer subscription management — Stripe Customer Portal link in Settings page. `POST /api/stripe/portal` creates a session, redirects customer. Handles payment method, invoices, cancellation.
- [x] Customer-facing compliance docs — Terms of Service (`/terms`), Privacy Policy (`/privacy`), Risk Disclosure (`/risk-disclosure`). Wizard Step 0 requires acceptance before onboarding. `terms_accepted_at` on accounts (migration 029). Footer links + pricing disclaimer.

### P2 — Before 20 customers
- [x] CI/CD on kalshi-bot — GitHub Actions builds Docker image on push to main, deploys on version tags via rolling SSH to `bot_instances`. Bot auth rewrite: scoped JWT (`AUTH_MODE=token`), remote credential fetch, no service role key on VPS. LLC droplet live on token mode.
- [ ] Self-service checkout — "Buy Now" buttons on pricing page, skip Calendly for customers who don't need a guided call.
- [ ] Automated bot provisioning from dashboard — one-click VPS spin-up from admin panel instead of manual SSH.
- [ ] ~~Dashboard admin panel~~ — moved to separate `parachute-admin` app. See `docs/superpowers/specs/2026-04-14-admin-dashboard-design.md`.
- [ ] ~~Resource monitoring~~ — moved to separate `parachute-admin` app (future phase).
- [ ] Self-Hosted quickstart doc (`SELF_HOSTED_QUICKSTART.md`) — step-by-step guide for customers running the bot on their own infrastructure.
- [ ] SLA tiers / version pinning — per-tier service levels, bot version pinning for enterprise customers. Ties into Stripe subscription tiers.

### P2 — Nice to have
- [x] Bot writes `run_id` to `market_scans` — implemented in kalshi-bot, confirmed live. New scans have non-NULL `run_id`. Historical rows still NULL (no backfill needed).
- [ ] Reconciliation UI — surface unmatched fills/trades from existing `reconcile_fills()`/`reconcile_trades()` SQL functions in the dashboard.
- [ ] Fun/interactive trading variable controls — make the config editor more engaging (sliders, visualizations, animations). Current MVP uses collapsible accordions with standard inputs.
- [ ] Image upload for user avatar (Supabase Storage) — currently emoji-only
- [ ] CDN caching for Coinbase candles API — currently `public, s-maxage=30` but handles 10+ users fine via Vercel CDN
- [ ] Slack webhook alerts — add Slack as an optional alert channel alongside email in `/api/admin/alerts`. Mechanical.
