# KCLMC Platform - Production Review & System Pruning Blueprint

This document defines the comprehensive production audit protocol for the **King's College London Mountaineering Club (KCLMC) Platform**. It instructs engineering agents on how to systematically inspect the codebase for latent defects, security gaps, and edge runtime risks, while safely pruning redundant or obsolete subsystems.

---

## 1. Engineering Governance & PR Rules

Every change resulting from this review must comply with the repository standards in [`AGENTS.md`](file:///Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform/AGENTS.md):

1. **Zero Direct Pushes to Main**:
   - Never push directly to `main` or `cloudflare-preview`.
   - All improvements, prunings, and bug fixes must be delivered via Pull Requests on tracked branches.
2. **Three-Tier Verification Gate**:
   Before submitting any PR or claiming an issue resolved, the agent MUST run:
   ```bash
   npm test               # All 275+ unit & integration tests must pass
   npx tsc --noEmit       # 0 TypeScript compilation errors
   npm run build:worker   # OpenNext Cloudflare worker compiles cleanly to .open-next/worker.js
   ```
3. **Commit & PR Conventions**:
   Strict conventional commits format: `type(scope): imperative subject in lowercase`.
   Scopes: `auth`, `roster`, `membership`, `safety`, `export`, `security`, `cloudflare`, `handover`, `rules`.
4. **Track Classification**:
   - **Track A (`quick/*` or `fix/*`)**: Atomic fixes, dead route removals, small config cleanups (<100 lines).
   - **Track B (`feat/*` or `refactor/*`)**: Seam consolidations, subsystem retirements.
   - **Track C (`epic/*`)**: Infrastructure migrations (`epic/replace-supabase`).

---

## 2. Review Methodology: The 5 Inspection Pillars

```
+-------------------------------------------------------------------------+
|                  KCLMC PLATFORM PRODUCTION AUDIT PILLARS                |
+--------------------+-------------------+--------------------------------+
| 1. Dead Systems    | 2. Edge Runtime   | 3. Security & RBAC             |
|    Pruning         |    Hygiene        |    Clearance                   |
| - 2FA residuals    | - OpenNext Worker | - Multi-layer route guards     |
| - Supabase seams   | - Node vs Web APIs| - Role 0 / 1 / 2 isolation     |
| - Scratch scripts  | - SameSite cookie | - Secrets leak prevention      |
+--------------------+-------------------+--------------------------------+
| 4. Data & Payments                     | 5. Bloat & Quality Gates       |
| - D1 SQLite concurrency / locks        | - npm dependency audit         |
| - Stripe webhook idempotency           | - Bundle size optimization     |
| - Roster reconciliation integrity      | - Full regression coverage     |
+----------------------------------------+--------------------------------+
```

---

### Pillar 1: Redundant & Dead Systems Triage

#### A. 2FA Subsystem Retirement
* **Current State**: Mandatory 2FA has been disabled (`isEnforce2FA = false` in `middleware.ts`, `enforce2FAGate = false` in `lib/auth/session.ts`).
* **Review Tasks**:
  1. Inspect `/api/auth/setup-2fa`, `/api/auth/verify-2fa`, `/api/auth/verify-otp`, and `/api/admin/reset-2fa`. Determine whether they should be kept for optional future self-service or cleanly decommissioned.
  2. Inspect `lib/security/two-factor.ts`: Identify dead challenge stores, backup code generators, and legacy token sealers that are no longer referenced in user flows.
  3. Inspect D1 Database: Evaluate whether the `"twoFactor"` table and `"user"."twoFactorEnabled"` column should be maintained or archived in a D1 migration.
  4. Inspect Cookies: Clean up references to `kclmc_2fa_pending` and `kclmc_2fa_verified`.

#### B. Supabase Seam Consolidation (ADR 0002)
* **Current State**: Transitioning from Supabase to Better Auth + Cloudflare D1.
* **Review Tasks**:
  1. Inspect `lib/roster/storage-factory.ts` and `lib/roster/d1-adapter.ts`. Determine if Supabase fallback logic can be phased out now that D1 is the primary storage engine.
  2. Inspect `lib/auth/session.ts` and `lib/auth/server.ts`. Verify if all user sessions can resolve directly against D1 without querying Supabase auth.
  3. Verify schema parity between `d1/migrations/` and `supabase/migrations/`.

#### C. Configuration & Scratch File Pruning
* **Review Tasks**:
  1. Audit `wrangler.jsonc` vs `wrangler.toml`. Consolidate onto `wrangler.jsonc` as the single canonical source of truth; eliminate drift.
  2. Audit `scripts/`: Categorize scripts into one-off migration tools (stage for archiving) vs permanent administrative utilities.

#### D. Frontend Copy & Outdated Terminology Audit
* **Current State**: Automated scanning utility available via `npm run check:frontend-copy` (`scripts/check_frontend_copy.ts`).
* **Review Tasks**:
  1. Run `npm run check:frontend-copy` to scan all frontend pages (`app/`), components (`components/`), and static files (`public/`).
  2. Identify and replace legacy architecture terms in visible text:
     - Replace "Supabase", "Supabase DB", "Supabase Postgres" with "Cloudflare D1" or "D1 SQLite".
     - Replace "Supabase Auth" or "Supabase Profile" with "Better Auth" or "Member Account".
  3. Clean up retired 2FA copy in user flows:
     - Remove "Two-Factor Authentication is required", "Activate 2FA", "Scan QR with Authenticator App", and 2FA challenge forms from `app/(auth)/login/page.tsx` and admin views.
  4. Ensure zero hardcoded localhost or development URLs exist in user-facing JSX/HTML.

---

### Pillar 2: Cloudflare Workers & OpenNext Edge Runtime Hygiene

#### A. Edge Runtime vs Node.js Built-in Modules
* **Context**: Next.js App Router on Cloudflare Workers runs in a `workerd` isolate.
* **Review Tasks**:
  1. Check for Node.js modules (`node:crypto`, `node:fs`, `node:path`, `node:stream`, `node:child_process`) imported in edge middleware or client components.
  2. Ensure `nodejs_compat` compatibility flag in `wrangler.jsonc` is enabled, and replace unsupported synchronous Node APIs with Web Standard equivalents (`crypto.subtle`, Web Streams).

#### B. Cloudflare Context & Environment Bindings
* **Review Tasks**:
  1. Audit `lib/db/d1.ts`: Ensure `getCloudflareEnv()` and `getD1Database()` reliably retrieve bindings across:
     - Next.js Server Components (`app/admin/page.tsx`)
     - Route Handlers (`app/api/...`)
     - Edge Middleware (`middleware.ts`)
     - Wrangler Preview environments
  2. Verify that `Symbol.for("__cloudflare-context__")` is handled gracefully without unhandled rejections.

#### C. Cookie Attributes & Navigation Retention
* **Review Tasks**:
  1. Audit `lib/security/cookies.ts` and `middleware.ts`.
  2. Ensure all session and identity cookies enforce:
     - `HttpOnly: true` (prevents XSS extraction)
     - `Secure: true` (in production)
     - `SameSite: 'Lax'` (ensures cookies are preserved on top-level cross-site GET navigations)
     - `Path: '/'`

---

### Pillar 3: Security, RBAC & Defense in Depth

#### A. Role Clearance (Defense in Depth)
* **Hierarchy**:
  - **Role 0**: Member / Climber
  - **Role 1**: Committee Member
  - **Role 2**: SuperAdmin
* **Review Tasks**:
  1. **Two-Layer Clearance Check**:
     - Layer 1 (Edge Middleware): `middleware.ts` rejects unauthorized requests before routing.
     - Layer 2 (Server Component / Route): Handlers invoke `getAuthenticatedUser()` and check `user.role >= 1` before rendering or returning data.
  2. Verify SuperAdmin-only paths (`/admin/ml`, `/api/admin/reset-2fa`) strictly enforce `user.role >= 2`.

#### B. Disabled Module Guard
* **Review Tasks**:
  1. Check `config/modules.config.ts`.
  2. Verify that when a module has `enabled: false`:
     - Regular members and public visitors are redirected to `/403?req=disabled`.
     - Direct calls to associated API endpoints (e.g. `/api/orders`, `/api/links`) reject with 403 Forbidden.

#### C. Secrets Hygiene & Sanitization
* **Review Tasks**:
  1. Ensure no live Stripe secret keys (`sk_live_...`), Supabase service keys, or Better Auth secrets are exposed in client bundles (`NEXT_PUBLIC_*`).
  2. Verify that `BANNED_SECRETS` blocks any deprecated or previously committed keys from being accepted.

#### D. Anti-Brute Force & Pass Scanner Security
* **Review Tasks**:
  1. Audit `lib/security/rate-limiter.ts`: Confirm exponential backoff and CAPTCHA lockout engage after repeated credential failures.
  2. Audit `/api/verify/[membershipId]`: Ensure digital pass QR signatures use HMAC verification and anti-replay timestamps.

---

### Pillar 4: Data Integrity, SQLite Concurrency & Payments

#### A. D1 Concurrency & `SQLITE_BUSY` Handling
* **Review Tasks**:
  1. Identify multi-statement mutations that should be batched via `db.batch([...])`.
  2. Verify that write queries catch transient database lock errors and retry or fail gracefully.

#### B. Stripe Webhook & Payment Reconciliation
* **Review Tasks**:
  1. Confirm Stripe webhook endpoints verify cryptographic signatures (`stripe.webhooks.constructEvent`).
  2. Verify idempotency: ensure repeated webhook deliveries do not issue duplicate climbing passes or record duplicate payments.

#### C. Roster & CSV Ingestion Safety
* **Review Tasks**:
  1. Audit KCLSU roster ingestion in `app/admin/reconcile/`.
  2. Test malformed CSV inputs, duplicate student IDs, and non-ASCII character handling.

---

### Pillar 5: Dependencies & Codebase Cleanliness

#### A. Package & Dependency Audit
* **Review Tasks**:
  1. Run `npm audit` to check for known vulnerabilities.
  2. Identify unused packages in `package.json` and remove them.

#### B. Dead Components & Unused Styles
* **Review Tasks**:
  1. Search for orphaned components in `components/` with zero imports.
  2. Check for unused CSS classes or deprecated assets in `public/`.

---

## 3. Review Execution Workflow for Agents (Error Hunting & Pruning)

### Target Git Repository & Directory Anchoring
- **Repository Root Directory**: `/Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform`
- **Active Working Branch**: `epic/replace-supabase`
- **Git Remotes**:
  - `origin`: `https://github.com/RemTypes/kclmc-platform.git`
  - `portal`: `https://github.com/RemTypes/kclmc-portal.git`
- **Working Directory Rule**: All inspection commands, tests, type checks, and copy scans MUST be run inside `/Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform`.

```
Phase 1: Read-Only Reconnaissance & Error Hunting
         - cd /Users/rem/Documents/Rem-Vault/KCLMC/kclmc-platform
         - Verify 292 tests pass: npm test
         - Audit frontend copy: npm run check:frontend-copy
         - Inspect git log, routes, edge middleware, D1 schemas, Stripe handlers
         │
         ▼
Phase 2: Generate Formal Findings Report (PRODUCTION_REVIEW_REPORT.md)
         - Output to docs/PRODUCTION_REVIEW_REPORT.md
         - Categorize by severity: Blocker, High, Medium, Low, Redundancy, Copy
         │
         ▼
Phase 3: Plan Atomic PR Milestones (Track A vs Track B)
         - Track A: Quick bug fixes and copy updates (<100 lines)
         - Track B: Structural seam consolidations and dead code removal
         │
         ▼
Phase 4: Execute & Verify Each Milestone
         - Cut dedicated branch for each milestone
         - Pass 3-step gate: npm test -> npx tsc --noEmit -> npm run build:worker
         - Open Pull Request via gh pr create (no direct pushes to main)
```
