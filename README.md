# bot-trader-admin

Internal read-only admin dashboard for the Parachute bot fleet. Reads Supabase (same instance as bot-trader-web); no writes. Next.js 16 App Router on Vercel.

## Setup

1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in values.
3. `pnpm dev` → http://localhost:3000

## Deployment

Auto-deploys from `main` via Vercel. Env vars managed in Vercel project settings — mirror `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USER_IDS`
- `NEXT_PUBLIC_SENTRY_DSN` (optional; enables Sentry error monitoring when set)

**First-time setup:** Vercel dashboard → Add New → Project → import this repo → Framework: Next.js (auto-detected) → paste the required env vars (Sentry is optional) → Deploy.

## Docs

- Design spec: `docs/superpowers/specs/2026-04-14-admin-dashboard-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-14-admin-dashboard-implementation.md`
- Architecture + deferred TODOs: `CLAUDE.md`
