---
name: kclmc-production-review
description: Full-spectrum production readiness audit, bug detection, and dead/redundant system elimination for the KCLMC Platform (Next.js 16, Cloudflare Workers, D1 SQLite, Better Auth, Stripe). Use when preparing for a major release, cleaning up migration seams, auditing security/RBAC, or pruning obsolete systems.
---

# KCLMC Platform - Production Review & System Pruning Skill

This skill guides an AI coding agent through an exhaustive, evidence-backed production audit of the KCLMC Platform. It is engineered to uncover latent bugs, security vulnerabilities, edge runtime incompatibilities, and identify redundant or obsolete systems for safe elimination.

---

## 1. Operating Rules & Guardrails

### Target Repository Directory
- **Git Repository Directory**: `/Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform`
- **Active Working Branch**: `epic/replace-supabase`
- **Remotes**: `origin` (`https://github.com/RemTypes/kclmc-platform.git`), `portal` (`https://github.com/RemTypes/kclmc-portal.git`)
- **Working Directory Rule**: Always execute terminal commands (`npm test`, `npm run check:frontend-copy`, `npx tsc`) from inside `/Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform`.

The reviewing agent **MUST** adhere to the repository standards codified in [`AGENTS.md`](file:///Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform/AGENTS.md):

1. **Absolute Rule: No Direct Pushes to Main**
   - All proposed improvements, removals, and refactors must be committed to a feature/fix branch and merged via Pull Requests.
2. **Mandatory 3-Step Verification Gate**:
   Before submitting any change or declaring an audit item resolved, run and pass:
   ```bash
   npm test               # All 292+ unit & integration tests must pass
   npx tsc --noEmit       # 0 TypeScript compilation errors
   npm run build:worker   # OpenNext Cloudflare worker compiles cleanly (.open-next/worker.js)
   ```
3. **Atomic PR Slicing**:
   Never bundle unrelated cleanups into a single monolithic commit. Separate changes into distinct tracks:
   - **Track A (`quick/*` or `fix/*`)**: Small bug fixes, config deduplication, dead route removals (<100 lines).
   - **Track B (`feat/*` or `refactor/*`)**: Deprecations, seam consolidations, storage engine pruning.
   - **Track C (`epic/*`)**: Infrastructure migrations (e.g. `epic/replace-supabase`).

---

## 2. Core Audit Domains & Investigation Checklists

### Domain 1: Dead Code, Deprecated Routes & Redundant Systems
*Goal: Remove obsolete subsystems left behind by architectural migrations without breaking public contracts.*

- [ ] **2FA Function Removal & Dead Route Cleanup**:
  - **Context**: 2FA enforcement has been disabled (`isEnforce2FA = false` in `middleware.ts`, `enforce2FAGate = false` in `lib/auth/session.ts`).
  - **Audit Tasks**:
    - Audit `/api/auth/setup-2fa`, `/api/auth/verify-2fa`, `/api/auth/verify-otp`, and `/api/admin/reset-2fa`. Are any callers or UI components still hitting them?
    - Check D1 schema: Is the `twoFactor` table still required, or should it be dropped/deprecated in a migration?
    - Check `lib/security/two-factor.ts`: Prune unused in-memory challenge maps (`pendingChallenges`, `invalidatedChallenges`, `userTotpSecrets`) if the flow is retired.
    - Check cookie jar: Remove stale references to `kclmc_2fa_pending` and `kclmc_2fa_verified`.
- [ ] **Supabase to Better Auth / D1 Seam Consolidation**:
  - **Context**: The platform is migrating from Supabase to Cloudflare D1 via ADR 0002.
  - **Audit Tasks**:
    - Inspect `lib/roster/storage-factory.ts` and `lib/roster/d1-adapter.ts`. Is the Supabase fallback still required, or has D1 achieved 100% data coverage?
    - Inspect `lib/auth/session.ts` and `lib/auth/server.ts`. Does Better Auth handle all sessions cleanly? What happens if Supabase environment variables are removed?
    - Audit `supabase/migrations/` vs `d1/migrations/`. Are all schema definitions synchronized and version-controlled?
- [ ] **Configuration Duplication**:
  - Compare [`wrangler.jsonc`](file:///Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform/wrangler.jsonc) vs `wrangler.toml`. Having two Wrangler configuration formats risks silent drift. Choose one canonical configuration (`wrangler.jsonc`) and remove or link the other.
  - Audit `.env.local`, `sample.env`, and Wrangler `vars`. Ensure all required runtime variables are documented with clear defaults and no orphaned keys.
- [ ] **Scratch & Migration Scripts Triage**:
  - Audit `scripts/`: Identify one-off migration scripts (e.g. `scripts/migrate_2fa_secrets_to_d1.ts`, `scripts/debug_admin_auth.ts`). Move permanent operational tools to a structured `scripts/tools/` directory and safely archive or prune throwaway debugging scripts.
- [ ] **Frontend Copy & Architecture Terminology Audit**:
  - Run `npm run check:frontend-copy` (`scripts/check_frontend_copy.ts`) to audit all UI copy across `app/`, `components/`, and `public/`.
  - Replace outdated mentions of "Supabase" / "Supabase Postgres" / "Supabase DB" with "Cloudflare D1" or "D1 SQLite".
  - Replace "Supabase Auth" / "Supabase Profile" with "Better Auth" or "Member Account".
  - Clean up decommissioned 2FA copy (e.g., "Two-factor authentication is required", "Scan QR with Authenticator App", "Activate 2FA") in `app/(auth)/login/page.tsx` and admin components.
  - Verify zero hardcoded localhost or development URLs exist in frontend components.

---

### Domain 2: Cloudflare Workers & OpenNext Edge Runtime Hygiene
*Goal: Prevent runtime exceptions, memory bloat, and isolate desynchronization in production.*

- [ ] **Node.js vs. Edge Runtime Compatibility**:
  - Look for Node.js built-ins (`crypto`, `fs`, `path`, `stream`, `child_process`) imported in client components, edge middleware, or server routes.
  - Verify that modules running in OpenNext edge isolates utilize `nodejs_compat` flags or Web Standard APIs (`crypto.subtle`, `fetch`, `Headers`, `Request`, `Response`).
  - Address Next.js build warnings (e.g. `A Node.js module is loaded ('crypto') which is not supported in the Edge Runtime`).
- [ ] **Cloudflare Context & Environment Bindings**:
  - Audit `lib/db/d1.ts`: Ensure `getCloudflareEnv()` and `getD1Database()` reliably retrieve `env` across all runtime environments (Next.js server functions, middleware, local Vitest, and Wrangler previews).
  - Verify that `Symbol.for("__cloudflare-context__")` fallback functions cleanly in isolates where `getCloudflareContext()` throws.
- [ ] **Cookie Security & SameSite Compliance**:
  - Audit all `cookies().set(...)` and `response.cookies.set(...)` calls in `lib/security/cookies.ts`, `middleware.ts`, and route handlers.
  - Verify that session cookies use `HttpOnly: true`, `Secure: true` (in production), `Path: '/'`, and `SameSite: 'Lax'` (to prevent cross-site navigation drops).
  - Ensure expired cookies are deleted with proper domain and path attributes.

---

### Domain 3: Security, RBAC & Defense in Depth
*Goal: Ensure committee features, member data, and financial records are strictly protected.*

- [ ] **Role Clearance (RBAC) Defense in Depth**:
  - **Tiers**: Role 0 (Member/Climber), Role 1 (Committee), Role 2 (SuperAdmin).
  - **Check**: Clearance must be enforced in **two independent layers**:
    1. Edge Middleware (`middleware.ts`) blocks unauthorized URL paths (`/admin/*`, `/api/admin/*`, `/status`).
    2. Route Handlers / Page Components (`app/admin/layout.tsx`, `app/api/...`) perform server-side `getAuthenticatedUser()` checks before rendering or modifying data.
  - Verify that non-superadmins (Role < 2) cannot access `/admin/ml` or `/api/admin/reset-2fa`.
- [ ] **Disabled Module Leakage**:
  - Audit `config/modules.config.ts`. If a module is marked `enabled: false`:
    - Does `middleware.ts` block public access and redirect to `/403?req=disabled`?
    - Can a visitor circumvent the gate by invoking the backend API directly?
- [ ] **Secrets & Key Hygiene**:
  - Verify `BANNED_SECRETS` guards in `lib/security/` to prevent legacy or leaked secrets from ever being accepted in HMAC verification.
  - Check that Stripe live secret keys (`sk_live_...`) are never bundled into client-side JS (`NEXT_PUBLIC_*`).
- [ ] **Anti-Abuse & Rate Limiting**:
  - Audit `lib/security/rate-limiter.ts`: Confirm exponential backoffs and lockouts function on brute-force attempts.
  - Verify CAPTCHA validation flow.
  - Audit digital pass QR verification (`/api/verify/[membershipId]`): Confirm anti-replay signature checks prevent credential cloning.

---

### Domain 4: Data Integrity, SQLite Concurrency & Payments
*Goal: Prevent data loss, race conditions, and financial discrepancies.*

- [ ] **Cloudflare D1 Concurrency & `SQLITE_BUSY` Handling**:
  - D1 is single-writer SQLite. Check for concurrent write patterns (e.g. bulk CSV uploads or rapid webhook bursts) that could trigger `SQLITE_BUSY` or write timeouts.
  - Ensure batch mutations use `db.batch([...])` transactions.
- [ ] **Stripe Webhook Idempotency**:
  - Audit `/api/webhooks/stripe` (or checkout fulfillment handlers).
  - Confirm Stripe webhook signatures are validated against `STRIPE_WEBHOOK_SECRET` before processing.
  - Confirm orders use idempotent database writes (`ON CONFLICT` or pre-check on `stripe_session_id`) to prevent duplicate climbing pass issuance on webhook retries.
- [ ] **KCLSU Member Roster Reconciliation**:
  - Audit `app/admin/reconcile/` and `lib/roster/`.
  - Verify that student ID sanitation (`K1234567`) and Associate member card numbers (`ASSOC-XXXX`) handle malformed CSV rows gracefully.

---

### Domain 5: Codebase Bloat, Package Health & Testing Coverage
*Goal: Keep bundle size minimal, dependencies secure, and test suite representative.*

- [ ] **Dependency Audit**:
  - Run `npm audit` and inspect unused packages in `package.json`.
  - Remove dead packages or dev dependencies no longer used.
- [ ] **Test Coverage & Regression Prevention**:
  - Verify all 292+ tests pass with `npm test`.
  - Identify untested production paths (e.g. edge-case payment webhooks, pass scanner corner cases, associate member signup).

---

## 3. Production Review Output Format

When conducting the review, the agent must output a structured markdown report (`PRODUCTION_REVIEW_REPORT.md`) organized as follows:

```markdown
# KCLMC Platform - Production Review Report

## Executive Summary
- Overall Production Readiness Score: [A / B / C / F]
- Ship Verdict: [READY / CONDITIONAL / BLOCKED]
- Critical Vulnerabilities: [Count]
- Redundant Subsystems Identified: [Count]

## 1. High Priority (Blockers & Vulnerabilities)
- **[SEC-01] Title**: File and lines, root cause, blast radius, recommended patch.

## 2. Redundant & Dead Systems (Safe to Prune)
- **[RED-01] Subsystem Name**: Why it's dead, files affected, safe removal plan.

## 3. Cloudflare & Edge Runtime Hygiene
- **[EDGE-01] Issue**: Async context, cookie flags, or compatibility details.

## 4. Frontend Copy & Architecture Terminology
- **[COPY-01] Terminology**: File and lines, outdated text, recommended replacement.

## 5. Proposed PR Action Plan
1. PR 1 (Track A): Quick fixes and dead file removal.
2. PR 2 (Track B): Deprecation and seam consolidation.
```
