# Parachute Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Next.js admin dashboard (`parachute-admin`) on Vercel that reads the existing Supabase instance to monitor the Parachute bot fleet across four pages: Fleet Overview, Account Detail, Config Comparison, and Alerts.

**Architecture:** Next.js App Router with server components for all data fetching (service-role key server-side only). Supabase auth via anon key on a single `/login` page, then Next middleware gates everything else by checking the authenticated user ID against `ADMIN_USER_IDS`. Performance metrics (Sharpe, % return) computed in pure TypeScript modules with unit tests. Recharts for the daily P&L chart. Tailwind dark-only.

**Tech Stack (pinned to bot-trader-web):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v3.4, `@supabase/ssr` ^0.5.2 + `@supabase/supabase-js` ^2.47, Recharts ^2.15, Vitest 4, `geist` ^1.7 (npm package, not `next/font/google`), `date-fns-tz` ^3.2, Vercel deploy.

**Spec reference:** `docs/superpowers/specs/2026-04-14-admin-dashboard-design.md`
**Authoritative references in this repo:** `docs/reference/` — `package.json`, `stats.ts`, `format.ts`, `tradingConfig.ts`, `tradingConfigSchema.ts`, `globals.css`, `tsconfig.json`, `eslint.config.mjs`, `vercel.json`, `CLAUDE.md`. Where a task says "copy verbatim from docs/reference/X", do exactly that — these are the source of truth for formulas, types, and config schema.

## Key facts learned from reference (must be respected throughout)

1. **`bot_trading_config` is NOT a JSON blob.** It's 83 typed columns on the row itself (see `docs/reference/tradingConfig.ts` → `TradingConfigRow`). Two rows per account: `status = 'draft'` and `status = 'active'`. Every query that wants the deployed config must filter `.eq('status', 'active')`.
2. **`bot_config_versions.diff` is pre-computed** as `Record<string, { from: unknown; to: unknown }> | null`. Do not recompute diffs client-side — read this field.
3. **`computeSharpe` uses `Math.sqrt(252)`** (not 365), returns `null` (not 0) when std is 0, and takes **daily P&L in cents directly** (not percentage returns). The spec's phrasing ("array of daily % returns") was approximate — prod uses cents.
4. **`kalshi_settlements` has an `origin` column** (`'bot' | 'owner' | 'pending'`). The bundle endpoint includes both `'bot'` and `'pending'`. For admin fleet/account metrics, follow the same rule: `origin IN ('bot','pending')`. The settlement-sync cron lands rows as `'pending'` — excluding those would undercount.
5. **14 accordion groups, 83 params, labels + units + validation** all live in `docs/reference/tradingConfigSchema.ts`. That file is copied verbatim in Task 13.
6. **Formatters** (`fmtCents`, `fmtPct`, `fmtTime`, etc.) are copied verbatim from `docs/reference/format.ts` (Task 8b). Tasks that had inline ad-hoc `fmtCents` should use the shared module.

---

---

## Conventions used throughout this plan

- **Working dir:** `/Users/dereksakamoto/workspace/bot-trader-admin` (this repo). All paths below are relative to it.
- **Package manager:** `pnpm`. If the user prefers npm/yarn, substitute uniformly.
- **Node version:** 20+ (Next 15 requires it).
- **Commit style:** Conventional commits (`feat:`, `chore:`, `test:`, `fix:`). One commit per task minimum; commit after each passing test group.
- **Testing:** Vitest for pure logic. UI not unit-tested — verified by running `pnpm dev` and clicking through. Tasks that are pure logic use full TDD (failing test → implement → pass → commit). Tasks that are UI wiring have a "run dev server and visually verify" step instead.
- **Type-check gate:** After each task, `pnpm tsc --noEmit` must pass before committing.

---

## File Structure

The repo will end up like this. Refer back here when any task says "create file X".

```
bot-trader-admin/
├── .env.local                        # gitignored, local dev secrets
├── .env.example                      # committed template
├── .gitignore
├── README.md                         # overwrite the existing stub
├── next.config.ts
├── tsconfig.json
├── package.json
├── postcss.config.mjs
├── vitest.config.ts
├── middleware.ts                     # admin gate
├── app/
│   ├── layout.tsx                    # root layout: fonts, dark theme, nav
│   ├── globals.css                   # tailwind + theme vars
│   ├── page.tsx                      # Fleet Overview (/)
│   ├── login/
│   │   └── page.tsx                  # email/password login
│   ├── accounts/
│   │   └── [accountId]/
│   │       └── page.tsx              # Account Detail
│   ├── configs/
│   │   └── page.tsx                  # Config Comparison
│   ├── alerts/
│   │   └── page.tsx                  # Alerts
│   └── api/
│       └── auth/
│           ├── callback/route.ts     # supabase auth callback
│           └── signout/route.ts      # POST to sign out
├── lib/
│   ├── supabase/
│   │   ├── server.ts                 # server client factory (service role)
│   │   ├── browser.ts                # browser client factory (anon)
│   │   └── middleware.ts             # middleware client helper
│   ├── auth/
│   │   └── admin.ts                  # isAdmin(userId) helper
│   ├── utils/
│   │   ├── stats.ts                  # computeSharpe — copied from bot-trader-web
│   │   └── format.ts                 # fmtCents, fmtPct, fmtTime — copied from bot-trader-web
│   ├── metrics/
│   │   ├── pnl.ts                    # aggregateDailyPnl, pctReturn, trailingPnl
│   │   └── types.ts
│   ├── queries/
│   │   ├── fleet.ts                  # getFleetOverview()
│   │   ├── account.ts                # getAccountDetail(accountId)
│   │   ├── configs.ts                # getConfigSummary()
│   │   └── alerts.ts                 # getAlerts(filters)
│   ├── config/
│   │   └── schema.ts                 # 14 groups × 83 vars — copied from bot-trader-web
│   └── types/
│       ├── tradingConfig.ts          # TradingConfigRow — copied from bot-trader-web
│       └── db.ts                     # hand-written row types for other tables
├── components/
│   ├── nav.tsx
│   ├── fleet/
│   │   └── fleet-table.tsx
│   ├── account/
│   │   ├── status-bar.tsx
│   │   ├── performance-cards.tsx
│   │   ├── pnl-chart.tsx
│   │   ├── heartbeat-table.tsx
│   │   ├── scans-table.tsx
│   │   ├── fills-settlements.tsx
│   │   ├── active-config.tsx
│   │   └── version-history.tsx
│   ├── configs/
│   │   ├── summary-table.tsx
│   │   └── comparison-table.tsx
│   ├── alerts/
│   │   └── alerts-table.tsx
│   └── ui/
│       ├── table.tsx                 # shared table primitives
│       ├── badge.tsx                 # status badges
│       └── filters.tsx               # checkbox / dropdown / date-range
└── tests/
    ├── sharpe.test.ts
    ├── pnl.test.ts
    └── admin.test.ts
```

**File responsibilities** — each module should stay focused:
- `lib/supabase/*` is the only place that constructs Supabase clients.
- `lib/queries/*` is the only place that issues DB queries. Pages import from here.
- `lib/metrics/*` and `lib/config/diff.ts` are pure functions — no I/O, fully tested.
- `components/*` never imports `@supabase/*` directly; they receive data as props.

---

## Prerequisite: collect Supabase credentials

Before Task 1, obtain from the bot-trader-web project or Supabase dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (project settings → API → service_role secret)
- Supabase `auth.users.id` UUIDs for `dmsakamoto@gmail.com` and `derek@parachute.fund`
  - Run in Supabase SQL editor: `select id, email from auth.users where email in ('dmsakamoto@gmail.com','derek@parachute.fund');`
  - `ADMIN_USER_IDS` = both UUIDs comma-separated, no spaces.

Keep these in a scratchpad — you'll paste them into `.env.local` in Task 2.

---

## Phase 1 — Foundation (Tasks 1–6)

### Task 1: Bootstrap Next.js project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`
- Modify: `README.md`

- [ ] **Step 1: Confirm directory is empty (except docs + README + .git)**

Run: `ls -A`
Expected output includes only: `.DS_Store .git README.md docs`
If anything else is present, stop and investigate before proceeding.

- [ ] **Step 2: Scaffold Next.js into current directory**

Run:
```bash
pnpm dlx create-next-app@16 . --ts --tailwind --eslint --app --src-dir=false --import-alias='@/*' --use-pnpm --no-turbopack
```
When prompted "Would you like to customize the default import alias?" → No.
When prompted about overwriting `README.md` → Yes.

Expected: installer completes, `package.json`, `app/`, `public/`, `tsconfig.json`, `.gitignore`, `eslint.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts` created.

**Pin Tailwind to v3** — create-next-app may install v4. Check `package.json`. If `tailwindcss` resolves to `^4.x.x`, downgrade:
```bash
pnpm remove tailwindcss @tailwindcss/postcss 2>/dev/null
pnpm add -D tailwindcss@^3.4.1 autoprefixer@^10.4.27 postcss@^8
```
Then overwrite `postcss.config.mjs` with the v3 format:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```
And overwrite `tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Verify dev server boots**

Run: `pnpm dev`
Open `http://localhost:3000` in a browser. Expect the Next.js welcome page. Then Ctrl-C.

- [ ] **Step 4: Replace README.md**

Overwrite `README.md` with:
```markdown
# parachute-admin

Internal read-only admin dashboard for the Parachute bot fleet. Reads Supabase; no writes.

## Setup
1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in values.
3. `pnpm dev` → http://localhost:3000

Design spec: `docs/superpowers/specs/2026-04-14-admin-dashboard-design.md`
```

- [ ] **Step 5: Ensure `.DS_Store` is gitignored**

