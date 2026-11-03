# KCLMC Platform - Production Review Report

**Date**: 2026-11-03  
**Repository**: `kclmc-portal` (`https://github.com/RemTypes/kclmc-portal`)  
**Branch Audited**: `epic/replace-supabase` (`3ebd81a`)  
**Target Architecture**: Next.js 16 (App Router) • OpenNext Cloudflare (`@opennextjs/cloudflare`) • Cloudflare Workers (`workerd` + `nodejs_compat`) • Cloudflare D1 (SQLite) • Better Auth

---

## Executive Summary

- **Overall Production Readiness Score**: **C+** (Strong foundational architecture and test suite, held back by mid-migration split-brain state between Better Auth/D1 and legacy Supabase/2FA seams)
- **Ship Verdict**: **CONDITIONAL** — Safe to ship once Track A blockers (`[SEC-01]` through `[SEC-06]` and `[COPY-01]`) are merged via atomic PRs.
- **Critical / High Vulnerabilities & Blockers**: **7** (`[SEC-01]` to `[SEC-07]`)
- **Redundant Subsystems Identified**: **5** (`[RED-01]` to `[RED-05]`)
- **Cloudflare Edge Runtime Hygiene Issues**: **3** (`[EDGE-01]` to `[EDGE-03]`)
- **Data Integrity & Concurrency Issues**: **4** (`[DATA-01]` to `[DATA-04]`)
- **Frontend Copy & Terminology Violations**: **105 total findings** (**34 Errors**, **71 Warnings** via `npm run check:frontend-copy`)

### Baseline Verification Gate Snapshot

| Gate Step | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **1. Unit & Integration Tests** | `npm test` | ⚠️ **282 / 285 passed** (3 timed out offline; **284 / 285** with placeholder Supabase URL) | 3 tests in `tests/roster_link.test.ts` and `tests/signup_to_paid_flow.test.ts` attempt live outbound connections to `bsvnyibipcwrcyzqilge.supabase.co` because `lib/supabase/server.ts` hardcodes a live `DEFAULT_URL` fallback (`[RED-02]`). |
| **2. TypeScript Typecheck** | `npx tsc --noEmit` | ✅ **PASS (0 errors)** | Clean TypeScript compilation across all 199 tracked files. |
| **3. Frontend Copy Audit** | `npm run check:frontend-copy` | ❌ **105 findings (34 errors, 71 warnings)** | 34 outdated `"Supabase"` references in `app/` and `components/`; 71 decommissioned 2FA/Authenticator references (`[COPY-01]`, `[COPY-02]`). |

---

## 1. High Priority (Blockers & Vulnerabilities)

