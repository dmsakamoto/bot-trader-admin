# Parachute Admin Dashboard — Design Spec

**Date:** 2026-04-14
**Status:** Draft
**Author:** Derek Sakamoto + Claude

## Overview

Internal admin dashboard for monitoring and analyzing the Parachute bot fleet. A separate Next.js app deployed on Vercel that reads the same Supabase instance as bot-trader-web. No new tables, no Kalshi API calls, no external dependencies beyond Supabase. This is an operator tool — audience is Derek only (for now).

**Motivation:** Today's operational workflow involves SSH-ing into VPSes, running ad-hoc Supabase queries, and manually cross-referencing heartbeats, configs, and scans to diagnose issues. The admin dashboard replaces all of that with a single persistent view of fleet health, performance, and configuration.

**Repo:** New standalone repo (`parachute-admin` or similar). Not embedded in bot-trader-web.

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Parachute Admin                        │
│                   (Next.js on Vercel)                    │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌───────┐ ┌──────────┐  │
│  │   Fleet    │ │  Account   │ │Config │ │  Alerts  │  │
│  │  Overview  │ │  Detail    │ │Compare│ │          │  │
│  └────────────┘ └────────────┘ └───────┘ └──────────┘  │
│                                                          │
│  Auth: Supabase (existing users, ADMIN_USER_IDS gate)   │
└──────────────────┬───────────────────────────────────────┘
                   │ reads only (service role key)
                   ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                            │
│  (same instance as bot-trader-web)                       │
│                                                          │
│  accounts, bot_instances, bot_heartbeat, bot_control,    │
│  bot_trading_config, bot_config_versions, kalshi_fills,  │
│  kalshi_settlements, market_scans, execution_runs,       │
│  execution_orders, alert_log                             │
└─────────────────────────────────────────────────────────┘
```

## Auth

Supabase auth against the existing auth system. The admin app has its own login page with email/password. After authentication, middleware checks the user's Supabase `auth.uid()` against an `ADMIN_USER_IDS` environment variable (comma-separated list of allowed user IDs). Users not on the list get a 403. No new auth tables needed.

**Admin users:** `dmsakamoto@gmail.com` and `derek@parachute.fund` (look up their Supabase `auth.users` IDs for the env var).

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL      # Same Supabase instance
NEXT_PUBLIC_SUPABASE_ANON_KEY # For client-side auth flow
SUPABASE_SERVICE_ROLE_KEY     # For server-side data reads (bypasses RLS)
ADMIN_USER_IDS                # Comma-separated Supabase user IDs
```

No Kalshi credentials, no encryption keys, no external API keys.

## Pages

### Fleet Overview (`/`)

The landing page. A table with one row per bot instance showing real-time fleet health at a glance.

**Columns per row:**
- Customer name (from `accounts`)
- VPS: IP, provider, region (from `bot_instances`)
- Instance status: running / stopped / error / provisioning (from `bot_instances`)
- Last heartbeat age with color coding: green (<5 min), yellow (5-15 min), red (>15 min)
- Bot status: running / scan_only / stopped (from `bot_heartbeat.status`)
- Volume regime: NORMAL / ELEVATED / SPIKE / COOLDOWN / RECOVERY (from `bot_heartbeat.volume_regime`)
- Signals detected in last run (from `bot_heartbeat.signals_detected`)
- Open exposure in cents (from `bot_heartbeat.open_exposure_cents`)
- Kill switch state (from `bot_control.kill_switch`)
- Config version: deployed (from `bot_trading_config.version`) vs actual (from `bot_heartbeat.config_snapshot.version`), highlighted red on mismatch
- Daily P&L in cents and % return (from `kalshi_settlements` aggregated today, normalized by `max_portfolio_exposure`)
- Trailing 7-day Sharpe ratio

**Row styling:**
- Red background: heartbeat stale >15 min, instance status `error`, or config version mismatch
- Yellow background: heartbeat 5-15 min stale, regime SPIKE/COOLDOWN
- Green: everything healthy

**Data sources:** 6 parallel Supabase queries on page load — `bot_instances`, latest `bot_heartbeat` per account, `bot_control`, `bot_trading_config` (active), `accounts`, and `kalshi_settlements` (today + trailing 7 days for Sharpe).

### Account Detail (`/accounts/[accountId]`)

Deep dive into a single account. Everything needed to diagnose a problem without opening a terminal. Reached by clicking a row on Fleet Overview.

**Sections:**

**Status bar** — Customer name, VPS IP, instance status, heartbeat age, kill switch, volume regime. Same data as fleet row but larger/more prominent.

**Performance cards** — Today's P&L (cents + %), trailing 7-day P&L, trailing 30-day P&L, 7-day Sharpe, 30-day Sharpe. Both raw cents and % normalized on `max_portfolio_exposure`.

