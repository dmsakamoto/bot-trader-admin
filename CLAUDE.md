@AGENTS.md

# bot-trader-admin

Internal read-only admin dashboard for the Parachute bot fleet. Reads Supabase (same instance as bot-trader-web); no writes. Next.js 16 App Router on Vercel.

## Commands

```bash
pnpm dev          # start dev server (localhost:3000)
pnpm build        # production build
pnpm start        # run production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:watch   # vitest in watch mode
```

## Key files

- **Design spec:** `docs/superpowers/specs/2026-04-14-admin-dashboard-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-04-14-admin-dashboard-implementation.md`
- **Reference files (source-of-truth from bot-trader-web):** `docs/reference/`
  - `stats.ts`, `format.ts` — copied into `lib/utils/`
  - `tradingConfig.ts` — copied into `lib/types/`
  - `tradingConfigSchema.ts` — copied into `lib/config/schema.ts`

## Architecture

- **Auth:** Supabase auth on `/login` (anon key, client-side) + root `middleware.ts` gate that checks `user.id` against `ADMIN_USER_IDS` env var. Non-admins get 403.
- **Data:** All reads go through `lib/queries/*` using `createServiceClient()` (service-role key, bypasses RLS). Never import service-role client from client components — `lib/supabase/server.ts` enforces this with `import 'server-only'`.
- **Pages:** `/` Fleet Overview → `/accounts/[id]` Account Detail → `/configs` Config Comparison → `/alerts`.
- **Metrics:** `computeSharpe` (√252 annualized, takes cents), `aggregateDailyPnl`, `trailingPnl`, `pctReturn`. Settlements filtered to `origin IN ('bot','pending')` everywhere.
- **Trading config:** `bot_trading_config` has 2 rows per account (`status: 'draft' | 'active'`). All queries filter `.eq('status', 'active')`. Config rendering uses `TRADING_CONFIG_SCHEMA` (14 groups × 69 UI-exposed vars) for labels/units.
- **Version history:** `bot_config_versions.diff` is pre-computed (`Record<string, {from, to}>`) — we read it directly, no client-side diffing.
- **Error monitoring:** Sentry (`@sentry/nextjs`) with global error boundary at `app/global-error.tsx`. Tunnel route at `/monitoring` (set via `withSentryConfig` in `next.config.ts`) proxies events to Sentry so ad-blockers don't drop them. SDK no-ops when `NEXT_PUBLIC_SENTRY_DSN` is unset.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # server-only, bypasses RLS
ADMIN_USER_IDS                  # comma-separated Supabase user UUIDs
NEXT_PUBLIC_SENTRY_DSN          # optional; enables Sentry when set
SENTRY_AUTH_TOKEN               # optional; Vercel-only, enables source-map upload
```

Template: `.env.example`. Local dev: `.env.local` (gitignored).

## Conventions

- Server components by default. `'use client'` only where React state/effects or Recharts are needed.
- Hand-written DB row types in `lib/types/db.ts` — expand as needed when queries touch new columns. `tradingConfig.ts` is the sole exception (copied verbatim from bot-trader-web).
- Tailwind v3 with `darkMode: 'class'`. App is dark-only; `<html className="dark">` in `app/layout.tsx`.
- Use `React.Fragment key={x}` (not `<>…</>`) when mapping sibling `<Tr>` rows — Tr primitives are table rows, and Fragment shorthand can't accept a key.
- `Th` / `Td` require `children`; for empty cells use `<Th>{' '}</Th>`.
- Commit style: conventional commits (`feat:`, `chore:`, `fix:`, `test:`).

## TODO (deferred)

**Auth UX (minor remaining):**
- Exclude `_next/data/*` in the proxy matcher to stop RSC-prefetch redirect noise.
- `isAdmin(userId)` trims env entries but not the `userId` argument — theoretical hardening if ever relevant.

**Backend reach:**
- Supabase queries don't paginate; they rely on `.limit(50)` / `.limit(100)` or date windows. If any scope expands beyond the MVP (e.g. more accounts, longer history), add pagination per bot-trader-web's convention.

## What NOT to add

Per the design spec, this app is deliberately **read-only**. Do not add write endpoints, kill-switch toggles, config editors, or Kalshi credentials. Those belong in bot-trader-web or a later phase. If a use case comes up that wants a write, open a design discussion first.