Append to `.gitignore`:
```
.DS_Store
.env.local
```
(`.env*` may already be present; verify `.env.local` is covered.)

- [ ] **Step 6: Commit**

```bash
git rm --cached docs/.DS_Store 2>/dev/null || true
git add -A
git commit -m "chore: bootstrap next.js app"
```

---

### Task 2: Environment variables & `.env.example`

**Files:**
- Create: `.env.example`, `.env.local`

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase — same instance as bot-trader-web
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Bypasses RLS. NEVER expose to client bundle.
SUPABASE_SERVICE_ROLE_KEY=

# Comma-separated Supabase auth.users.id UUIDs allowed to use this app.
ADMIN_USER_IDS=
```

- [ ] **Step 2: Create `.env.local`**

Copy `.env.example` to `.env.local` and fill in the four values collected in the prerequisite step. Do NOT commit this file.

- [ ] **Step 3: Verify .env.local is gitignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (meaning it is ignored).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore: add env var template"
```

---

### Task 3: Install core dependencies

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Add runtime deps (versions pinned to match bot-trader-web)**

Run:
```bash
pnpm add '@supabase/supabase-js@^2.47.10' '@supabase/ssr@^0.5.2' 'recharts@^2.15.0' 'date-fns@^4' 'date-fns-tz@^3.2.0' 'geist@^1.7.0' server-only
```

- [ ] **Step 2: Add dev deps**

Run:
```bash
pnpm add -D 'vitest@^4.1.0' '@vitest/ui' '@types/node@^20'
```

- [ ] **Step 3: Add scripts**

Edit `package.json` `scripts` section to include:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 5: Smoke-test vitest**

Create `tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
describe('smoke', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

Run: `pnpm test`
Expected: `1 passed`.

- [ ] **Step 6: Delete smoke test and commit**

```bash
rm tests/smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add supabase, recharts, date-fns, vitest"
```

---

### Task 4: DB row types (copy trading config from reference, hand-write the rest)

**Files:**
- Create: `lib/types/tradingConfig.ts` (copy), `lib/types/db.ts`

Rationale: `lib/types/tradingConfig.ts` is the prod contract — copy it verbatim rather than re-typing. For the remaining tables we don't have reference types yet, so we hand-write a minimal shape used by this app.

- [ ] **Step 1: Copy `lib/types/tradingConfig.ts` from reference**

```bash
mkdir -p lib/types
cp docs/reference/tradingConfig.ts lib/types/tradingConfig.ts
```

This gives us `TradingConfigRow` (83 columns + `status: 'draft' | 'active'`), `CONFIG_META_KEYS`, `TradingConfigResponse`, `ConfigVersionEntry` (with pre-computed `diff`), and `DeployResponse`.

- [ ] **Step 2: Create `lib/types/db.ts` for the other tables**

```typescript
// Minimal DB row shapes for tables NOT covered by lib/types/tradingConfig.ts.
// If a column is missing when a task needs it, add it here and commit alongside
// the task that needs it. Keep this in sync with the Supabase schema.

export type Uuid = string;
export type Timestamp = string; // ISO 8601 string as returned by supabase-js

export interface AccountRow {
  id: Uuid;
  customer_name: string;
  email: string | null;
  created_at: Timestamp;
}

export type InstanceStatus = 'running' | 'stopped' | 'error' | 'provisioning';

export interface BotInstanceRow {
  id: Uuid;
  account_id: Uuid;
  vps_ip: string | null;
  vps_provider: string | null;
  vps_region: string | null;
  status: InstanceStatus;
  created_at: Timestamp;
}

export type BotStatus = 'running' | 'scan_only' | 'stopped';
export type VolumeRegime = 'NORMAL' | 'ELEVATED' | 'SPIKE' | 'COOLDOWN' | 'RECOVERY';

export interface BotHeartbeatRow {
  id: Uuid;
  account_id: Uuid;
  created_at: Timestamp;
  status: BotStatus;
  volume_regime: VolumeRegime | null;
  signals_detected: number;
  open_exposure_cents: number;
  daily_pnl_cents: number | null;
  fail_safe_status: string | null;
  fail_safe_reason: string | null;
  config_snapshot: { version: number | null; [key: string]: unknown } | null;
}

export interface BotControlRow {
  account_id: Uuid;
  kill_switch: boolean;
  updated_at: Timestamp;
}

// Alias for the version audit row — lib/types/tradingConfig.ts's ConfigVersionEntry
// models the API response; this one models the Supabase row.
export interface BotConfigVersionRow {
  id: Uuid;
  account_id: Uuid;
  version: number;
  deployed_at: Timestamp;
  deployed_by: string | null;
  config_snapshot: Record<string, unknown>;
  diff: Record<string, { from: unknown; to: unknown }> | null;
}

export type Origin = 'bot' | 'owner' | 'pending';

export interface KalshiFillRow {
  id: Uuid;
  account_id: Uuid;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  contracts: number;
  price_cents: number;
  filled_time: Timestamp;
  origin: Origin | null;
}

export interface KalshiSettlementRow {
  id: Uuid;
  account_id: Uuid;
  ticker: string;
  result: 'yes' | 'no';
  pnl_cents: number;
  settled_time: Timestamp;
  origin: Origin | null;
}

export interface MarketScanRow {
  id: Uuid;
  account_id: Uuid;
  ticker: string;
  created_at: Timestamp;
  signal_side: 'yes' | 'no' | null;
  edge: number | null;
  fair_value: number | null;
  base_fair_value: number | null;
  micro_edge_score: number | null;
  dynamic_edge_floor: number | null;
  gate_result: 'passed' | 'rejected' | null;
  gate_values: Record<string, unknown> | null;
  closest_failing_gate: string | null;
}

export type AlertType =
  | 'stale_heartbeat'
  | 'daily_loss'
  | 'kill_switch'
  | 'sync_failure';

export interface AlertLogRow {
  id: Uuid;
  account_id: Uuid;
  created_at: Timestamp;
  alert_type: AlertType;
  details: Record<string, unknown>;
}
```

- [ ] **Step 3: Typecheck & commit**

```bash
pnpm typecheck
git add lib/types
git commit -m "feat: add db row types (trading config copied from reference)"
```

---

### Task 5: Supabase client factories

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`

Two separate clients: server uses the **service role** key (bypasses RLS — we're admin-only). Browser uses the **anon** key (for auth flow only — no data reads from the client).

- [ ] **Step 1: Create `lib/supabase/server.ts`**

```typescript
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server data client: uses SERVICE_ROLE_KEY, bypasses RLS.
// Never import this in a client component.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServerClient(url, key, {
    cookies: { getAll() { return []; }, setAll() {} },
  });
}

// Server auth client: uses anon key + request cookies to read the current user.
export async function createAuthClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options));
        } catch {
          // Called from a server component where cookies are read-only — ignore.
        }
      },
    },
  });
}
```

- [ ] **Step 2: Create `lib/supabase/browser.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create `lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
```

- [ ] **Step 4: Typecheck & commit**

```bash
pnpm typecheck
git add lib/supabase
git commit -m "feat: supabase client factories (service + browser + middleware)"
```

---

### Task 6: Admin gate (isAdmin helper + middleware + login)

**Files:**
- Create: `lib/auth/admin.ts`, `tests/admin.test.ts`, `middleware.ts`, `app/login/page.tsx`, `app/api/auth/callback/route.ts`, `app/api/auth/signout/route.ts`

- [ ] **Step 1: Write failing test for `isAdmin`**

Create `tests/admin.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdmin } from '@/lib/auth/admin';