**Daily P&L chart** — Bar chart of daily P&L over the last 30 days. Each bar colored green/red.

**Heartbeat history** — Table of the last 50 heartbeats showing: timestamp, status, signals detected, open exposure, daily P&L, volume regime, fail-safe status/reason, and config_snapshot version. Useful for spotting regime cycling (like the LLC issue today).

**Recent scans** — Table of the last 100 `market_scans` showing: ticker, timestamp, signal_side, edge, fair_value, base_fair_value, micro_edge_score, dynamic_edge_floor, gate_result, gate_values (expandable), and closest_failing_gate. Filterable by gate_result (passed / rejected / specific gate).

**Recent fills & settlements** — Last 50 fills (ticker, side, action, contracts, price, time, origin) and last 50 settlements (ticker, result, P&L, time, origin). Combined or tabbed view.

**Active trading config** — Full config displayed in grouped sections matching the 14 accordion groups from bot-trader-web's Bot Control page. Shows deployed version number and deployed_at timestamp.

**Config version history** — Table of all deploys from `bot_config_versions` showing version, deployed_at, and the diff (field-level changes).

### Config Comparison (`/configs`)

Compare active configs across accounts to spot outliers and correlate with performance.

**Layout:** Designed for up to 20 accounts. A multi-select picker at the top lets you choose 2-5 accounts to compare side by side. The comparison renders as a table where each column is a selected account and each row is one of the ~83 config parameters. Grouped by the same 14 categories as the Bot Control page (Risk, Probability Bands, Order Execution, etc.).

Below the picker, a summary table shows all accounts with their key config values (daily_loss_limit, kelly_multiplier, max_position_size, order_type_priority) and performance metrics, so you can quickly identify which accounts to compare in detail.

**Highlighting:** Cells that differ from the most common value among selected accounts get a colored background. This makes outliers immediately visible.

**Performance header row:** Above the config parameters, show each selected account's trailing 7-day P&L %, 30-day P&L %, and Sharpe ratio. This lets you visually correlate config differences with performance outcomes.

**Future:** This page is the foundation for backtesting. Once you can see which configs perform differently, the next step is "what if Matt used Dan's kelly_multiplier?" That's a later phase.

### Alerts (`/alerts`)

Historical view of the `alert_log` table.

**Layout:** Paginated table showing: timestamp, account name, alert type (stale_heartbeat / daily_loss / kill_switch / sync_failure), and details JSON expanded inline.

**Filters:** By account (dropdown) and by alert type (checkboxes). Date range picker for historical analysis.

## Performance Metrics

Computed from existing Supabase data, no Kalshi API calls.

### Daily P&L
Sum of `kalshi_settlements.pnl_cents` grouped by `date_trunc('day', settled_time)` per account. Already a generated column in the table.

### % Return (config basis)
`daily_pnl_cents / max_portfolio_exposure * 100` where `max_portfolio_exposure` comes from the active `bot_trading_config`. This normalizes across accounts with different capital levels.

### Sharpe Ratio
Same formula as bot-trader-web's `computeSharpe()`: mean daily return / standard deviation of daily returns, annualized by `sqrt(365)`. Computed over trailing 7-day and 30-day windows. Input is the array of daily % returns (config basis).

## Tech Stack

- **Framework:** Next.js (App Router), same major version as bot-trader-web
- **Styling:** Tailwind CSS, dark mode only
- **Charts:** Recharts (same as bot-trader-web)
- **Database:** Supabase JS client (service role for data reads, anon key for auth)
- **Deployment:** Vercel + GitHub
- **Fonts:** Geist Sans / Geist Mono (same as bot-trader-web)

## What This App Does NOT Do

- No writes to any table (read-only)
- No Kalshi API calls (no credentials needed)
- No bot provisioning or updating (existing scripts handle that)
- No customer-facing features
- No cron jobs (bot-trader-web owns all crons)
- No realtime subscriptions in MVP (fetch on page load, manual refresh)

## Future Phases (Out of Scope for MVP)

- **Auto-refresh:** Polling interval (30s) or Supabase realtime subscriptions on `bot_heartbeat` for auto-refreshing fleet status without manual reload.
- **Write operations:** Toggle kill switch, deploy config changes, fix config errors directly from the admin app instead of going through the customer dashboard or Supabase.
- **Backtesting engine:** Simulate config changes against historical market_scans data. "What would Matt's P&L be if kelly_multiplier was 0.25?"
- **Strategy comparison:** As new algorithms are added, compare performance across strategies, not just config variations.
- **Plugin system:** Modular strategy components that can be mixed and matched per account.
- **% return on actual balance:** Reconstruct account capital from fill history for a second normalization basis beyond `max_portfolio_exposure`.
- **Resource monitoring:** CPU/memory per bot VPS, beyond heartbeat-level health.