### `[SEC-01]` Better Auth `twoFactor()` Plugin After-Hook Conflicts with KCLMC's Custom D1 2FA Login Gate (Blocker)
- **Files & Lines**:
  - [`lib/auth/better-auth.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/better-auth.ts#L144-L146) (lines 13, 144–146)
  - [`lib/auth/better-auth-client.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/better-auth-client.ts#L22) (line 22)
  - [`lib/auth/session.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/session.ts#L214-L222) (lines 214–222, 360–425, 612–616)
- **Root Cause**:
  1. As of commits `946f45c`, `48d5fba`, and `ccf1375`, mandatory 2FA for committee members (`role >= 1`) is **active and enforced at the Login Gate** (`AuthSessionService` in `lib/auth/session.ts`, `/api/auth/setup-2fa`, `/api/auth/verify-2fa`, `/api/admin/reset-2fa`), while the failing Edge Middleware attestation check in `middleware.ts` was removed in `ccf1375` to eliminate redirect loops.
  2. However, `lib/auth/better-auth.ts:144-146` also registers Better Auth's built-in `twoFactor({ issuer: "KCLMC Portal" })` plugin while `lib/auth/session.ts:613` runs `UPDATE "user" SET "twoFactorEnabled" = 1 WHERE id = ?` when a committee member completes KCLMC's D1 2FA enrollment.
  3. Inside Better Auth (`node_modules/better-auth/dist/plugins/two-factor/index.mjs:245-326`), the built-in `twoFactor` after-hook intercepts `/sign-in/email` whenever `user.twoFactorEnabled` is truthy, **deletes the newly created D1 session and session cookie** (`deleteSessionCookie(ctx, true); await ctx.context.internalAdapter.deleteSession(data.session.token)`), and overwrites the response body with `{ twoFactorRedirect: true }` (`baData.user` is `undefined`).
  4. When `lib/auth/session.ts:214-222` calls `auth.api.signInEmail(...)` on a subsequent login for an enrolled officer, `baData.user` is `undefined`, preventing `AuthSessionService.login()` from receiving the user and holding the session cookie inside `kclmc_2fa_pending` for `/api/auth/verify-2fa`.
- **Blast Radius**: **Critical** — On initial login (when `"user"."twoFactorEnabled"` is `0`), 2FA setup succeeds, which sets `"user"."twoFactorEnabled" = 1`. On subsequent logins, Better Auth's built-in `twoFactor()` plugin intercepts `signInEmail` and strips `baData.user` before KCLMC's `AuthSessionService` 2FA gate can run.
- **Recommended Patch**:
  - Keep KCLMC's active Login Gate 2FA (`ENFORCE_MANDATORY_2FA: "true"` in `wrangler.jsonc` and `enforce2FAGate` in `lib/auth/session.ts`).
  - Remove Better Auth's duplicate `twoFactor({ issuer: "KCLMC Portal" })` plugin from `lib/auth/better-auth.ts:144-146` (and `twoFactorClient()` from `lib/auth/better-auth-client.ts`) so `auth.api.signInEmail` always returns `{ user, token }` and `better-auth.session_token` to `AuthSessionService.login()`, which holds the cookie until `/api/auth/verify-2fa` verifies the D1 `"twoFactor"` TOTP code.

---

### `[SEC-02]` Missing Server-Side RBAC Clearance on `/admin/ml` (Tier 2 SuperAdmin Route) (High)
- **Files & Lines**:
  - [`app/admin/ml/layout.tsx`](file:///home/rem/Projects/kclmc-portal/app/admin/ml/layout.tsx#L1-L11) (lines 1–11)
  - [`app/admin/ml/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/admin/ml/page.tsx#L1-L60) (lines 1–60)
  - [`app/admin/layout.tsx`](file:///home/rem/Projects/kclmc-portal/app/admin/layout.tsx#L15-L38) (lines 15–38)
  - [`middleware.ts`](file:///home/rem/Projects/kclmc-portal/middleware.ts#L49-L122) (lines 49–122)
- **Root Cause**:
  1. Pillar 3 mandates two-layer RBAC defense-in-depth (both `middleware.ts` and Server Components/Layouts). While `app/admin/layout.tsx:24` checks `user.role < 1` (allowing Role 1 Committee and Role 2 SuperAdmin), `app/admin/ml/layout.tsx:9-11` is a pure pass-through (`return <>{children}</>`) and `app/admin/ml/page.tsx` is a `'use client'` component with zero server-side role verification.
  2. In `middleware.ts:49-122`, if a request carries a Better Auth cookie that fails edge lookup or throws (line 119), execution falls through to the legacy Supabase path instead of immediately rejecting unauthorized requests.
- **Blast Radius**: **High** — Single-layer reliance on middleware for `/admin/ml`; if middleware passes through or is bypassed, Role 1 committee users can render the Tier 2 SuperAdmin-only ML page even when `modulesConfig.adminMl.enabled` is `false`.
- **Recommended Patch**:
  - Convert `app/admin/ml/layout.tsx` into an `async` Server Component that calls `getAuthenticatedUser()`, redirects to `/login?next=/admin/ml` if `!user`, and redirects to `/403?req=superadmin&from=/admin/ml` if `user.role < 2`.

---

### `[SEC-03]` Unauthenticated PII Enumeration & Unsigned QR Verification on `/api/verify/[membershipId]` (High)
- **Files & Lines**:
  - [`app/api/verify/[membershipId]/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/verify/%5BmembershipId%5D/route.ts#L8-L35) (lines 8–35)
  - [`components/MembershipCard.tsx`](file:///home/rem/Projects/kclmc-portal/components/MembershipCard.tsx#L119-L122) (lines 119–122, 317)
  - [`lib/roster/d1-adapter.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster/d1-adapter.ts#L269-L307) (lines 269–307)
  - [`lib/roster/service.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster/service.ts#L422-L520) (lines 422–520)
- **Root Cause**:
  1. `GET /api/verify/[membershipId]` has **no rate limiting**, **no authentication**, and **no cryptographic HMAC signature or anti-replay timestamp check**.
  2. `components/MembershipCard.tsx:120-122` encodes a plain URL (`${window.location.origin}/api/verify/${studentId}`) into the QR code without an HMAC signature.
  3. Because KCL student IDs (`K` + 7–8 digits), sequential Associate IDs (`ASSOC-2601`, `ASSOC-2602`, ...), and KCLSU transaction IDs are predictable, an unauthenticated scraper can enumerate `/api/verify/ASSOC-2601` through `ASSOC-2699` or K-numbers and harvest full member names, student IDs, membership tiers, and KCLSU transaction IDs.
- **Blast Radius**: **High** — Unauthenticated enumeration of member PII (UK GDPR exposure) and trivial screenshot/URL cloning of climbing passes.
- **Recommended Patch**:
  - Enforce IP rate limiting (`checkRateLimit(ip)`) on `GET /api/verify/[membershipId]`.
  - Sign QR verification payloads with an HMAC token (`?sig=<hmac>`) or redact PII (e.g. mask surname to initial `Alex H.`) when the caller is not an authenticated Committee member (`user.role >= 1`).

---

### `[SEC-04]` Client IP Spoofing via `X-Forwarded-For` Precedence & Non-Verifying CAPTCHA Gate (High)
- **Files & Lines**:
  - [`lib/auth/session.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/session.ts#L114-L122) (lines 114–122)
  - [`app/api/auth/signup/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/signup/route.ts#L11-L19) (lines 11–19)
  - [`app/api/auth/forgot-password/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/forgot-password/route.ts#L8-L16) (lines 8–16)
  - [`app/api/auth/reset-password/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/reset-password/route.ts#L11-L19) (lines 11–19)
  - [`lib/security/rate-limiter.ts`](file:///home/rem/Projects/kclmc-portal/lib/security/rate-limiter.ts#L258-L281) (lines 32–33, 258–281)
- **Root Cause**:
  1. `extractClientIp()` in `lib/auth/session.ts:115` and `getClientIp()` in `signup`, `forgot-password`, and `reset-password` read `request.headers.get('x-forwarded-for')` **before** `request.headers.get('cf-connecting-ip')`. On Cloudflare Workers, `cf-connecting-ip` is the authoritative edge client IP, whereas a client can supply a forged `X-Forwarded-For` header whose first entry (`split(',')[0]`) is arbitrary.
  2. `verifyCaptchaToken()` in `lib/security/rate-limiter.ts:273-281` is a static string check (`trimmed.startsWith('cf_') || trimmed.startsWith('kclmc_captcha_') || trimmed === 'bypass_test_token' || trimmed.length >= 20`) with no server-side Turnstile `siteverify` call and no `NODE_ENV` guard on `'bypass_test_token'`.
  3. `ipStore` and `accountStore` (`lib/security/rate-limiter.ts:32-33`) are in-memory `Map` objects scoped to a single Worker isolate.
- **Blast Radius**: **High** — Attackers can rotate `X-Forwarded-For` headers and pass any 20-character string as `captchaToken` to bypass brute-force rate limiting and CAPTCHA challenges on login, signup, and password reset endpoints.
- **Recommended Patch**:
  - Read `cf-connecting-ip` **first** in `extractClientIp()` and unify all routes on that single helper.
  - Restrict `'bypass_test_token'` to `process.env.NODE_ENV !== 'production'`.

---

### `[SEC-05]` Disabled Module Gate Bypass in Middleware Fallback & `/api/orders` (Medium / High)
- **Files & Lines**:
  - [`middleware.ts`](file:///home/rem/Projects/kclmc-portal/middleware.ts#L20-L28) (lines 20–28, 108–117, 125–149)
  - [`config/modules.config.ts`](file:///home/rem/Projects/kclmc-portal/config/modules.config.ts#L56-L95) (lines 56–95)
  - [`app/api/orders/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/orders/route.ts#L135-L201) (lines 135–201)
- **Root Cause**:
  1. In `middleware.ts:20-28`, the fast unauthenticated block for disabled modules (`/comps`, `/leaderboard`, `/scoring`, `/drops/lube`) is skipped if the request has **any** cookie matching `c.name.startsWith('sb-') || c.name === 'kclmc_session' || c.name.includes('better-auth.session_token')`.
  2. If the visitor has `Cookie: kclmc_session=active` (which is `httpOnly: false` and can be set or retained in browser storage) and either (a) has an expired/invalid `better-auth.session_token` or (b) Supabase is unconfigured (`middleware.ts:125-149`), the middleware returns `supabaseResponse` **without checking `if (moduleDef && !moduleDef.enabled)`**!
  3. `POST /api/orders` (`app/api/orders/route.ts:137`) accepts `brand: 'LUBE'` orders even when `modulesConfig.dropsLube.enabled === false`.
- **Blast Radius**: **Medium / High** — Once Supabase env vars are removed (or when a user holds a non-HttpOnly `kclmc_session=active` cookie without an active Better Auth session), disabled public modules become accessible to non-SuperAdmins, and `POST /api/orders` accepts orders for disabled drops.
- **Recommended Patch**:
  - Add the disabled module check (`if (moduleDef && !moduleDef.enabled) return NextResponse.redirect(...)`) inside the unauthenticated fallback block at `middleware.ts:125-149` and when a Better Auth session fails validation.
  - In `POST /api/orders`, check `modulesConfig.dropsLube.enabled` (when `brand === 'LUBE'`) and `modulesConfig.dropsKclmc.enabled` (when `brand === 'KCL'`) and return `403 Forbidden` if disabled.

---

### `[SEC-06]` Broken Pass Scanner Order Collection (`status: 'COLLECTED'` Rejected with 400) & Order Endpoint Hardening (Medium / High)
- **Files & Lines**:
  - [`app/api/orders/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/orders/route.ts#L35-L126) (lines 35–126, 138, 212–249)
  - [`app/admin/scan/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/admin/scan/page.tsx#L80-L95) (lines 80–95)
  - [`d1/schema.sql`](file:///home/rem/Projects/kclmc-portal/d1/schema.sql#L278) (line 278)
- **Root Cause**:
  1. **Functional Bug in Pass Scanner**: In `app/admin/scan/page.tsx:86`, clicking "Mark as Collected" sends `PUT /api/orders` with `{ code: data.orderCode, status: 'COLLECTED' }`. However, `PUT /api/orders` (`app/api/orders/route.ts:217`) validates against `allowedStatuses = ['pending', 'paid', 'fulfilled', 'cancelled']` — which **excludes `'collected'`**! Meanwhile, `d1/schema.sql:278` and `types/database.ts:10` define `status IN ('pending', 'paid', 'collected', 'refunded')` (excluding `'fulfilled'` and `'cancelled'`). As a result, marking merch orders as collected in `/admin/scan` **always fails with HTTP 400**!
  2. **Missing Auth Check in Fallback Branch**: In `GET /api/orders` (`app/api/orders/route.ts:71-78` vs `117-125`), the committee role check (`getAuthenticatedUser(request)`) is inside `if (isSupabaseConfigured())`, so when Supabase is disabled, `GET /api/orders` (without `?code`) returns all `fallbackOrders` including customer emails without checking `user.role >= 1` in the route handler.
  3. **Low-Entropy Order Codes & PII Exposure**: `POST /api/orders` (`line 138`) uses `Math.floor(Math.random() * 9000 + 1000)` (only 9,000 codes) and `GET /api/orders?code=KCL-1234` returns `customerEmail` and `customerName` to unauthenticated callers.
- **Blast Radius**: **Medium / High** — Merch collection workflow in `/admin/scan` is completely broken (`400 Bad Request`), and customer emails on orders are enumerable via 4-digit codes.
- **Recommended Patch**:
  - Include `'collected'` and `'refunded'` in `allowedStatuses` in `PUT /api/orders` (and align `d1/schema.sql`).
  - Move the `getAuthenticatedUser(request)` committee check to the top of `GET /api/orders` whenever `!code`.

---

### `[SEC-07]` Hardcoded Personal Email SuperAdmin Backdoor in `lib/auth.ts` & Personal Data in Tracked SQL Seeds (Medium)
- **Files & Lines**:
  - [`lib/auth.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth.ts#L13-L33) (lines 13–33)
  - [`d1/better_auth_data.sql`](file:///home/rem/Projects/kclmc-portal/d1/better_auth_data.sql#L1-L60)
  - [`d1/better_auth_init.sql`](file:///home/rem/Projects/kclmc-portal/d1/better_auth_init.sql#L65-L115)
- **Root Cause**:
  1. `getUserRole()` in `lib/auth.ts:21-26` hardcodes `normalized === 'remy.preston@outlook.com' || normalized === 'remy.preston@kcl.ac.uk'` to return `Role 2` (SuperAdmin), bypassing `getSuperAdminEmail()` (`process.env.SUPERADMIN_EMAIL`).
  2. `d1/better_auth_data.sql` and `d1/better_auth_init.sql` are tracked in git and contain real member names, UUIDs, and personal email addresses exported from production.
- **Blast Radius**: **Medium** — Future committee handovers cannot revoke SuperAdmin access via `SUPERADMIN_EMAIL` env config alone without modifying source code, and member PII is stored in git-tracked SQL files.
- **Recommended Patch**:
  - Support comma-separated emails in `SUPERADMIN_EMAIL` and remove hardcoded personal email literals from `lib/auth.ts` (update `tests/security.test.ts` if it asserts on those emails or keep configurable defaults).
  - Remove PII seed dumps (`d1/better_auth_data.sql` and the data portion of `d1/better_auth_init.sql`) from git tracking and add `d1/*_data.sql` to `.gitignore`.

---

## 2. Redundant & Dead Systems (Safe to Prune)

### `[RED-01]` Legacy 2FA Artifacts (`/api/auth/verify-otp` Alias & One-Off Migration Scripts)
- **Status Update (`ccf1375` & `48d5fba`)**: Mandatory D1 2FA at the Login Gate (`/api/auth/setup-2fa`, `/api/auth/verify-2fa`, `/api/admin/reset-2fa`, `components/AdminTwoFactorCard.tsx`, `components/AdminSuperAdmin2FAReset.tsx`, and `app/(auth)/login/page.tsx`) is **active and working** in production as of commit `ccf1375` (which removed only the failing Edge Middleware attestation check in `middleware.ts`). Those active Login Gate 2FA routes and UI components **must be retained**.
- **Files Safe to Prune**:
  - [`app/api/auth/verify-otp/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/verify-otp/route.ts) (1-line unused alias re-exporting `verify-2fa`)
  - [`scripts/migrate_2fa_secrets_to_d1.ts`](file:///home/rem/Projects/kclmc-portal/scripts/migrate_2fa_secrets_to_d1.ts) (one-off Supabase-to-D1 migration script, superseded by fresh in-portal D1 enrollment in `946f45c`)
- **Safe Removal Plan**:
  1. Retain all active Login Gate 2FA routes (`/api/auth/setup-2fa`, `/api/auth/verify-2fa`, `/api/admin/reset-2fa`) and UI components (`AdminTwoFactorCard.tsx`, `AdminSuperAdmin2FAReset.tsx`, `app/(auth)/login/page.tsx`).
  2. Only remove the unused `/api/auth/verify-otp` alias route and `scripts/migrate_2fa_secrets_to_d1.ts`.

---

### `[RED-02]` Legacy Supabase Seam, Hardcoded `DEFAULT_URL` Fallbacks, and Unmigrated Routes
- **Why It's Redundant / Hazardous**:
  1. `lib/supabase/server.ts:4-19` and `lib/supabase/client.ts:3-20` hardcode `DEFAULT_URL = 'https://bsvnyibipcwrcyzqilge.supabase.co'` and `DEFAULT_KEY = 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg'`. As a result, `isSupabaseConfigured()` **always returns `true`**, causing server routes and unit tests (`tests/roster_link.test.ts`, `tests/signup_to_paid_flow.test.ts`) to make live network calls to Supabase whenever D1 is not injected.
  2. While roster and session resolution use D1 (`lib/roster/d1-adapter.ts`, `lib/auth/better-auth.ts`), the following routes and pages still bypass D1 and call Supabase or in-memory mocks directly:
     - [`app/api/auth/signup/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/signup/route.ts#L63-L130) (calls `serverSupabase.auth.signUp` instead of Better Auth on D1)
     - [`app/(auth)/auth/callback/route.ts`](file:///home/rem/Projects/kclmc-portal/app/%28auth%29/auth/callback/route.ts#L1-L64) (Supabase PKCE callback)
     - [`app/(auth)/update-password/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/%28auth%29/update-password/page.tsx#L22-L140) (uses browser `supabase.auth.updateUser`)
     - [`app/api/links/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/links/route.ts#L47-L246) (uses Supabase `portal_links` / `supabaseMock` instead of D1 `portal_links`)
     - [`app/api/orders/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/orders/route.ts#L50-L247) & [`app/api/reconcile/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/reconcile/route.ts#L23-L76) (uses Supabase `merch_orders` / in-memory array instead of D1 `merch_orders`)
     - [`app/api/telemetry/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/telemetry/route.ts#L15-L67) & [`lib/telemetry-server.ts`](file:///home/rem/Projects/kclmc-portal/lib/telemetry-server.ts#L29-L37) (uses Supabase `telemetry_events` instead of D1 `telemetry_events`)
     - [`app/api/health/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/health/route.ts#L16-L31) (queries Supabase `shop_items` instead of D1 `SELECT 1`)
     - [`app/api/admin/bmc-insurance/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/admin/bmc-insurance/route.ts#L68-L176) (queries Supabase `bmc_dispatches` & `profiles` instead of D1)
     - [`app/admin/content/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/admin/content/page.tsx#L52-L310), [`app/(kclmc)/drops/kclmc/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/%28kclmc%29/drops/kclmc/page.tsx#L63), [`app/(kclmc)/guides/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/%28kclmc%29/guides/page.tsx#L157), [`app/(lube)/drops/lube/page.tsx`](file:///home/rem/Projects/kclmc-portal/app/%28lube%29/drops/lube/page.tsx#L20)
     - [`.github/workflows/supabase-keepalive.yml`](file:///home/rem/Projects/kclmc-portal/.github/workflows/supabase-keepalive.yml)
- **Safe Removal Plan**:
  1. **Immediate (Track A)**: Remove hardcoded `DEFAULT_URL` / `DEFAULT_KEY` from `lib/supabase/server.ts` and `lib/supabase/client.ts` so `isSupabaseConfigured()` returns `false` unless `NEXT_PUBLIC_SUPABASE_URL` is explicitly set in the environment.
  2. **Seam Consolidation (Track B)**: Wire `/api/auth/signup`, `/api/links`, `/api/orders`, `/api/reconcile`, `/api/telemetry`, `/api/health`, and `/api/admin/bmc-insurance` to D1 (`getD1Database()`), then retire `PostgresRosterAdapter`, `lib/supabase/*`, `.github/workflows/supabase-keepalive.yml`, and `@supabase/*` packages.

---

### `[RED-03]` Duplicate Wrangler Config (`wrangler.toml` vs `wrangler.jsonc`) & `sample.env` Drift
- **Why It's Dead**:
  - Both [`wrangler.jsonc`](file:///home/rem/Projects/kclmc-portal/wrangler.jsonc) and [`wrangler.toml`](file:///home/rem/Projects/kclmc-portal/wrangler.toml) exist in the repo root.
  - `wrangler.toml` has already drifted behind `wrangler.jsonc`: `wrangler.jsonc:44-55` defines `previews.d1_databases` and `previews.send_email`, whereas `wrangler.toml:38-51` only defines `[previews.vars]` (missing D1 and Email bindings in previews if `wrangler.toml` is ever used).
  - [`sample.env`](file:///home/rem/Projects/kclmc-portal/sample.env) documents legacy Supabase/Stripe keys (`DATABASE_URL` port 6543, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) while omitting active D1/Better Auth keys (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EMAIL_FROM`, `ROSTER_STORAGE_ENGINE`, `CLOUDFLARE_D1_DATABASE_ID`).
- **Safe Removal Plan**:
  - Delete `wrangler.toml` and standardize exclusively on `wrangler.jsonc`.
  - Update `sample.env` to document `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `EMAIL_FROM`, `ROSTER_STORAGE_ENGINE`, and `CLOUDFLARE_D1_DATABASE_ID`, and mark Supabase/Stripe variables as deprecated/removed.

---

### `[RED-04]` Throwaway Migration/Debug Scripts, Broken `package.json` Script, and Duplicate Docs/SQL Files
- **Files Affected**:
  - **One-Off / Throwaway Scripts in `scripts/` (Archive or Delete)**:
    1. [`scripts/debug_admin_auth.ts`](file:///home/rem/Projects/kclmc-portal/scripts/debug_admin_auth.ts) — Interactive Playwright trace script targeting a personal `workers.dev` preview URL.
    2. [`scripts/migrate_2fa_secrets_to_d1.ts`](file:///home/rem/Projects/kclmc-portal/scripts/migrate_2fa_secrets_to_d1.ts) — One-off migration of legacy Supabase TOTP secrets to D1.
    3. [`scripts/migrate_d1_to_better_auth.ts`](file:///home/rem/Projects/kclmc-portal/scripts/migrate_d1_to_better_auth.ts) — One-off migration from legacy D1 `users` table to Better Auth `"user"` table.
    4. [`scripts/generate_d1_seed_from_supabase.ts`](file:///home/rem/Projects/kclmc-portal/scripts/generate_d1_seed_from_supabase.ts) — One-off SQL seed generator.
    5. [`scripts/sync_supabase_auth_users_to_d1.ts`](file:///home/rem/Projects/kclmc-portal/scripts/sync_supabase_auth_users_to_d1.ts) — One-off Supabase GoTrue user sync.
  - **Permanent Operational Scripts (Retain)**:
    - [`scripts/check_frontend_copy.ts`](file:///home/rem/Projects/kclmc-portal/scripts/check_frontend_copy.ts), [`scripts/backup_database.ts`](file:///home/rem/Projects/kclmc-portal/scripts/backup_database.ts), [`scripts/send_bmc_insurance_emails.ts`](file:///home/rem/Projects/kclmc-portal/scripts/send_bmc_insurance_emails.ts), [`scripts/verify_email_system.ts`](file:///home/rem/Projects/kclmc-portal/scripts/verify_email_system.ts).
  - **Broken `package.json` Script**:
    - [`package.json:10`](file:///home/rem/Projects/kclmc-portal/package.json#L10): `"bmc:format": "tsx scripts/format_bmc_export.ts"` references a non-existent file (`scripts/format_bmc_export.ts` does not exist).
    - [`package.json:17`](file:///home/rem/Projects/kclmc-portal/package.json#L17): `"lint": "next lint"` uses `next lint` (removed in Next.js 16) without `eslint` installed.
  - **Duplicate SQL & Handover Files**:
    - [`d1/better_auth_init.sql`](file:///home/rem/Projects/kclmc-portal/d1/better_auth_init.sql) and [`d1/better_auth_tables.sql`](file:///home/rem/Projects/kclmc-portal/d1/better_auth_tables.sql) duplicate lines 6–70 of [`d1/schema.sql`](file:///home/rem/Projects/kclmc-portal/d1/schema.sql#L6-L70).
    - [`d1/schema.sql:72-110`](file:///home/rem/Projects/kclmc-portal/d1/schema.sql#L72-L110) defines legacy `users`, `sessions`, and `password_resets` tables that duplicate Better Auth's `"user"`, `"session"`, `"account"`, and `"verification"` tables.
    - [`handover.md`](file:///home/rem/Projects/kclmc-portal/handover.md) and [`SESSION_HANDOVER.md`](file:///home/rem/Projects/kclmc-portal/SESSION_HANDOVER.md) both exist at the repo root.
- **Safe Removal Plan**:
  - Remove the 5 one-off migration/debug scripts, remove the broken `"bmc:format"` script from `package.json`, consolidate `handover.md` into `SESSION_HANDOVER.md`, and consolidate `d1/better_auth_tables.sql` into `d1/schema.sql`.

---

### `[RED-05]` Unused NPM Dependencies & Orphaned Legacy Components
- **Files Affected**:
  - [`package.json`](file:///home/rem/Projects/kclmc-portal/package.json#L23-L52):
    - `clsx` (`^2.1.1`) — **0 imports** across the codebase.
    - `framer-motion` (`^13.2.0`) — **0 imports** across the codebase.
    - `lucide-react` (`^1.45.0`) — **0 imports** across the codebase.
    - `tailwind-merge` (`^3.7.0`) — **0 imports** across the codebase.
    - `@types/qrcode.react` (`^1.0.5`) — **0 imports**, misplaced in `dependencies`, and obsolete (`qrcode.react` v4.2.0 ships built-in TypeScript types).
    - `playwright` (`^1.64.1`) — Only imported by `scripts/debug_admin_auth.ts`.
  - [`components/legacy/ScorecardEngine.tsx`](file:///home/rem/Projects/kclmc-portal/components/legacy/ScorecardEngine.tsx) (495 lines) — Orphaned component with **0 imports** anywhere in `app/`, `components/`, or `tests/`.
- **Safe Removal Plan**:
  - Uninstall `clsx`, `framer-motion`, `lucide-react`, `tailwind-merge`, `@types/qrcode.react` (and `playwright` once `debug_admin_auth.ts` is retired) and delete `components/legacy/ScorecardEngine.tsx`.

---

## 3. Cloudflare & Edge Runtime Hygiene

### `[EDGE-01]` Session Cookie `SameSite=Strict` Override Dropping Sessions on Cross-Site Navigation
- **Files & Lines**:
  - [`lib/security/cookies.ts`](file:///home/rem/Projects/kclmc-portal/lib/security/cookies.ts#L3-L45) (lines 3–9, 38–44)
  - [`middleware.ts`](file:///home/rem/Projects/kclmc-portal/middleware.ts#L161-L168) (lines 161–168)
  - [`lib/supabase/server.ts`](file:///home/rem/Projects/kclmc-portal/lib/supabase/server.ts#L44-L50) (lines 44–50)
  - [`lib/auth/session.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/session.ts#L271-L278) (lines 271–278, 746–750)
- **Details**:
  - While `lib/auth/better-auth.ts:127` and `lib/auth/session.ts:275` configure Better Auth cookies with `sameSite: 'lax'`, `AuthSessionService.toApiResponse()` (`lib/auth/session.ts:747`) passes `outcome.cookiesToSet` into `applySessionCookies()` (`lib/security/cookies.ts:38-44`), which **hard-overrides `sameSite: 'strict'`**!
  - Similarly, `SESSION_COOKIE_OPTIONS` (`lib/security/cookies.ts:6`), `middleware.ts:166`, and `lib/supabase/server.ts:49` all enforce `sameSite: 'strict'`.
  - Under `SameSite=Strict`, browsers do not send session cookies on top-level cross-origin navigations (such as clicking a magic link or password reset link from an email client, or redirecting back from KCLSU/WhatsApp).
- **Recommended Patch**:
  - Change `sameSite` from `'strict'` to `'lax'` in `SESSION_COOKIE_OPTIONS` and `applySessionCookies()` in `lib/security/cookies.ts`, `middleware.ts:166`, and `lib/supabase/server.ts:49` (and update any tests in `tests/security.test.ts` or `tests/auth_session.test.ts` that assert on `SameSite`).

---

### `[EDGE-02]` Raw Node `tls.connect` SMTP Socket & Unbounded Sequential Sleep Loop in `/api/admin/bmc-insurance`
- **Files & Lines**:
  - [`lib/bmc_smtp.ts`](file:///home/rem/Projects/kclmc-portal/lib/bmc_smtp.ts#L7-L60) (lines 7, 36–60)
  - [`app/api/admin/bmc-insurance/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/admin/bmc-insurance/route.ts#L335-L450) (lines 13, 335–450)
- **Details**:
  - `lib/bmc_smtp.ts` imports Node's `tls` module (`import tls from 'tls'`) and opens raw TLS sockets (`tls.connect(port, host)`) per email.
  - In `app/api/admin/bmc-insurance/route.ts:405-448`, `action === 'send'` iterates sequentially over all unsent recreational members, awaiting `sendSmtpEmail` (12,000ms timeout), a Supabase `upsert`, and a `350ms` `setTimeout` per recipient. On Cloudflare Workers, a batch of 50+ members will exceed subrequest limits (50 subrequests on standard plans) or wall-clock timeouts.
- **Recommended Patch**:
  - Prefer the chunked `send-batch` action (already capped at 8 recipients at line 287) or dispatch via the Cloudflare Email Service binding (`env.EMAIL` in `lib/email/service.ts`), and deprecate the unbounded `action === 'send'` path in `/api/admin/bmc-insurance`.

---

### `[EDGE-03]` Runtime `db.exec('CREATE TABLE IF NOT EXISTS "twoFactor"')` on Hot Login Paths & `getCloudflareEnv()` `globalThis` Fallback Leak
- **Files & Lines**:
  - [`lib/auth/session.ts`](file:///home/rem/Projects/kclmc-portal/lib/auth/session.ts#L391-L397) (lines 391–397, 575–581)
  - [`app/api/auth/setup-2fa/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/auth/setup-2fa/route.ts#L23-L33) (lines 23–33)
  - [`lib/db/d1.ts`](file:///home/rem/Projects/kclmc-portal/lib/db/d1.ts#L123) (line 123)
- **Details**:
  1. `lib/auth/session.ts:391` executes `db.exec('CREATE TABLE IF NOT EXISTS "twoFactor" ...')` on every committee login attempt. Executing DDL via `db.exec()` on hot request paths introduces unnecessary D1 write-lock overhead.
  2. In `lib/db/d1.ts:123`, `getCloudflareEnv()` falls back to `return (globalThis as any) || {}`. When called outside a Cloudflare Worker (e.g. local Node/Vitest), spreading `{ ...env, DB: db }` copies all properties of `globalThis` (timers, globals, constructors) into the config object passed to `createBetterAuth()`.
- **Recommended Patch**:
  - Remove runtime `CREATE TABLE IF NOT EXISTS` statements from request handlers and change line 123 of `lib/db/d1.ts` to `return (globalThis as any)?.__CF_ENV__ || {};`.

---

## 4. Data Integrity, SQLite Concurrency & Payments

### `[DATA-01]` Non-Batched Sequential D1 Writes & Missing "Survivor Rule" in `D1RosterAdapter.upsertRosterRecords()`
- **Files & Lines**:
  - [`lib/roster/d1-adapter.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster/d1-adapter.ts#L60-L122) (lines 60–122, 309–347)
  - [`lib/roster.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster.ts#L600-L675) (lines 600–675)
- **Details**:
  1. **Sequential Loop Instead of `db.batch()`**: `D1RosterAdapter.upsertRosterRecords()` (`lib/roster/d1-adapter.ts:314-345`) runs an individual `await db.prepare(...).bind(...).run()` inside a `for (const record of records)` loop. Uploading a 200-row KCLSU CSV executes 200 sequential D1 writes, risking `SQLITE_BUSY`, partial non-atomic commits, and Cloudflare Worker subrequest exhaustion.
  2. **Data Regression Bug (Missing Survivor Rule & Upgrade Protection in D1)**: Unlike `upsertRosterToSupabase()` (`lib/roster.ts:625-670`) and `InMemoryRosterAdapter` (`lib/roster/service.ts:825-860`), `D1RosterAdapter.upsertRosterRecords()` (`lib/roster/d1-adapter.ts:326-334`) blindly overwrites `full_name = excluded.full_name` and `tier = excluded.tier` on `ON CONFLICT(card_number) DO UPDATE`! This means:
     - Manually curated member full names in D1 are overwritten back to raw single-word surnames on the next CSV sync.
     - A member who upgraded from `social` to `recreational` can be downgraded back to `social` if a CSV containing only their Social transaction is synced.
     - Incoming Associate rows (`ASSOC-SU-...`) are not reconciled by full name against committee-issued `ASSOC-26XX` records in D1, creating duplicate Associate entries.
  3. **Pass Expiry Date Mismatch**: `D1RosterAdapter.verifyPublicPass()` (`lib/roster/d1-adapter.ts:300`) returns `expires: '2027-07-31'`, whereas `PostgresRosterAdapter` and `InMemoryRosterAdapter` return `'2027-08-31'`.
- **Recommended Patch**:
  - Port the Survivor Rule (retaining complete/curated `full_name` and preserving `'recreational'` tier against `'social'` downgrades) and Associate name matching into `D1RosterAdapter.upsertRosterRecords()`, execute writes in chunked `await db.batch(statements)` batches (e.g., 50 statements per batch), and align `expires` to `'2027-08-31'`.

---

### `[DATA-02]` Dual User Table Foreign Key Hazard (`profiles.id REFERENCES users(id)` vs Better Auth `"user"`)
- **Files & Lines**:
  - [`d1/schema.sql`](file:///home/rem/Projects/kclmc-portal/d1/schema.sql#L6-L16) (lines 6–16, 72–82, 112–126)
  - [`lib/roster/d1-adapter.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster/d1-adapter.ts#L79-L90) (lines 79–90)
- **Details**:
  - `d1/schema.sql:113` defines `profiles.id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`, pointing to the legacy `users` table (`line 72`) rather than Better Auth's `"user"` table (`line 6`).
  - `D1RosterAdapter.upsertProfile()` works around this by inserting dummy shadow rows (`${userId}@shadow.kclmc.internal`) into `users` before every profile write (`lib/roster/d1-adapter.ts:81-90`). Any profile insert outside `D1RosterAdapter` (or when `users.email` collides) fails with a SQLite foreign key or unique constraint error.
- **Recommended Patch**:
  - Migrate `profiles` in `d1/schema.sql` to reference `"user"("id")` (or drop the FK constraint to the deprecated `users` table) and remove the shadow-user insert workaround.

---

### `[DATA-03]` Payment Reconciliation Idempotency & Status Regression in `/api/reconcile`
- **Files & Lines**:
  - [`app/api/reconcile/route.ts`](file:///home/rem/Projects/kclmc-portal/app/api/reconcile/route.ts#L23-L99) (lines 23–99)
  - [`sample.env`](file:///home/rem/Projects/kclmc-portal/sample.env#L45-L47) (lines 45–47)
- **Details**:
  1. **No Stripe Integration Present**: There is no `stripe` SDK dependency or `/api/webhooks/stripe` endpoint in the codebase; payments are processed externally via the KCLSU shop and reconciled via CSV upload (`/api/roster` for memberships, `/api/reconcile` for merch orders).
  2. **Status Regression on Re-Reconciliation**: In `POST /api/reconcile` (`app/api/reconcile/route.ts:54-57, 89`), if a CSV is uploaded multiple times, an order that has already been marked `'collected'` (or `'fulfilled'`) is unconditionally overwritten back to `'paid'`.
  3. **N+1 Queries & Missing D1 Persistence**: `POST /api/reconcile` performs 2 sequential queries per CSV row against Supabase (or in-memory store) and never reads or updates D1's `merch_orders` table.
- **Recommended Patch**:
  - Wire `/api/reconcile` and `/api/orders` to D1 `merch_orders` using `db.batch()`, and skip updating status to `'paid'` if the order's current status is already `'paid'`, `'collected'`, or `'fulfilled'`.

---

### `[DATA-04]` Multiline Quoted Field & BOM Handling in `parseKclsuCsv()`
- **Files & Lines**:
  - [`lib/roster.ts`](file:///home/rem/Projects/kclmc-portal/lib/roster.ts#L406-L432) (lines 406–432)
  - [`lib/bmc_insurance.ts`](file:///home/rem/Projects/kclmc-portal/lib/bmc_insurance.ts#L127-L165) (lines 127–165)
- **Details**:
  - `parseKclsuCsv()` in `lib/roster.ts:407` splits the raw CSV string with `csvText.split('\n')` prior to quote-aware tokenization. If a KCLSU export row contains a newline inside a quoted field, the row is split across two lines, shifting column indices (`cols[0..7]`) and dropping or corrupting the member record.
  - Leading UTF-8 BOM (`\uFEFF`) is not stripped from `csvText` before parsing.
- **Recommended Patch**:
  - Strip leading `\uFEFF` and parse CSV records with a quote-aware character state machine before splitting rows.

---

## 5. Frontend Copy & Architecture Terminology

Running `npm run check:frontend-copy` scanned 59 files across `app/`, `components/`, and `public/`, flagging **105 total violations (34 Errors, 71 Warnings)** (`0` hardcoded localhost URLs in UI components):

### `[COPY-01]` Outdated "Supabase" References in Frontend UI & Client Components (34 Errors)

| File & Line(s) | Outdated Text / Code | Recommended Replacement |
| :--- | :--- | :--- |
| [`app/(auth)/update-password/page.tsx:55`](file:///home/rem/Projects/kclmc-portal/app/%28auth%29/update-password/page.tsx#L55) *(+ lines 22, 62, 69, 92, 111, 133)* | `setErrorMsg('Supabase credentials are not connected yet.');` and direct browser `supabase.auth.*` calls | Replace copy with `'Authentication service is not connected yet.'` and route password updates through `/api/auth/reset-password` (Better Auth / D1). |
| [`app/(legal)/privacy/page.tsx:128`](file:///home/rem/Projects/kclmc-portal/app/%28legal%29/privacy/page.tsx#L128) | `<strong>Supabase Inc.</strong> — Encrypted PostgreSQL database and authentication engine (EU London/Ireland region, AES-256 encrypted at rest).` | `<strong>Cloudflare D1 & Better Auth</strong> — Encrypted serverless edge SQLite database and authentication engine (EU/UK region, AES-256 encrypted at rest).` |
| [`app/admin/content/page.tsx:357`](file:///home/rem/Projects/kclmc-portal/app/admin/content/page.tsx#L357) *(+ lines 52, 72–74, 96, 260, 270, 282, 293, 305, 307)* | `<span className="text-zinc-200">Supabase Connected</span>` and `'CMS Supabase fetch error:'` | `<span className="text-zinc-200">Cloudflare D1 Connected</span>` and rename client variable `supabase` → `dbClient` / D1 API. |
| [`app/admin/export/page.tsx:482`](file:///home/rem/Projects/kclmc-portal/app/admin/export/page.tsx#L482) | `Live Supabase Join` | `Live Cloudflare D1 Join` |
| [`app/admin/modules/page.tsx:218,228`](file:///home/rem/Projects/kclmc-portal/app/admin/modules/page.tsx#L218) | `checked against your Supabase profile role` / `role >= 1 in Supabase profiles` | `checked against your Cloudflare D1 profile role` / `role >= 1 in Cloudflare D1 profiles` |
| [`app/admin/page.tsx:247`](file:///home/rem/Projects/kclmc-portal/app/admin/page.tsx#L247) | `<span>All changes persist to Supabase DB</span>` | `<span>All changes persist to Cloudflare D1</span>` |
| [`app/admin/reconcile/page.tsx:489`](file:///home/rem/Projects/kclmc-portal/app/admin/reconcile/page.tsx#L489) | `Source: {dbStats?.source === 'supabase' ? 'Supabase Postgres' : 'Local Fallback'}` | `Source: {dbStats?.source === 'cloudflare_d1' ? 'Cloudflare D1 (SQLite)' : 'Local Fallback'}` |
| [`app/status/page.tsx:26`](file:///home/rem/Projects/kclmc-portal/app/status/page.tsx#L26) | `description: 'Supabase PostgreSQL with Supavisor transaction pooling'` | `description: 'Cloudflare D1 serverless edge SQLite database'` |
| [`components/AdminSuperAdmin2FAReset.tsx:87`](file:///home/rem/Projects/kclmc-portal/components/AdminSuperAdmin2FAReset.tsx#L87) | `inherited a broken Supabase 2FA record during migration` | Replace `"Supabase"` with `"legacy"` so the active SuperAdmin 2FA reset component passes `check:frontend-copy`. |
| [`app/(kclmc)/drops/kclmc/page.tsx:63-64`](file:///home/rem/Projects/kclmc-portal/app/%28kclmc%29/drops/kclmc/page.tsx#L63), [`app/(kclmc)/guides/page.tsx:157,161`](file:///home/rem/Projects/kclmc-portal/app/%28kclmc%29/guides/page.tsx#L157), [`app/(lube)/drops/lube/page.tsx:20-21`](file:///home/rem/Projects/kclmc-portal/app/%28lube%29/drops/lube/page.tsx#L20) | Variable `const supabase = createClient()` matched by `check_frontend_copy.ts` | Rename local client variable (`dbClient`) or fetch from D1-backed server helpers so `npm run check:frontend-copy` passes with 0 errors. |

### `[COPY-02]` Active 2FA Messaging Flagged as Warnings by `check_frontend_copy.ts` (71 Informational Warnings — Retain Copy)

Because `scripts/check_frontend_copy.ts` was authored prior to commit `48d5fba` / `ccf1375` (which re-enabled Login Gate D1 2FA for committee members), its `DEPRECATED_2FA_MESSAGING` and `DEAD_2FA_API_ENDPOINTS` rules emit 71 non-blocking warnings (`severity: 'warning'`) across `app/(auth)/login/page.tsx`, `components/AdminTwoFactorCard.tsx`, and `components/AdminSuperAdmin2FAReset.tsx`. Since Login Gate 2FA is active in production, **these 2FA components and UI strings should be retained as-is**.

---

## 6. Proposed PR Action Plan

In compliance with `AGENTS.md`, all changes must be sliced into atomic branches, verified via the 3-step gate (`npm test`, `npx tsc --noEmit`, `npm run build:worker`), and merged via Pull Requests (never pushed directly to `main`).

### Track A (`quick/*` or `fix/*` — Atomic Bug Fixes, Security Hardening & Copy Cleanup)

1. **PR 1 (`fix/cloudflare-config-and-2fa-gate`)** — *Addresses `[SEC-01]`, `[RED-03]`, `[EDGE-01]`, `[EDGE-03]`*:
   - Delete duplicate `wrangler.toml` (retaining `ENFORCE_MANDATORY_2FA: "true"` in `wrangler.jsonc` and `sample.env` and keeping `enforce2FAGate` enabled in `lib/auth/session.ts`).
   - Remove the conflicting Better Auth built-in `twoFactor()` plugin from `lib/auth/better-auth.ts` and `lib/auth/better-auth-client.ts` so `auth.api.signInEmail` always returns `{ user, token }` to KCLMC's Login Gate 2FA handler in `lib/auth/session.ts`.
   - Standardize session cookies in `lib/security/cookies.ts`, `middleware.ts`, and `lib/supabase/server.ts` to `sameSite: 'lax'`.
   - Fix `getCloudflareEnv()` fallback in `lib/db/d1.ts:123` to return `{}` instead of `globalThis`.

2. **PR 2 (`fix/rbac-orders-and-rate-limit-security`)** — *Addresses `[SEC-02]`, `[SEC-03]`, `[SEC-04]`, `[SEC-05]`, `[SEC-06]`*:
   - Enforce server-side `user.role >= 2` clearance in `app/admin/ml/layout.tsx`.
   - Enforce disabled module checks in the fallback path of `middleware.ts` and in `POST /api/orders`.
   - Prioritize `cf-connecting-ip` over `x-forwarded-for` across all auth routes and restrict `'bypass_test_token'` in `verifyCaptchaToken()` to non-production environments.
   - Add `'collected'` and `'refunded'` to `allowedStatuses` in `PUT /api/orders` (fixing `/admin/scan`), enforce committee auth at the top of `GET /api/orders`, and add rate limiting to `/api/verify/[membershipId]`.

3. **PR 3 (`fix/frontend-copy-supabase-to-d1`)** — *Addresses `[COPY-01]`*:
   - Update all 34 `"Supabase"` copy/identifier occurrences across `app/(legal)/privacy/page.tsx`, `app/admin/page.tsx`, `app/admin/content/page.tsx`, `app/admin/export/page.tsx`, `app/admin/modules/page.tsx`, `app/admin/reconcile/page.tsx`, `app/status/page.tsx`, `app/(auth)/update-password/page.tsx`, `components/AdminSuperAdmin2FAReset.tsx`, `app/(kclmc)/drops/kclmc/page.tsx`, `app/(kclmc)/guides/page.tsx`, and `app/(lube)/drops/lube/page.tsx` so `npm run check:frontend-copy` reports **0 errors** and exits `0`.

### Track B (`refactor/*` — Subsystem Prunings, D1 Batching & Seam Consolidation)

4. **PR 5 (`refactor/d1-batch-concurrency-and-survivor-rule`)** — *Addresses `[DATA-01]`, `[DATA-02]`, `[DATA-03]`, `[DATA-04]`*:
   - Upgrade `D1RosterAdapter.upsertRosterRecords()` to use chunked `db.batch()` transactions, enforce the Survivor Rule (protecting curated names and `recreational` tier upgrades), reconcile Associate names, and align pass expiry to `'2027-08-31'`.
   - Harden `parseKclsuCsv()` against UTF-8 BOM and multiline quoted fields.
   - Update `d1/schema.sql` foreign key on `profiles` to reference `"user"("id")`.

5. **PR 6 (`refactor/prune-dead-deps-scripts-and-supabase-fallbacks`)** — *Addresses `[RED-01]`, `[RED-02]`, `[RED-04]`, `[RED-05]`, `[SEC-07]`*:
   - Remove hardcoded `DEFAULT_URL` / `DEFAULT_KEY` from `lib/supabase/server.ts` and `lib/supabase/client.ts` (resolving the 3 offline test timeouts in `npm test`).
   - Remove unused dependencies (`clsx`, `framer-motion`, `lucide-react`, `tailwind-merge`, `@types/qrcode.react`), orphaned `components/legacy/ScorecardEngine.tsx`, unused `/api/auth/verify-otp/route.ts` alias, broken `"bmc:format"` script, and the 5 one-off migration/debug scripts in `scripts/`.