describe('isAdmin', () => {
  const ORIGINAL = process.env.ADMIN_USER_IDS;
  beforeEach(() => { process.env.ADMIN_USER_IDS = 'aaa,bbb,ccc'; });
  afterEach(() => { process.env.ADMIN_USER_IDS = ORIGINAL; });

  it('returns true for a listed id', () => {
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false for an unlisted id', () => {
    expect(isAdmin('zzz')).toBe(false);
  });
  it('returns false for empty id', () => {
    expect(isAdmin('')).toBe(false);
  });
  it('trims whitespace in the env var', () => {
    process.env.ADMIN_USER_IDS = ' aaa , bbb ';
    expect(isAdmin('aaa')).toBe(true);
    expect(isAdmin('bbb')).toBe(true);
  });
  it('returns false when env var missing', () => {
    delete process.env.ADMIN_USER_IDS;
    expect(isAdmin('aaa')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — must fail (module not found)**

Run: `pnpm test tests/admin.test.ts`
Expected: FAIL — cannot find `@/lib/auth/admin`.

- [ ] **Step 3: Implement `lib/auth/admin.ts`**

```typescript
export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const raw = process.env.ADMIN_USER_IDS ?? '';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return allowed.includes(userId);
}
```

- [ ] **Step 4: Run test — must pass**

Run: `pnpm test tests/admin.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Create `middleware.ts` (at repo root)**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isAdmin } from '@/lib/auth/admin';

const PUBLIC_PATHS = ['/login', '/api/auth/callback', '/api/auth/signout'];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (!isAdmin(user.id)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [ ] **Step 6: Create `app/login/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100">
      <form onSubmit={onSubmit} className="w-80 space-y-4 p-6 rounded-lg border border-neutral-800">
        <h1 className="text-xl font-semibold">Parachute Admin</h1>
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
          type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2"
          type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2 disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Create `app/api/auth/callback/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createAuthClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/', request.url));
}
```

- [ ] **Step 8: Create `app/api/auth/signout/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { createAuthClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
```

- [ ] **Step 9: Manual verification**

Run: `pnpm dev`
- Visit `http://localhost:3000/` → should redirect to `/login`.
- Log in with an admin email/password → lands on `/` (which still shows the Next.js default page, that's fine for now).
- Log in with a non-admin Supabase user → should see `Forbidden` 403.

Stop dev server.

- [ ] **Step 10: Typecheck & commit**

```bash
pnpm typecheck
git add -A
git commit -m "feat: admin gate, login page, supabase auth callback"
```

---

## Phase 2 — Shared layout + metrics library (Tasks 7–9)

### Task 7: Root layout with nav, dark theme, Geist fonts

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (temporarily simplify)
- Create: `components/nav.tsx`

- [ ] **Step 1: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Nav } from '@/components/nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parachute Admin',
  description: 'Internal bot fleet monitor',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-neutral-950 text-neutral-100 min-h-screen`}>
        <Nav />
        <main className="max-w-[1600px] mx-auto px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `components/nav.tsx`**

```tsx
import Link from 'next/link';

const links = [
  { href: '/', label: 'Fleet' },
  { href: '/configs', label: 'Configs' },
  { href: '/alerts', label: 'Alerts' },
];

export function Nav() {
  return (
    <nav className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold">Parachute Admin</span>
          <div className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-neutral-400 hover:text-neutral-100">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-neutral-400 hover:text-neutral-100">Sign out</button>
        </form>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Replace `app/globals.css`**

Tailwind v3 uses `@tailwind` directives, not `@import`.
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: dark; }

html, body { height: 100%; }

.mono { font-family: var(--font-geist-mono); }
```

- [ ] **Step 4: Simplify `app/page.tsx` to a placeholder**

```tsx
export default function FleetPage() {
  return <h1 className="text-2xl font-semibold">Fleet Overview</h1>;
}
```

- [ ] **Step 5: Verify visually**

Run: `pnpm dev`. Log in. Confirm dark-themed nav with "Fleet / Configs / Alerts" links and "Sign out" button. Stop server.

- [ ] **Step 6: Commit**

```bash
pnpm typecheck
git add -A
git commit -m "feat: dark root layout with nav and Geist fonts"
```

---

### Task 8: Copy shared utilities — Sharpe + formatters

**Files:**
- Create: `lib/metrics/types.ts`, `lib/utils/stats.ts` (copy), `lib/utils/format.ts` (copy), `tests/sharpe.test.ts`

Both files are prod-tested in bot-trader-web. Copy verbatim, then add a sanity test.

- [ ] **Step 1: Copy from reference**

```bash
mkdir -p lib/metrics lib/utils
cp docs/reference/stats.ts lib/utils/stats.ts
cp docs/reference/format.ts lib/utils/format.ts
```

- [ ] **Step 2: Create `lib/metrics/types.ts`**

```typescript
// Per-day aggregated P&L, used by charts and Sharpe input.
export interface DailyPnl { date: string; pnlCents: number; }
```

- [ ] **Step 3: Write sanity test `tests/sharpe.test.ts`**

Important constraints that match the reference (`docs/reference/stats.ts`):
- Annualization factor is **√252** (not √365)
- Returns **`null`** when stdev is zero (not 0)
- Input is **daily P&L in cents**, not percentages — the function is agnostic to units; we feed cents.

```typescript
import { describe, it, expect } from 'vitest';
import { computeSharpe } from '@/lib/utils/stats';

describe('computeSharpe', () => {
  it('returns null for empty array', () => {
    expect(computeSharpe([])).toBeNull();
  });
  it('returns null for a single data point', () => {
    expect(computeSharpe([100])).toBeNull();
  });
  it('returns null when all values identical (zero stdev)', () => {
    expect(computeSharpe([100, 100, 100, 100])).toBeNull();
  });
  it('matches expected value for a known cents series', () => {
    // dailyCents = [100, -100, 200, 0]
    // mean = 50, sample stdev ≈ 129.0994, annualized by sqrt(252)
    // expected ≈ 50 / 129.0994 * sqrt(252) ≈ 6.1478
    const result = computeSharpe([100, -100, 200, 0]);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(6.1478, 3);
  });
  it('is negative for net-losing series', () => {
    const s = computeSharpe([-100, -200, -150, -50]);
    expect(s).not.toBeNull();
    expect(s!).toBeLessThan(0);
  });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm test tests/sharpe.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics lib/utils tests/sharpe.test.ts
git commit -m "feat: copy computeSharpe and formatters from bot-trader-web"
```

---

### Task 9: Metrics utilities — P&L aggregation and % return

**Files:**
- Create: `lib/metrics/pnl.ts`, `tests/pnl.test.ts`

`DailyPnl` carries only `{ date, pnlCents }` — `%` is derived at the point of display via `pctReturn`.

- [ ] **Step 1: Write failing test `tests/pnl.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  aggregateDailyPnl, pctReturn, trailingPnl,
} from '@/lib/metrics/pnl';
import type { KalshiSettlementRow } from '@/lib/types/db';

function s(settled_time: string, pnl_cents: number): KalshiSettlementRow {
  return {
    id: Math.random().toString(36),
    account_id: 'acct',
    ticker: 'T',
    result: 'yes',
    pnl_cents,
    settled_time,
    origin: 'bot',
  };
}

describe('aggregateDailyPnl', () => {
  it('returns empty array for no settlements', () => {
    expect(aggregateDailyPnl([])).toEqual([]);
  });
  it('groups by UTC date and sums pnl, sorted ascending', () => {
    const rows = [
      s('2026-04-15T00:30:00Z', 200),
      s('2026-04-14T01:00:00Z', 100),
      s('2026-04-14T20:00:00Z', -50),
    ];
    expect(aggregateDailyPnl(rows)).toEqual([
      { date: '2026-04-14', pnlCents: 50 },
      { date: '2026-04-15', pnlCents: 200 },
    ]);
  });
});

describe('pctReturn', () => {
  it('divides cents by exposure', () => {
    expect(pctReturn(500, 10_000)).toBe(0.05);
  });
  it('returns 0 when exposure is 0', () => {
    expect(pctReturn(500, 0)).toBe(0);
  });
  it('returns 0 when exposure is null', () => {
    expect(pctReturn(500, null)).toBe(0);
  });
});

describe('trailingPnl', () => {
  const rows = [
    s('2026-04-10T12:00:00Z', 100),
    s('2026-04-12T12:00:00Z', 200),
    s('2026-04-14T12:00:00Z', 50),
  ];
  it('sums within window inclusive of now', () => {
    expect(trailingPnl(rows, new Date('2026-04-14T23:00:00Z'), 7)).toBe(350);
  });
  it('excludes settlements older than window', () => {
    expect(trailingPnl(rows, new Date('2026-04-14T23:00:00Z'), 2)).toBe(50);
  });
  it('returns 0 when none in window', () => {
    expect(trailingPnl(rows, new Date('2026-05-01T00:00:00Z'), 3)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `pnpm test tests/pnl.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/metrics/pnl.ts`**

```typescript
import type { KalshiSettlementRow } from '@/lib/types/db';
import type { DailyPnl } from '@/lib/metrics/types';

function isoDate(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

export function aggregateDailyPnl(settlements: KalshiSettlementRow[]): DailyPnl[] {
  const byDate = new Map<string, number>();
  for (const s of settlements) {
    const d = isoDate(new Date(s.settled_time));
    byDate.set(d, (byDate.get(d) ?? 0) + s.pnl_cents);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, pnlCents: byDate.get(date)! }));
}

export function pctReturn(pnlCents: number, exposureCents: number | null | undefined): number {
  if (!exposureCents) return 0;
  return pnlCents / exposureCents;
}

export function trailingPnl(
  settlements: KalshiSettlementRow[],
  now: Date,
  days: number,
): number {
  const cutoff = now.getTime() - days * 86_400_000;
  const nowMs = now.getTime();
  return settlements
    .filter((s) => {
      const t = new Date(s.settled_time).getTime();
      return t >= cutoff && t <= nowMs;
    })
    .reduce((acc, s) => acc + s.pnl_cents, 0);
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm test tests/pnl.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics/pnl.ts tests/pnl.test.ts
git commit -m "feat: aggregateDailyPnl, pctReturn, trailingPnl with tests"
```

---

## Phase 3 — Fleet Overview (Tasks 10–12)

### Task 10: Fleet query

**Files:**
- Create: `lib/queries/fleet.ts`

This task has no unit test — it's a straightforward composition over the Supabase client. Correctness is verified by page render in Task 12.

- [ ] **Step 1: Create `lib/queries/fleet.ts`**

```typescript
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { computeSharpe } from '@/lib/utils/stats';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import type {
  AccountRow, BotInstanceRow, BotHeartbeatRow, BotControlRow, KalshiSettlementRow,
} from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

export interface FleetRow {
  account: AccountRow;
  instance: BotInstanceRow | null;
  heartbeat: BotHeartbeatRow | null;
  control: BotControlRow | null;
  config: TradingConfigRow | null;
  todayPnlCents: number;
  todayPctReturn: number;
  sharpe7d: number | null;
  configMismatch: boolean;
}

export async function getFleetOverview(): Promise<FleetRow[]> {
  const db = createServiceClient();
  const now = new Date();
  const sevenDaysAgoIso = new Date(now.getTime() - 8 * 86_400_000).toISOString();

  const [accounts, instances, heartbeats, controls, configs, settlements] = await Promise.all([
    db.from('accounts').select('*').returns<AccountRow[]>(),
    db.from('bot_instances').select('*').returns<BotInstanceRow[]>(),
    db.from('bot_heartbeat')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<BotHeartbeatRow[]>(),
    db.from('bot_control').select('*').returns<BotControlRow[]>(),
    // IMPORTANT: bot_trading_config has 2 rows per account (draft + active).
    // We always want the deployed config. Filter by status='active'.
    db.from('bot_trading_config').select('*').eq('status', 'active').returns<TradingConfigRow[]>(),
    // Include both 'bot' and 'pending' origins to match bundle endpoint behavior
    // (cron-synced settlements land as 'pending' until the next bot sync).
    db.from('kalshi_settlements')
      .select('*')
      .in('origin', ['bot', 'pending'])
      .gte('settled_time', sevenDaysAgoIso)
      .returns<KalshiSettlementRow[]>(),
  ]);

  for (const q of [accounts, instances, heartbeats, controls, configs, settlements]) {
    if (q.error) throw q.error;
  }

  const latestHeartbeat = new Map<string, BotHeartbeatRow>();
  for (const hb of heartbeats.data ?? []) {
    if (!latestHeartbeat.has(hb.account_id)) latestHeartbeat.set(hb.account_id, hb);
  }
  const instanceByAccount = new Map((instances.data ?? []).map((i) => [i.account_id, i]));
  const controlByAccount = new Map((controls.data ?? []).map((c) => [c.account_id, c]));
  const configByAccount = new Map((configs.data ?? []).map((c) => [c.account_id, c]));
  const settlementsByAccount = new Map<string, KalshiSettlementRow[]>();
  for (const s of settlements.data ?? []) {
    const arr = settlementsByAccount.get(s.account_id) ?? [];
    arr.push(s); settlementsByAccount.set(s.account_id, arr);
  }

  return (accounts.data ?? []).map<FleetRow>((account) => {
    const hb = latestHeartbeat.get(account.id) ?? null;
    const cfg = configByAccount.get(account.id) ?? null;
    const settle = settlementsByAccount.get(account.id) ?? [];
    const todayPnlCents = trailingPnl(settle, now, 1);
    const exposure = cfg?.max_portfolio_exposure ?? 0;
    const daily = aggregateDailyPnl(settle);
    // Sharpe takes daily P&L in cents (per bot-trader-web's stats.ts).
    const sharpe7d = computeSharpe(daily.map((d) => d.pnlCents));
    const actualVersion = hb?.config_snapshot?.version ?? null;
    const configMismatch =
      cfg != null && actualVersion != null && cfg.version !== actualVersion;
    return {
      account,
      instance: instanceByAccount.get(account.id) ?? null,
      heartbeat: hb,
      control: controlByAccount.get(account.id) ?? null,
      config: cfg,
      todayPnlCents,
      todayPctReturn: pctReturn(todayPnlCents, exposure),
      sharpe7d,
      configMismatch,
    };
  });
}
```

- [ ] **Step 2: Typecheck & commit**

```bash
pnpm typecheck
git add lib/queries/fleet.ts
git commit -m "feat: getFleetOverview query"
```

---

### Task 11: Shared UI primitives (badge, table)

**Files:**
- Create: `components/ui/badge.tsx`, `components/ui/table.tsx`

- [ ] **Step 1: Create `components/ui/badge.tsx`**

```tsx
import { ReactNode } from 'react';

type Tone = 'neutral' | 'green' | 'yellow' | 'red' | 'blue';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-neutral-800 text-neutral-200',
  green: 'bg-green-900/50 text-green-300',
  yellow: 'bg-yellow-900/50 text-yellow-300',
  red: 'bg-red-900/50 text-red-300',
  blue: 'bg-blue-900/50 text-blue-300',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create `components/ui/table.tsx`**

```tsx
import { HTMLAttributes, ReactNode } from 'react';

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-800 ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-neutral-900 text-neutral-400 text-xs uppercase">{children}</thead>;
}
export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-medium ${className}`}>{children}</th>;
}
export function Tr(
  { children, tone, ...rest }: HTMLAttributes<HTMLTableRowElement> & { tone?: 'red' | 'yellow' | 'green' },
) {
  const toneClass =
    tone === 'red' ? 'bg-red-950/40' :
    tone === 'yellow' ? 'bg-yellow-950/30' :
    tone === 'green' ? '' : '';
  return <tr className={`border-t border-neutral-800 ${toneClass}`} {...rest}>{children}</tr>;
}
export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
```

- [ ] **Step 3: Commit**

```bash
pnpm typecheck
git add components/ui
git commit -m "feat: Badge and Table UI primitives"
```

---

### Task 12: Fleet Overview page

**Files:**
- Create: `components/fleet/fleet-table.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/fleet/fleet-table.tsx`**

```tsx
import Link from 'next/link';
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { FleetRow } from '@/lib/queries/fleet';

function heartbeatTone(hbIso: string | null | undefined): 'green' | 'yellow' | 'red' {
  if (!hbIso) return 'red';
  const ageMin = (Date.now() - new Date(hbIso).getTime()) / 60_000;
  if (ageMin > 15) return 'red';
  if (ageMin > 5) return 'yellow';
  return 'green';
}
function rowTone(r: FleetRow): 'red' | 'yellow' | 'green' | undefined {
  const hbTone = heartbeatTone(r.heartbeat?.created_at);
  if (hbTone === 'red') return 'red';
  if (r.instance?.status === 'error') return 'red';
  if (r.configMismatch) return 'red';
  if (hbTone === 'yellow') return 'yellow';
  const regime = r.heartbeat?.volume_regime;
  if (regime === 'SPIKE' || regime === 'COOLDOWN') return 'yellow';
  return 'green';
}
const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtPct = (p: number) => `${(p * 100).toFixed(2)}%`;

export function FleetTable({ rows }: { rows: FleetRow[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Customer</Th>
          <Th>VPS</Th>
          <Th>Instance</Th>
          <Th>Heartbeat</Th>
          <Th>Bot</Th>
          <Th>Regime</Th>
          <Th className="text-right">Signals</Th>
          <Th className="text-right">Open Exp</Th>
          <Th>Kill</Th>
          <Th>Config v</Th>
          <Th className="text-right">Today P&L</Th>
          <Th className="text-right">7d Sharpe</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((r) => {
          const hbTone = heartbeatTone(r.heartbeat?.created_at);
          const hbAge = r.heartbeat
            ? formatDistanceToNowStrict(new Date(r.heartbeat.created_at)) + ' ago'
            : 'never';
          const deployedV = r.config?.version ?? '—';
          const actualV = r.heartbeat?.config_snapshot?.version ?? '—';
          return (
            <Tr key={r.account.id} tone={rowTone(r)}>
              <Td>
                <Link href={`/accounts/${r.account.id}`} className="hover:underline">
                  {r.account.customer_name}
                </Link>
              </Td>
              <Td className="mono text-xs">
                {r.instance
                  ? `${r.instance.vps_ip ?? '—'} · ${r.instance.vps_provider ?? ''} ${r.instance.vps_region ?? ''}`
                  : '—'}
              </Td>
              <Td><Badge tone={r.instance?.status === 'running' ? 'green' : r.instance?.status === 'error' ? 'red' : 'neutral'}>{r.instance?.status ?? '—'}</Badge></Td>
              <Td><Badge tone={hbTone}>{hbAge}</Badge></Td>
              <Td>{r.heartbeat?.status ?? '—'}</Td>
              <Td>{r.heartbeat?.volume_regime ?? '—'}</Td>
              <Td className="text-right mono">{r.heartbeat?.signals_detected ?? 0}</Td>
              <Td className="text-right mono">{fmtCents(r.heartbeat?.open_exposure_cents ?? 0)}</Td>
              <Td>{r.control?.kill_switch ? <Badge tone="red">ON</Badge> : <Badge tone="green">off</Badge>}</Td>
              <Td className="mono text-xs">
                <span className={r.configMismatch ? 'text-red-300' : ''}>
                  {deployedV}{r.configMismatch ? ` → ${actualV}` : ''}
                </span>
              </Td>
              <Td className={`text-right mono ${r.todayPnlCents >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {fmtCents(r.todayPnlCents)} ({fmtPct(r.todayPctReturn)})
              </Td>
              <Td className="text-right mono">{r.sharpe7d == null ? '—' : r.sharpe7d.toFixed(2)}</Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
```

- [ ] **Step 2: Rewrite `app/page.tsx`**

```tsx
import { getFleetOverview } from '@/lib/queries/fleet';
import { FleetTable } from '@/components/fleet/fleet-table';

export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  const rows = await getFleetOverview();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Fleet Overview</h1>
      <p className="text-sm text-neutral-400">{rows.length} accounts</p>
      <FleetTable rows={rows} />
    </div>
  );
}
```

- [ ] **Step 3: Visual verification**

Run: `pnpm dev`. Log in. Confirm `/` shows a row per account, heartbeat ages color-coded, clicking a customer navigates to `/accounts/<id>` (404 is OK for now — next phase). Stop server.

- [ ] **Step 4: Commit**

```bash
pnpm typecheck
git add -A
git commit -m "feat: fleet overview page with colored health table"
```

---

## Phase 4 — Account Detail (Tasks 13–19)

### Task 13: Copy trading config schema (source of truth for 14 groups × 83 params)

**Files:**
- Create: `lib/config/schema.ts` (copy)

The reference file `docs/reference/tradingConfigSchema.ts` has the full 14-group × 83-variable catalog including labels, units, min/max, descriptions, enum options, and `validateVar`/`validateCrossField`. The admin app is read-only, so we only use the metadata for rendering (labels, units, descriptions). The validation helpers can stay — they'll be dead code but are cheap to keep in sync with bot-trader-web.

- [ ] **Step 1: Copy schema verbatim**

```bash
mkdir -p lib/config
cp docs/reference/tradingConfigSchema.ts lib/config/schema.ts
```

- [ ] **Step 2: Sanity-check counts**

Run:
```bash
node -e "const s = require('./lib/config/schema.ts'); /* tsx only — skip */ " 2>/dev/null || true
pnpm exec tsx -e "import('./lib/config/schema.ts').then(m => console.log('groups:', m.TRADING_CONFIG_SCHEMA.length, 'total vars:', m.TOTAL_CONFIG_VARS))"
```
If `tsx` is not installed, skip this — the typecheck in Step 3 is sufficient.

Expected (if run): `groups: 14 total vars: 83`.

- [ ] **Step 3: Typecheck & commit**

```bash
pnpm typecheck
git add lib/config/schema.ts
git commit -m "feat: copy trading config schema from bot-trader-web"
```

---

### Task 14: (removed — `bot_config_versions.diff` is pre-computed)

No diff utility needed. `bot_config_versions.diff` is a JSON column populated by the deploy API at write time (`Record<string, { from: unknown; to: unknown }> | null`). Task 18's `VersionHistory` reads this column directly. Skip this task.

---

### Task 15: Account detail query

**Files:**
- Create: `lib/queries/account.ts`

- [ ] **Step 1: Create `lib/queries/account.ts`**

```typescript
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { computeSharpe } from '@/lib/utils/stats';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import type {
  AccountRow, BotInstanceRow, BotHeartbeatRow, BotControlRow,
  BotConfigVersionRow, KalshiFillRow, KalshiSettlementRow, MarketScanRow,
} from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';
import type { DailyPnl } from '@/lib/metrics/types';

export interface AccountDetail {
  account: AccountRow;
  instance: BotInstanceRow | null;
  latestHeartbeat: BotHeartbeatRow | null;
  control: BotControlRow | null;
  activeConfig: TradingConfigRow | null;
  versions: BotConfigVersionRow[];
  heartbeats: BotHeartbeatRow[];         // last 50
  scans: MarketScanRow[];                // last 100
  fills: KalshiFillRow[];                // last 50
  settlements: KalshiSettlementRow[];    // last 50 (also drives metrics below)
  daily30: DailyPnl[];                   // last 30 days (cents-only, derive % at render)
  today: { cents: number; pct: number };
  week: { cents: number; pct: number };
  month: { cents: number; pct: number };
  sharpe7d: number | null;
  sharpe30d: number | null;
}

export async function getAccountDetail(accountId: string): Promise<AccountDetail | null> {
  const db = createServiceClient();
  const now = new Date();
  const thirtyOneDaysAgoIso = new Date(now.getTime() - 31 * 86_400_000).toISOString();

  const [account, instance, control, activeConfig, versions, heartbeats, scans, fills, settlements] =
    await Promise.all([
      db.from('accounts').select('*').eq('id', accountId).single<AccountRow>(),
      db.from('bot_instances').select('*').eq('account_id', accountId).maybeSingle<BotInstanceRow>(),
      db.from('bot_control').select('*').eq('account_id', accountId).maybeSingle<BotControlRow>(),
      // Filter to the deployed row — draft/active model means 2 rows per account.
      db.from('bot_trading_config').select('*').eq('account_id', accountId)
        .eq('status', 'active').maybeSingle<TradingConfigRow>(),
      db.from('bot_config_versions').select('*').eq('account_id', accountId)
        .order('deployed_at', { ascending: false }).returns<BotConfigVersionRow[]>(),
      db.from('bot_heartbeat').select('*').eq('account_id', accountId)
        .order('created_at', { ascending: false }).limit(50).returns<BotHeartbeatRow[]>(),
      db.from('market_scans').select('*').eq('account_id', accountId)
        .order('created_at', { ascending: false }).limit(100).returns<MarketScanRow[]>(),
      db.from('kalshi_fills').select('*').eq('account_id', accountId)
        .order('filled_time', { ascending: false }).limit(50).returns<KalshiFillRow[]>(),
      db.from('kalshi_settlements').select('*').eq('account_id', accountId)
        .in('origin', ['bot', 'pending'])
        .gte('settled_time', thirtyOneDaysAgoIso)
        .order('settled_time', { ascending: false }).returns<KalshiSettlementRow[]>(),
    ]);

  if (account.error) {
    if (account.error.code === 'PGRST116') return null; // not found
    throw account.error;
  }

  const settlementRows = settlements.data ?? [];
  const exposure = activeConfig.data?.max_portfolio_exposure ?? 0;
  const daily30 = aggregateDailyPnl(settlementRows);

  const todayC = trailingPnl(settlementRows, now, 1);
  const weekC = trailingPnl(settlementRows, now, 7);
  const monthC = trailingPnl(settlementRows, now, 30);

  const last7Cents = daily30.slice(-7).map((d) => d.pnlCents);
  const sharpe7d = computeSharpe(last7Cents);
  const sharpe30d = computeSharpe(daily30.map((d) => d.pnlCents));

  return {
    account: account.data,
    instance: instance.data ?? null,
    control: control.data ?? null,
    activeConfig: activeConfig.data ?? null,
    versions: versions.data ?? [],
    heartbeats: heartbeats.data ?? [],
    scans: scans.data ?? [],
    fills: fills.data ?? [],
    settlements: settlementRows.slice(0, 50),
    latestHeartbeat: (heartbeats.data ?? [])[0] ?? null,
    daily30,
    today: { cents: todayC, pct: pctReturn(todayC, exposure) },
    week: { cents: weekC, pct: pctReturn(weekC, exposure) },
    month: { cents: monthC, pct: pctReturn(monthC, exposure) },
    sharpe7d,
    sharpe30d,
  };
}
```

- [ ] **Step 2: Typecheck & commit**

```bash
pnpm typecheck
git add lib/queries/account.ts
git commit -m "feat: getAccountDetail query"
```

---

### Task 16: Account Detail — status bar + performance cards + P&L chart

**Files:**
- Create: `components/account/status-bar.tsx`, `components/account/performance-cards.tsx`, `components/account/pnl-chart.tsx`

- [ ] **Step 1: Create `components/account/status-bar.tsx`**

```tsx
import { formatDistanceToNowStrict } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { AccountDetail } from '@/lib/queries/account';

export function StatusBar({ d }: { d: AccountDetail }) {
  const hb = d.latestHeartbeat;
  const hbAge = hb ? formatDistanceToNowStrict(new Date(hb.created_at)) + ' ago' : 'never';
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 grid grid-cols-6 gap-4 text-sm">
      <div>
        <div className="text-xs uppercase text-neutral-500">Customer</div>
        <div className="font-semibold">{d.account.customer_name}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">VPS</div>
        <div className="mono text-xs">{d.instance?.vps_ip ?? '—'}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Instance</div>
        <Badge tone={d.instance?.status === 'running' ? 'green' : d.instance?.status === 'error' ? 'red' : 'neutral'}>
          {d.instance?.status ?? '—'}
        </Badge>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Heartbeat</div>
        <div>{hbAge}</div>
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Kill Switch</div>
        {d.control?.kill_switch ? <Badge tone="red">ON</Badge> : <Badge tone="green">off</Badge>}
      </div>
      <div>
        <div className="text-xs uppercase text-neutral-500">Regime</div>
        <div>{hb?.volume_regime ?? '—'}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/account/performance-cards.tsx`**

```tsx
import type { AccountDetail } from '@/lib/queries/account';

const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`;
const fmtPct = (p: number) => `${(p * 100).toFixed(2)}%`;

function Card({ label, cents, pct }: { label: string; cents: number; pct: number }) {
  const pos = cents >= 0;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs uppercase text-neutral-500">{label}</div>
      <div className={`text-xl font-semibold ${pos ? 'text-green-300' : 'text-red-300'}`}>
        {fmtCents(cents)}
      </div>
      <div className="text-xs text-neutral-400">{fmtPct(pct)}</div>
    </div>
  );
}

export function PerformanceCards({ d }: { d: AccountDetail }) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Card label="Today P&L" cents={d.today.cents} pct={d.today.pct} />
      <Card label="7d P&L" cents={d.week.cents} pct={d.week.pct} />
      <Card label="30d P&L" cents={d.month.cents} pct={d.month.pct} />
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-xs uppercase text-neutral-500">7d Sharpe</div>
        <div className="text-xl font-semibold">{d.sharpe7d?.toFixed(2) ?? '—'}</div>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="text-xs uppercase text-neutral-500">30d Sharpe</div>
        <div className="text-xl font-semibold">{d.sharpe30d?.toFixed(2) ?? '—'}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/account/pnl-chart.tsx`**

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { DailyPnl } from '@/lib/metrics/types';

export function PnlChart({ data }: { data: DailyPnl[] }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h3 className="text-sm font-semibold mb-2">Daily P&L (last 30 days)</h3>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey="date" stroke="#737373" fontSize={11} />
            <YAxis stroke="#737373" fontSize={11}
              tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: '#171717', border: '1px solid #404040' }}
              formatter={(v: number) => `$${(v / 100).toFixed(2)}`}
            />
            <Bar dataKey="pnlCents">
              {data.map((d, i) => (
                <Cell key={i} fill={d.pnlCents >= 0 ? '#4ade80' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
pnpm typecheck
git add components/account
git commit -m "feat: account status bar, performance cards, pnl chart"
```

---

### Task 17: Account Detail — heartbeat + scans + fills/settlements tables

**Files:**
- Create: `components/account/heartbeat-table.tsx`, `components/account/scans-table.tsx`, `components/account/fills-settlements.tsx`

- [ ] **Step 1: Create `components/account/heartbeat-table.tsx`**

```tsx
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { BotHeartbeatRow } from '@/lib/types/db';

export function HeartbeatTable({ rows }: { rows: BotHeartbeatRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Heartbeat history (last {rows.length})</h3>
      <Table>
        <THead>
          <Tr>
            <Th>Time</Th><Th>Status</Th><Th>Regime</Th>
            <Th className="text-right">Signals</Th>
            <Th className="text-right">Open Exp</Th>
            <Th className="text-right">Daily P&L</Th>
            <Th>Fail-safe</Th><Th>Cfg v</Th>
          </Tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="mono text-xs">{format(new Date(r.created_at), 'MMM d HH:mm:ss')}</Td>
              <Td>{r.status}</Td>
              <Td>{r.volume_regime ?? '—'}</Td>
              <Td className="text-right mono">{r.signals_detected}</Td>
              <Td className="text-right mono">${(r.open_exposure_cents / 100).toFixed(2)}</Td>
              <Td className="text-right mono">
                {r.daily_pnl_cents == null ? '—' : `$${(r.daily_pnl_cents / 100).toFixed(2)}`}
              </Td>
              <Td className="text-xs">
                {r.fail_safe_status ?? '—'}
                {r.fail_safe_reason ? ` · ${r.fail_safe_reason}` : ''}
              </Td>
              <Td className="mono">{r.config_snapshot?.version ?? '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/account/scans-table.tsx`**

```tsx
'use client';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { MarketScanRow } from '@/lib/types/db';

export function ScansTable({ rows }: { rows: MarketScanRow[] }) {
  const [gateFilter, setGateFilter] = useState<'all' | 'passed' | 'rejected'>('all');
  const [gateName, setGateName] = useState<string>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const gateNames = useMemo(
    () => Array.from(new Set(rows.map((r) => r.closest_failing_gate).filter(Boolean) as string[])).sort(),
    [rows],
  );
  const filtered = rows.filter((r) => {
    if (gateFilter !== 'all' && r.gate_result !== gateFilter) return false;
    if (gateName && r.closest_failing_gate !== gateName) return false;
    return true;
  });

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-sm font-semibold">Recent scans</h3>
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={gateFilter} onChange={(e) => setGateFilter(e.target.value as 'all' | 'passed' | 'rejected')}>
          <option value="all">All</option>
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={gateName} onChange={(e) => setGateName(e.target.value)}>
          <option value="">Any gate</option>
          {gateNames.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className="text-xs text-neutral-500">{filtered.length} of {rows.length}</span>
      </div>
      <Table>
        <THead>
          <Tr>
            <Th>Time</Th><Th>Ticker</Th><Th>Side</Th>
            <Th className="text-right">Edge</Th>
            <Th className="text-right">Fair</Th>
            <Th className="text-right">Base FV</Th>
            <Th className="text-right">µ-edge</Th>
            <Th className="text-right">Floor</Th>
            <Th>Gate</Th><Th>Closest fail</Th><Th></Th>
          </Tr>
        </THead>
        <tbody>
          {filtered.map((r) => (
            <>
              <Tr key={r.id}>
                <Td className="mono text-xs">{format(new Date(r.created_at), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{r.ticker}</Td>
                <Td>{r.signal_side ?? '—'}</Td>
                <Td className="text-right mono">{r.edge?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.fair_value?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.base_fair_value?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.micro_edge_score?.toFixed(3) ?? '—'}</Td>
                <Td className="text-right mono">{r.dynamic_edge_floor?.toFixed(3) ?? '—'}</Td>
                <Td>{r.gate_result ?? '—'}</Td>
                <Td className="text-xs">{r.closest_failing_gate ?? '—'}</Td>
                <Td>
                  <button className="text-xs text-blue-400 hover:underline" onClick={() => toggle(r.id)}>
                    {expanded.has(r.id) ? 'hide' : 'gates'}
                  </button>
                </Td>
              </Tr>
              {expanded.has(r.id) && (
                <Tr key={r.id + ':g'}>
                  <Td className="mono text-xs whitespace-pre" {...{ colSpan: 11 }}>
                    {JSON.stringify(r.gate_values ?? {}, null, 2)}
                  </Td>
                </Tr>
              )}
            </>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/account/fills-settlements.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import type { KalshiFillRow, KalshiSettlementRow } from '@/lib/types/db';

export function FillsSettlements({
  fills, settlements,
}: { fills: KalshiFillRow[]; settlements: KalshiSettlementRow[] }) {
  const [tab, setTab] = useState<'fills' | 'settlements'>('fills');
  return (
    <div>
      <div className="flex gap-2 mb-2 text-sm">
        <button onClick={() => setTab('fills')}
          className={`px-3 py-1 rounded ${tab === 'fills' ? 'bg-neutral-800' : 'text-neutral-400'}`}>
          Fills ({fills.length})
        </button>
        <button onClick={() => setTab('settlements')}
          className={`px-3 py-1 rounded ${tab === 'settlements' ? 'bg-neutral-800' : 'text-neutral-400'}`}>
          Settlements ({settlements.length})
        </button>
      </div>
      {tab === 'fills' ? (
        <Table>
          <THead>
            <Tr><Th>Time</Th><Th>Ticker</Th><Th>Side</Th><Th>Action</Th>
              <Th className="text-right">Contracts</Th><Th className="text-right">Price</Th><Th>Origin</Th></Tr>
          </THead>
          <tbody>
            {fills.map((f) => (
              <Tr key={f.id}>
                <Td className="mono text-xs">{format(new Date(f.filled_time), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{f.ticker}</Td>
                <Td>{f.side}</Td><Td>{f.action}</Td>
                <Td className="text-right mono">{f.contracts}</Td>
                <Td className="text-right mono">{(f.price_cents / 100).toFixed(2)}</Td>
                <Td className="text-xs">{f.origin ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Table>
          <THead>
            <Tr><Th>Time</Th><Th>Ticker</Th><Th>Result</Th>
              <Th className="text-right">P&L</Th><Th>Origin</Th></Tr>
          </THead>
          <tbody>
            {settlements.map((s) => (
              <Tr key={s.id}>
                <Td className="mono text-xs">{format(new Date(s.settled_time), 'MMM d HH:mm:ss')}</Td>
                <Td className="mono text-xs">{s.ticker}</Td>
                <Td>{s.result}</Td>
                <Td className={`text-right mono ${s.pnl_cents >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  ${(s.pnl_cents / 100).toFixed(2)}
                </Td>
                <Td className="text-xs">{s.origin ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
pnpm typecheck
git add components/account
git commit -m "feat: heartbeat, scans, fills/settlements tables for account detail"
```

---

### Task 18: Account Detail — active config + version history

**Files:**
- Create: `components/account/active-config.tsx`, `components/account/version-history.tsx`

- [ ] **Step 1: Create `components/account/active-config.tsx`**

Uses the schema's labels/units so fields render like they do in bot-trader-web's Bot Control page, but read-only.

```tsx
import { fmtTime } from '@/lib/utils/format';
import { TRADING_CONFIG_SCHEMA, getVarDef } from '@/lib/config/schema';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

function renderValue(key: string, v: unknown): string {
  if (v === null || v === undefined) return '—';
  const def = getVarDef(key);
  if (def?.type === 'boolean') return v ? 'true' : 'false';
  if (def?.unit === 'cents' && typeof v === 'number') return `$${(v / 100).toFixed(2)}`;
  if (def?.unit === '%' && typeof v === 'number') return `${(v * 100).toFixed(2)}%`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function ActiveConfig({ cfg }: { cfg: TradingConfigRow | null }) {
  if (!cfg) return <div className="text-neutral-500">No active config.</div>;
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Active config</h3>
        <div className="text-xs text-neutral-400 mono">
          v{cfg.version} · deployed {cfg.deployed_at ? fmtTime(cfg.deployed_at) : 'never'}
        </div>
      </div>
      {TRADING_CONFIG_SCHEMA.map((g) => (
        <details key={g.id} open className="border-t border-neutral-800 pt-2">
          <summary className="cursor-pointer text-xs uppercase text-neutral-400">{g.label}</summary>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
            {g.vars.map((v) => {
              const raw = (cfg as unknown as Record<string, unknown>)[v.key];
              return (
                <div key={v.key} className="flex justify-between border-b border-neutral-900 py-1">
                  <dt className="text-neutral-400 text-xs" title={v.description ?? ''}>{v.label}</dt>
                  <dd className="mono text-xs">{renderValue(v.key, raw)}</dd>
                </div>
              );
            })}
          </dl>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/account/version-history.tsx`**

Reads the **pre-computed** `diff` column on `bot_config_versions` — no client-side diffing.

```tsx
'use client';
import { useState } from 'react';
import { fmtTime } from '@/lib/utils/format';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { getVarDef } from '@/lib/config/schema';
import type { BotConfigVersionRow } from '@/lib/types/db';

export function VersionHistory({ versions }: { versions: BotConfigVersionRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const sorted = [...versions].sort(
    (a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime(),
  );

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Config version history</h3>
      <Table>
        <THead>
          <Tr><Th>Version</Th><Th>Deployed</Th><Th>Changes</Th><Th></Th></Tr>
        </THead>
        <tbody>
          {sorted.map((v) => {
            const diffEntries = v.diff ? Object.entries(v.diff) : [];
            const count = diffEntries.length;
            return (
              <>
                <Tr key={v.id}>
                  <Td className="mono">v{v.version}</Td>
                  <Td className="text-xs">{fmtTime(v.deployed_at)}</Td>
                  <Td className="text-xs">
                    {v.diff == null ? 'initial' : `${count} field change${count === 1 ? '' : 's'}`}
                  </Td>
                  <Td>
                    {count > 0 && (
                      <button className="text-xs text-blue-400 hover:underline" onClick={() => toggle(v.id)}>
                        {expanded.has(v.id) ? 'hide' : 'show'}
                      </button>
                    )}
                  </Td>
                </Tr>
                {expanded.has(v.id) && count > 0 && (
                  <Tr key={v.id + ':d'}>
                    <Td {...{ colSpan: 4 }}>
                      <ul className="mono text-xs space-y-1">
                        {diffEntries.map(([key, change]) => {
                          const label = getVarDef(key)?.label ?? key;
                          return (
                            <li key={key}>
                              <span className="text-neutral-400">{label}</span>{' '}
                              <span className="text-red-300">{JSON.stringify(change.from)}</span>{' → '}
                              <span className="text-green-300">{JSON.stringify(change.to)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </Td>
                  </Tr>
                )}
              </>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
pnpm typecheck
git add components/account
git commit -m "feat: active config + version history components"
```

---

### Task 19: Account Detail page

**Files:**
- Create: `app/accounts/[accountId]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { notFound } from 'next/navigation';
import { getAccountDetail } from '@/lib/queries/account';
import { StatusBar } from '@/components/account/status-bar';
import { PerformanceCards } from '@/components/account/performance-cards';
import { PnlChart } from '@/components/account/pnl-chart';
import { HeartbeatTable } from '@/components/account/heartbeat-table';
import { ScansTable } from '@/components/account/scans-table';
import { FillsSettlements } from '@/components/account/fills-settlements';
import { ActiveConfig } from '@/components/account/active-config';
import { VersionHistory } from '@/components/account/version-history';

export const dynamic = 'force-dynamic';

export default async function AccountPage({
  params,
}: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const d = await getAccountDetail(accountId);
  if (!d) notFound();
  return (
    <div className="space-y-6">
      <StatusBar d={d} />
      <PerformanceCards d={d} />
      <PnlChart data={d.daily30} />
      <HeartbeatTable rows={d.heartbeats} />
      <ScansTable rows={d.scans} />
      <FillsSettlements fills={d.fills} settlements={d.settlements} />
      <ActiveConfig cfg={d.activeConfig} />
      <VersionHistory versions={d.versions} />
    </div>
  );
}
```

- [ ] **Step 2: Visual verification**

Run: `pnpm dev`. From `/`, click any account row → lands on `/accounts/<id>`. Verify all sections render; scans filter works; fills/settlements tab switch works; a version row expand shows a diff. Stop server.

- [ ] **Step 3: Commit**

```bash
pnpm typecheck
git add app/accounts
git commit -m "feat: account detail page wiring"
```

---

## Phase 5 — Config Comparison (Tasks 20–21)

### Task 20: Configs query

**Files:**
- Create: `lib/queries/configs.ts`

- [ ] **Step 1: Create `lib/queries/configs.ts`**

```typescript
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { aggregateDailyPnl, pctReturn, trailingPnl } from '@/lib/metrics/pnl';
import { computeSharpe } from '@/lib/utils/stats';
import type { AccountRow, KalshiSettlementRow } from '@/lib/types/db';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

export interface ConfigSummaryRow {
  account: AccountRow;
  config: TradingConfigRow | null;
  weekPct: number;
  monthPct: number;
  sharpe7d: number | null;
}

export async function getConfigSummary(): Promise<ConfigSummaryRow[]> {
  const db = createServiceClient();
  const now = new Date();
  const thirtyOneDaysAgoIso = new Date(now.getTime() - 31 * 86_400_000).toISOString();

  const [accounts, configs, settlements] = await Promise.all([
    db.from('accounts').select('*').returns<AccountRow[]>(),
    db.from('bot_trading_config').select('*').eq('status', 'active').returns<TradingConfigRow[]>(),
    db.from('kalshi_settlements').select('*')
      .in('origin', ['bot', 'pending'])
      .gte('settled_time', thirtyOneDaysAgoIso).returns<KalshiSettlementRow[]>(),
  ]);
  for (const q of [accounts, configs, settlements]) if (q.error) throw q.error;

  const cfgByAccount = new Map((configs.data ?? []).map((c) => [c.account_id, c]));
  const settlementsByAccount = new Map<string, KalshiSettlementRow[]>();
  for (const s of settlements.data ?? []) {
    const arr = settlementsByAccount.get(s.account_id) ?? [];
    arr.push(s); settlementsByAccount.set(s.account_id, arr);
  }

  return (accounts.data ?? []).map<ConfigSummaryRow>((account) => {
    const cfg = cfgByAccount.get(account.id) ?? null;
    const settle = settlementsByAccount.get(account.id) ?? [];
    const exposure = cfg?.max_portfolio_exposure ?? 0;
    const daily = aggregateDailyPnl(settle);
    const last7Cents = daily.slice(-7).map((d) => d.pnlCents);
    return {
      account, config: cfg,
      weekPct: pctReturn(trailingPnl(settle, now, 7), exposure),
      monthPct: pctReturn(trailingPnl(settle, now, 30), exposure),
      sharpe7d: computeSharpe(last7Cents),
    };
  });
}
```

- [ ] **Step 2: Commit**

```bash
pnpm typecheck
git add lib/queries/configs.ts
git commit -m "feat: getConfigSummary query"
```

---

### Task 21: Config Comparison page

**Files:**
- Create: `components/configs/summary-table.tsx`, `components/configs/comparison-table.tsx`, `app/configs/page.tsx`

- [ ] **Step 1: Create `components/configs/summary-table.tsx`**

```tsx
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { fmtPct } from '@/lib/utils/format';
import { getVarDef } from '@/lib/config/schema';
import type { ConfigSummaryRow } from '@/lib/queries/configs';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

// Highlight fields to surface in the summary. Labels come from the schema.
const KEYS = ['daily_loss_limit', 'kelly_multiplier', 'max_position_size', 'order_type_priority'] as const;

function readKey(cfg: TradingConfigRow | null, key: string): string {
  if (!cfg) return '—';
  const raw = (cfg as unknown as Record<string, unknown>)[key];
  if (raw === null || raw === undefined) return '—';
  return String(raw);
}

export function SummaryTable({ rows }: { rows: ConfigSummaryRow[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Account</Th>
          <Th>v</Th>
          {KEYS.map((k) => (
            <Th key={k} className="text-xs">{getVarDef(k)?.label ?? k}</Th>
          ))}
          <Th className="text-right">7d %</Th>
          <Th className="text-right">30d %</Th>
          <Th className="text-right">7d Sharpe</Th>
        </Tr>
      </THead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.account.id}>
            <Td>{r.account.customer_name}</Td>
            <Td className="mono">{r.config?.version ?? '—'}</Td>
            {KEYS.map((k) => (
              <Td key={k} className="mono text-xs">{readKey(r.config, k)}</Td>
            ))}
            <Td className={`text-right mono ${r.weekPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtPct(r.weekPct)}</Td>
            <Td className={`text-right mono ${r.monthPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>{fmtPct(r.monthPct)}</Td>
            <Td className="text-right mono">{r.sharpe7d?.toFixed(2) ?? '—'}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
```

- [ ] **Step 2: Create `components/configs/comparison-table.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { TRADING_CONFIG_SCHEMA } from '@/lib/config/schema';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { fmtPct } from '@/lib/utils/format';
import type { ConfigSummaryRow } from '@/lib/queries/configs';
import type { TradingConfigRow } from '@/lib/types/tradingConfig';

function mostCommon(values: string[]): string | null {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
  return best;
}

function readCell(cfg: TradingConfigRow | null, key: string): string {
  if (!cfg) return 'null';
  const raw = (cfg as unknown as Record<string, unknown>)[key];
  return JSON.stringify(raw ?? null);
}

export function ComparisonTable({ rows }: { rows: ConfigSummaryRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRows = rows.filter((r) => selected.includes(r.account.id));

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-neutral-400 mb-1">Pick 2–5 accounts:</div>
        <div className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <button key={r.account.id} onClick={() => toggle(r.account.id)}
              className={`text-xs px-2 py-1 rounded border ${
                selected.includes(r.account.id)
                  ? 'bg-blue-900/50 border-blue-700'
                  : 'border-neutral-800 text-neutral-400'}`}>
              {r.account.customer_name}
            </button>
          ))}
        </div>
      </div>

      {selectedRows.length < 2 ? (
        <p className="text-sm text-neutral-500">Select at least 2 accounts to compare.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Parameter</Th>
              {selectedRows.map((r) => <Th key={r.account.id}>{r.account.customer_name}</Th>)}
            </Tr>
          </THead>
          <tbody>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">7d %</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className={`mono ${r.weekPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmtPct(r.weekPct)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">30d %</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className={`mono ${r.monthPct >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {fmtPct(r.monthPct)}
                </Td>
              ))}
            </Tr>
            <Tr>
              <Td className="text-xs uppercase text-neutral-500">7d Sharpe</Td>
              {selectedRows.map((r) => (
                <Td key={r.account.id} className="mono">{r.sharpe7d?.toFixed(2) ?? '—'}</Td>
              ))}
            </Tr>
            {TRADING_CONFIG_SCHEMA.map((g) => (
              <>
                <Tr key={g.id + ':h'}>
                  <Td {...{ colSpan: selectedRows.length + 1 }} className="text-xs uppercase text-neutral-500 bg-neutral-900/60">
                    {g.label}
                  </Td>
                </Tr>
                {g.vars.map((v) => {
                  const values = selectedRows.map((r) => readCell(r.config, v.key));
                  const common = mostCommon(values);
                  return (
                    <Tr key={v.key}>
                      <Td className="text-xs text-neutral-400" title={v.description ?? ''}>{v.label}</Td>
                      {selectedRows.map((r, i) => {
                        const val = values[i];
                        const outlier = common != null && val !== common;
                        return (
                          <Td key={r.account.id}
                            className={`mono text-xs ${outlier ? 'bg-yellow-900/30 text-yellow-200' : ''}`}>
                            {val === 'null' ? '—' : val}
                          </Td>
                        );
                      })}
                    </Tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/configs/page.tsx`**

```tsx
import { getConfigSummary } from '@/lib/queries/configs';
import { SummaryTable } from '@/components/configs/summary-table';
import { ComparisonTable } from '@/components/configs/comparison-table';

export const dynamic = 'force-dynamic';

export default async function ConfigsPage() {
  const rows = await getConfigSummary();
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Config Comparison</h1>
      <section className="space-y-2">
        <h2 className="text-sm uppercase text-neutral-400">Summary (all accounts)</h2>
        <SummaryTable rows={rows} />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm uppercase text-neutral-400">Side-by-side comparison</h2>
        <ComparisonTable rows={rows} />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`. Visit `/configs`. Confirm summary table loads; pick 2–3 accounts and confirm comparison grid appears with outlier cells highlighted yellow where values differ from the mode. Stop server.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add -A
git commit -m "feat: config comparison page with outlier highlighting"
```

---

## Phase 6 — Alerts (Task 22)

### Task 22: Alerts query + page

**Files:**
- Create: `lib/queries/alerts.ts`, `components/alerts/alerts-table.tsx`, `app/alerts/page.tsx`

- [ ] **Step 1: Create `lib/queries/alerts.ts`**

```typescript
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { AccountRow, AlertLogRow, AlertType } from '@/lib/types/db';

export interface AlertRow extends AlertLogRow {
  customer_name: string;
}

export interface AlertFilters {
  accountId?: string;
  types?: AlertType[];
  fromIso?: string;
  toIso?: string;
  page?: number;
  pageSize?: number;
}

export async function getAlerts(filters: AlertFilters): Promise<{ rows: AlertRow[]; total: number; accounts: AccountRow[] }> {
  const db = createServiceClient();
  const pageSize = filters.pageSize ?? 50;
  const page = filters.page ?? 0;

  const accountsQ = await db.from('accounts').select('*').returns<AccountRow[]>();
  if (accountsQ.error) throw accountsQ.error;
  const nameById = new Map((accountsQ.data ?? []).map((a) => [a.id, a.customer_name]));

  let q = db.from('alert_log').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (filters.accountId) q = q.eq('account_id', filters.accountId);
  if (filters.types && filters.types.length > 0) q = q.in('alert_type', filters.types);
  if (filters.fromIso) q = q.gte('created_at', filters.fromIso);
  if (filters.toIso) q = q.lte('created_at', filters.toIso);

  const { data, error, count } = await q.returns<AlertLogRow[]>();
  if (error) throw error;

  return {
    rows: (data ?? []).map((r) => ({ ...r, customer_name: nameById.get(r.account_id) ?? 'unknown' })),
    total: count ?? 0,
    accounts: accountsQ.data ?? [],
  };
}
```

- [ ] **Step 2: Create `components/alerts/alerts-table.tsx`**

```tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Table, THead, Tr, Th, Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AlertRow } from '@/lib/queries/alerts';
import type { AccountRow, AlertType } from '@/lib/types/db';

const ALERT_TYPES: AlertType[] = ['stale_heartbeat', 'daily_loss', 'kill_switch', 'sync_failure'];

export function AlertsTable({
  rows, total, accounts, page, pageSize,
}: { rows: AlertRow[]; total: number; accounts: AccountRow[]; page: number; pageSize: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  function setParam(k: string, v: string | null) {
    const next = new URLSearchParams(sp);
    if (v == null || v === '') next.delete(k); else next.set(k, v);
    router.push(`/alerts?${next.toString()}`);
  }

  function toggleType(t: AlertType) {
    const current = (sp.get('types') ?? '').split(',').filter(Boolean) as AlertType[];
    const next = current.includes(t) ? current.filter((x) => x !== t) : [...current, t];
    setParam('types', next.join(','));
  }

  const currentTypes = (sp.get('types') ?? '').split(',').filter(Boolean);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <select className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('accountId') ?? ''} onChange={(e) => setParam('accountId', e.target.value || null)}>
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.customer_name}</option>)}
        </select>
        <div className="flex gap-2 text-xs">
          {ALERT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={currentTypes.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>
        <input type="date" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('from') ?? ''} onChange={(e) => setParam('from', e.target.value || null)} />
        <input type="date" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
          value={sp.get('to') ?? ''} onChange={(e) => setParam('to', e.target.value || null)} />
        <span className="text-xs text-neutral-500">{total} alert{total === 1 ? '' : 's'}</span>
      </div>

      <Table>
        <THead>
          <Tr><Th>Time</Th><Th>Account</Th><Th>Type</Th><Th>Details</Th></Tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.id}>
              <Td className="mono text-xs">{format(new Date(r.created_at), 'MMM d yyyy HH:mm:ss')}</Td>
              <Td>{r.customer_name}</Td>
              <Td><Badge tone={r.alert_type === 'daily_loss' || r.alert_type === 'kill_switch' ? 'red' : 'yellow'}>{r.alert_type}</Badge></Td>
              <Td className="mono text-xs whitespace-pre-wrap">{JSON.stringify(r.details, null, 2)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <div className="flex justify-between text-xs">
        <button disabled={page === 0} onClick={() => setParam('page', String(page - 1))}
          className="px-2 py-1 border border-neutral-800 rounded disabled:opacity-30">← Prev</button>
        <span className="text-neutral-500">Page {page + 1} of {totalPages}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setParam('page', String(page + 1))}
          className="px-2 py-1 border border-neutral-800 rounded disabled:opacity-30">Next →</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/alerts/page.tsx`**

```tsx
import { getAlerts } from '@/lib/queries/alerts';
import { AlertsTable } from '@/components/alerts/alerts-table';
import type { AlertType } from '@/lib/types/db';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 0);
  const pageSize = 50;
  const types = (sp.types ?? '').split(',').filter(Boolean) as AlertType[];
  const { rows, total, accounts } = await getAlerts({
    accountId: sp.accountId || undefined,
    types: types.length ? types : undefined,
    fromIso: sp.from ? new Date(sp.from).toISOString() : undefined,
    toIso: sp.to ? new Date(sp.to + 'T23:59:59Z').toISOString() : undefined,
    page, pageSize,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      <AlertsTable rows={rows} total={total} accounts={accounts} page={page} pageSize={pageSize} />
    </div>
  );
}
```

- [ ] **Step 4: Visual verification**

Run: `pnpm dev`. Visit `/alerts`. Confirm: rows load, the account dropdown filters, the type checkboxes filter, date pickers filter, pagination works. Stop server.

- [ ] **Step 5: Commit**

```bash
pnpm typecheck
git add -A
git commit -m "feat: alerts page with filtering and pagination"
```

---

## Phase 7 — Build & Deploy (Task 23)

### Task 23: Production build + Vercel deploy

**Files:**
- Modify: `README.md` (add deploy notes)

- [ ] **Step 1: Production build locally**

Run: `pnpm build`
Expected: build succeeds, no type errors, no ESLint errors. Fix any that appear before moving on. If ESLint complains about unescaped apostrophes in labels like "P&L" (it won't, but just in case), fix inline.

- [ ] **Step 2: Start production server and smoke-test**

Run: `pnpm start`
Visit all four routes (/, /accounts/<id>, /configs, /alerts). All should render. Stop server.

- [ ] **Step 3: Push branch to GitHub**

```bash
git push -u origin main
```

If the repo doesn't exist on GitHub yet, create it (private) under your account first via `gh repo create parachute-admin --private --source=. --push` (requires gh CLI logged in).

- [ ] **Step 4: Import into Vercel**

Manual step in browser:
1. Vercel dashboard → "Add New…" → "Project" → import the GitHub repo.
2. Framework preset: Next.js (auto-detected).
3. **Environment Variables** — add all four from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_USER_IDS`
4. Click Deploy.

- [ ] **Step 5: Verify production deployment**

Once deploy is green:
1. Visit the Vercel URL → redirects to `/login`.
2. Sign in with admin credentials → fleet overview loads.
3. Sign in with a non-admin user → 403.

- [ ] **Step 6: Append deploy notes to README**

Append to `README.md`:
```markdown

## Deployment

Auto-deploys from `main` via Vercel. Env vars managed in Vercel project settings — mirror `.env.example`.

**Live URL:** <paste Vercel URL here>
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: deployment notes"
git push
```

---

## Done. Full spec coverage

| Spec requirement | Implemented in |
|---|---|
| Standalone Next.js repo on Vercel | Tasks 1, 23 |
| Reads same Supabase, no new tables | Task 5 (service client), all queries |
| Supabase auth + `ADMIN_USER_IDS` gate | Task 6 |
| Env vars (URL / ANON / SERVICE_ROLE / ADMIN_USER_IDS) | Task 2 |
| Fleet Overview `/` with all 12 columns and color rows | Tasks 10–12 |
| Account Detail `/accounts/[id]` — status bar, perf cards, P&L chart, heartbeat/scans/fills/settlements, active config, version history | Tasks 13–19 |
| Config Comparison `/configs` — summary + side-by-side with outlier highlight + performance headers | Tasks 20–21 |
| Alerts `/alerts` — paginated + filters | Task 22 |
| Sharpe same formula as bot-trader-web | Task 8 |
| % return on `max_portfolio_exposure` | Tasks 9, 10, 15, 20 |
| Recharts, Tailwind dark, Geist fonts | Tasks 3, 7, 16 |
| Read-only, no Kalshi API, no crons, no realtime | N/A (absence — no task introduces these) |

**Out of scope (explicit in spec):** auto-refresh polling, writes, backtesting, plugin system, % on actual balance, resource monitoring.
