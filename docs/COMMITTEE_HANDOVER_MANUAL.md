# KCLMC Platform: Committee Architecture & Operations Handover Manual

**Organisation**: King's College London Mountaineering Club (KCLMC)  
**Parent Body**: King's College London Students' Union (KCLSU, Registered Charity No. 1136729)  
**Tenure Handover Date**: October 2026 / Academic Season 2026–2027  
**Custodians**: Outgoing & Incoming Platform Leads, President, Treasurer, Safety & Welfare Officer  
**Primary Domain**: [kclmc.org](https://kclmc.org) • **Platform Repositories**: `kclmc-platform` & `kclmc-portal`

---

## 1. Executive Summary & Handover Mission

Welcome to the **KCLMC Digital Operations Platform**. This platform is the core operational engine for the King's College London Mountaineering Club. It manages:

1. **Digital Climbing Passes**: Real-time pass issuance for active student climbers with cryptographic QR code validation for partner climbing walls and trip leaders.
2. **KCLSU Membership Reconciliation**: Ingestion and validation of official KCLSU payment reports with automated Soc-to-Rec membership tier upgrades.
3. **Trip & Meet Logistics**: Expedition calendar, participant roster management, and emergency medical contact access.
4. **Where We Climb (Beta & Topo Guides)**: Verified crag and indoor gym guides with direct links to the British Mountaineering Council (BMC) Regional Access Database (RAD) and UK Climbing (UKC) topos.
5. **Apparel & Merch Drops**: Stash pre-orders, custom member text embroidery, and transaction reconciliation.
6. **LUBE Competition Engine**: London University Bouldering Event multi-university league management, scoring, and live leaderboards.
7. **Statutory Legal & Safety Shielding**: Inherent mountaineering risk contracts (BMC Participation Statement), Equality Act 2010 accessibility protocols, and UK GDPR data compliance.

This manual provides incoming committee officers with a zero-friction guide to maintaining, deploying, configuring, and extending the platform throughout their tenure.

---

## 2. Tech Stack & Architecture Overview

The platform is designed to be **serverless, resilient, self-healing, and low-cost** (operating natively on Cloudflare Workers and Cloudflare D1 Edge SQLite).

```
+---------------------------------------------------------------------------------------------------+
|                                        CLIENT BROWSERS & MOBILES                                   |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v  (HTTPS / TLS 1.3)
+---------------------------------------------------------------------------------------------------+
|                         CLOUDFLARE EDGE NETWORK (Pages / Workers / DNS)                           |
|  - Edge caching, SSL termination, DDoS shielding, and bot mitigation                              |
|  - Built via OpenNext (@opennextjs/cloudflare) + Next.js 16 (App Router)                          |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+-------------------------------------------------+   +---------------------------------------------+
|       CLOUDFLARE D1 EDGE SQLITE (PRIMARY)       |   |            LOCAL IN-MEMORY FALLBACK         |
|  - Database: kclmc-production (d1/schema.sql)   |   |  - Zero-downtime offline mode               |
|  - Better Auth (Kysely D1) + Custom TOTP 2FA    |   |  - INITIAL_KCLSU_ROSTER static dataset      |
|  - PBKDF2 JIT password bumping                  |   |  - Active in local tests or if external     |
|  - Parameterized SQLite & chunked db.batch()    |   |    bindings are unconfigured                |
+-------------------------------------------------+   +---------------------------------------------+
```

### Component Technologies
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) with React 19.
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with custom KCLMC color palette (`#052322` Alpine Forest, `#FFBD59` Summit Gold, `#084746` Deep Pine).
- **TypeScript**: Strict mode with complete type coverage across models and routes.
- **Testing**: [Vitest](https://vitest.dev/) suite with 22 test files (328 unit, integration, and security tests).
- **Hosting / Edge Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) deployed via `@opennextjs/cloudflare` and `wrangler`.
- **Database / Auth**: [Cloudflare D1 (SQLite)](https://developers.cloudflare.com/d1/) + [Better Auth](https://www.better-auth.com/) with mandatory RFC 6238 Committee 2FA (`lib/security/two-factor.ts`).
- **Email Infrastructure**: [Purelymail](https://purelymail.com/) custom domain MX routing, SPF, DKIM, and DMARC.

---

## 3. Directory & Codebase Map

```
kclmc-platform/
├── app/                              # Next.js 16 App Router Routes
│   ├── (auth)/                       # Authentication group
│   │   ├── auth/callback/route.ts    # Supabase OAuth/Magic Link code exchange
│   │   ├── login/page.tsx            # Unified Sign-in, Sign-up & Password Reset
│   │   └── update-password/page.tsx  # Secure password reset submission
│   ├── (kclmc)/                      # KCLMC Public Club pages
│   │   ├── club/page.tsx             # Club constitution, ethos & history
│   │   ├── drops/kclmc/page.tsx      # Club merch stash ordering
│   │   ├── guides/page.tsx           # Where We Climb (Gyms, Crags, BMC RAD & UKC Topos)
│   │   ├── membership/page.tsx       # Digital Pass Viewer & Tier Guide
│   │   └── trips/page.tsx            # Expeditions & Meets calendar
│   ├── (legal)/                      # Statutory Legal Shielding
│   │   ├── accessibility/page.tsx    # Equality Act 2010 & Paraclimbing policy
│   │   ├── privacy/page.tsx          # UK GDPR & Data Protection manual
│   │   ├── safety/page.tsx           # BMC Participation Statement & Safety Notice
│   │   └── terms/page.tsx            # Voluntary Assumption of Risk & Terms
│   ├── (lube)/                       # London University Bouldering Event (LUBE)
│   │   ├── comps/page.tsx            # Competition schedule & venues
│   │   ├── drops/lube/page.tsx       # LUBE league merch
│   │   ├── leaderboard/page.tsx      # Multi-university live rankings
│   │   ├── lube/page.tsx             # LUBE landing portal
│   │   └── scoring/page.tsx          # Judge & competitor scorecard entry
│   ├── 403/page.tsx                  # Unauthorized access boundary
│   ├── admin/                        # Committee Management Suite
│   │   ├── content/page.tsx          # CMS for crags, guides, meets & stash
│   │   ├── export/page.tsx           # GDPR-compliant CSV data exports
│   │   ├── layout.tsx                # Committee RBAC gatekeeper
│   │   ├── ml/page.tsx               # Analytics & machine learning models
│   │   ├── modules/page.tsx          # Platform toggle dashboard
│   │   ├── page.tsx                  # Committee executive dashboard
│   │   ├── reconcile/page.tsx        # KCLSU CSV roster import & reconciliation
│   │   └── scan/page.tsx             # Mobile camera QR code pass scanner
│   ├── api/                          # Serverless Edge API Handlers
│   │   ├── health/route.ts           # Supabase inactivity keep-alive ping
│   │   ├── orders/route.ts           # Merch orders query, creation & status
│   │   ├── reconcile/route.ts        # Payment matching engine
│   │   ├── roster/link/route.ts      # Student ID to Supabase user linking
│   │   ├── roster/route.ts           # Roster listing & batch sync
│   │   ├── telemetry/route.ts        # Analytics events
│   │   └── verify/[membershipId]/    # Public QR verification endpoint
│   ├── pass/[orderCode]/page.tsx     # Direct pass & order receipt view
│   ├── register/page.tsx             # Permanent redirect to /login?view=sign_up
│   ├── layout.tsx                    # Root layout with Nav & Footer
│   └── page.tsx                      # Main Homepage
├── components/                       # Reusable React Components
│   ├── Confetti.tsx                  # Celebration animation on pass load
│   ├── Footer.tsx                    # Unified site footer with verified links
│   ├── MembershipCard.tsx            # Dynamic SVG/Canvas climbing pass
│   ├── Navigation.tsx                # Responsive top navigation & utility strip
│   └── PassCard.tsx                  # Merch/Event ticket pass component
├── config/                           # Modular system configurations
│   └── modules.config.ts             # Feature flags & architecture docs
├── d1/                               # Cloudflare D1 SQLite Schema & Seeds
│   └── schema.sql                    # Unified Edge SQLite schema & default portal_links
├── docs/                             # Official Committee Documentation
│   ├── ARCHITECTURE.md               # System design & module interfaces
│   ├── COMMITTEE_HANDOVER_MANUAL.md  # This document
│   ├── DATABASE_PRUNING_PLAN.md      # Database lifecycle & index optimization plan
│   └── LEGAL_COMPLIANCE_AND_RISK_AUDIT.md # ICO exemption & risk audit
├── lib/                              # Core Utilities & Deep Modules
│   ├── auth/                         # Better Auth D1 engine, server resolver & AuthSession
│   ├── db/d1.ts                      # Cloudflare D1 binding & context resolver
│   ├── roster/                       # D1RosterAdapter, MemberRosterService & seams
│   ├── security/                     # Rate limiter, PBKDF2 hasher, cookies & TOTP 2FA
│   ├── auth.ts                       # RBAC hierarchy & committee email resolver
│   ├── roster.ts                     # Roster parser, Soc-to-Rec logic, CSV sanitization
│   └── safety.ts                     # Duty-of-care completeness gatekeeper
├── scripts/                          # Operational Automation Scripts
│   ├── backup_database.ts            # UK GDPR Art. 32 automated JSON backup (D1 + Supabase)
│   ├── check_frontend_copy.ts        # Frontend copy & hygiene auditor
│   ├── migrate_supabase_to_d1.ts     # Incremental Supabase -> D1 synchronization script
│   └── verify_email_system.ts        # Purelymail DNS, SPF, DKIM, TLS inspector
├── tests/                            # Automated Vitest Testing Suite (22 suites / 328 tests)
│   ├── d1_adapter.test.ts            # D1 batching, Survivor Rule & profile join tests
│   ├── roster.test.ts                # CSV parsing & Soc-to-Rec upgrade tests
│   ├── security.test.ts              # OWASP Top 10, Rate Limiting, Turnstile & RBAC tests
│   ├── two_factor_enforcement.test.ts# Cross-isolate 2FA & rate-limit isolation tests
│   └── verify_pass.test.ts           # Pass verification & PII masking route tests
├── package.json                      # NPM dependencies & operational scripts
├── sample.env                        # Template environment configuration
└── wrangler.jsonc                    # Authoritative Cloudflare Worker & D1 deployment manifest
```

---

## 4. Database Schema & Edge Access Control

All production tables reside in **Cloudflare D1 (`kclmc-production`, DB ID: `25583bc2-683b-49ac-a5c0-2419a66f651a`)**. The authoritative, idempotent SQLite schema is located in [`d1/schema.sql`](../d1/schema.sql).

### Core Tables

| Table Name | Primary Key | Purpose | Key Columns |
| :--- | :--- | :--- | :--- |
| `"user"` | `id (text)` | Better Auth core user identity | `name`, `email (unique)`, `emailVerified`, `twoFactorEnabled`, `role (0,1,2)` |
| `"account"` | `id (text)` | Better Auth credentials & password hashes | `userId`, `providerId ('credential')`, `password (PBKDF2 or MIGRATED_ACCOUNT)` |
| `"session"` | `id (text)` | Better Auth active edge sessions | `userId`, `token (unique)`, `expiresAt`, `ipAddress`, `userAgent` |
| `"twoFactor"` | `id (text)` | Committee TOTP secrets & backup codes | `userId`, `secret`, `backupCodes (JSON)`, `verified` |
| `profiles` | `id (text -> user.id)` | Member safety & profile data | `full_name`, `student_id`, `role (0,1,2)`, `phone`, `emergency_contact_name`, `emergency_contact_phone`, `medical_notes` |
| `kclsu_roster` | `id (text)` | Ingested official KCLSU purchases | `card_number (unique, e.g. K25008223)`, `full_name`, `tier ('social'\|'recreational')`, `product_name`, `transaction_id`, `purchase_date`, `user_id`, `su_status` |
| `portal_links` | `id (text)` | Bio links directory (`/links`) | `title`, `url`, `subtitle`, `icon`, `sort_order`, `is_active`, `is_highlighted` |
| `bmc_dispatches` | `id (text)` | BMC liability insurance log | `card_number`, `email`, `full_name`, `sent_at`, `academic_year` |
| `trips` | `id (text)` | Club meets & calendar | `title`, `trip_type`, `date_start`, `date_end`, `location`, `price_pence`, `max_capacity`, `status` |
| `trip_registrations`| `id (text)` | Member registrations for trips | `trip_id`, `user_id`, `status ('confirmed'\|'waitlist'\|'cancelled')`, `emergency_contact_override` |
| `guides` | `id (text)` | Indoor gyms & crags | `title`, `category ('indoor'\|'crag')`, `location`, `grade_range`, `discount_info`, `website_url`, `sort_order`, `is_published` |
| `merch_orders` | `id (text)` | Stash orders & QR collection | `order_code (unique)`, `customer_name`, `customer_email`, `items (JSON)`, `status ('pending'\|'paid'\|'fulfilled'\|'collected'\|'cancelled'\|'refunded')`, `total_pence`, `brand ('KCL'\|'LUBE')` |
| `telemetry_events` | `id (text)` | Observability logs | `event_type`, `payload (JSON)`, `session_id`, `user_id`, `created_at` |

### Server-Side Access Control & Defense-in-Depth
Because Cloudflare D1 is bound strictly to the server-side Worker environment (`env.DB`) and never exposed directly to browser clients, access control is enforced at both the **Edge Middleware (`middleware.ts`)** and **API Route Handler** layers:
1. `profiles`: Authenticated users can read and update their own profile via `/api/membership` (cannot escalate their own `role`). Committee members (`role >= 1`) can view member safety contacts via `/api/roster`.
2. `kclsu_roster`: Public verification at `/api/verify/[membershipId]` is IP rate-limited and returns only masked student IDs (`***789`) without transaction IDs. Authenticated members link their own student ID via `/api/roster/link`. Committee members (`role >= 1`) have full reconciliation rights at `/api/roster`.
3. `portal_links` & `guides`: Public read for active/published items (`is_active = 1`). Creation, editing, and reordering restricted strictly to committee (`role >= 1`).
4. `merch_orders`: Public read strictly by matching `order_code`. Listing all orders and QR fulfillment status updates require `role >= 1`.
5. `/admin/ml`: Demand elasticity and sizing optimization dashboards require SuperAdmin clearance (`role >= 2`) enforced in `app/admin/ml/layout.tsx`.

---

## 5. Authentication Flow & Role-Based Permissions (RBAC)

The system implements a 3-tier Role-Based Access Control hierarchy defined in `lib/auth.ts`:

```ts
export type Role = 0 | 1 | 2;

0: 'Public / Climber'     // Standard student climber; can view personal pass & trips
1: 'Committee Member'     // Executive committee; access to /admin, scanner, reconciliation, CMS
2: 'SuperAdmin'           // Platform lead; schema updates, database backups, module configuration
```

### How Permissions Are Resolved
1. **Dynamic Database Role & Whitelist (`getAuthenticatedUserRole`)**:
   - When an authenticated user makes an API request or visits `/admin`, `getAuthenticatedUserRole(client, user)` evaluates their privileges.
   - It first evaluates their email against `SUPERADMIN_EMAIL` and `COMMITTEE_EMAILS`.
   - If their email is not hardcoded, it queries `public.profiles.role` for `id = user.id`. Users granted committee or admin status in Supabase are automatically recognized across both UI and API endpoints.
2. **Environment Variable Whitelist**:
   - `SUPERADMIN_EMAIL`: Defaults to `admin@kclmc.org` (and whitelists platform lead `remy.preston@outlook.com`). Anyone authenticated with this email receives **Role 2**.
   - `COMMITTEE_EMAILS`: Comma-separated list in `.env.local` or Cloudflare dashboard:
     ```bash
     COMMITTEE_EMAILS=kclmc.committee@gmail.com,president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org,trips@kclmc.org,social@kclmc.org,portal@kclmc.org,remy.preston@outlook.com,remy.preston@kcl.ac.uk
     ```
     Any user signing in with an email in this list automatically resolves to **Role 1 (Committee Member)** (or Role 2 if lead).
3. **Admin Layout Protection**: The `app/admin/layout.tsx` component automatically checks user authentication via `getAuthenticatedUserRole()`. If unauthenticated, it redirects to `/login?next=/admin`. If the authenticated user is not committee, it renders `app/403/page.tsx` (Forbidden).
4. **API Route Security & UK GDPR Protection**:
   - `GET /api/roster` & `POST /api/roster`: Strictly require `role >= 1` (Committee) via `getAuthenticatedUserRole()`. Protects all student names, student IDs, and transaction records from unauthenticated public enumeration or unauthorized tampering.
   - `GET /api/orders` (unfiltered) & `PUT /api/orders`: Strictly require `role >= 1` via `getAuthenticatedUserRole()` to prevent harvesting customer order histories or modifying payment states.
   - `GET /api/telemetry`: Requires `role >= 1` to inspect diagnostic events.
   - `GET /api/verify/[membershipId]`: Hardened against SQL injection, null bytes, buffer overflows, and malformed URI encodings.
   - **Open Redirect Prevention**: Login redirect queries (`?next=`) are validated through `getSafeRedirectUrl` (`lib/auth.ts`) to ensure redirection targets only internal relative paths (`/` only, no `//`, `/\`, or external schemes).

---

## 6. Membership Pass Lifecycle & KCLSU Reconciliation Engine

```
[Student buys on KCLSU Shop]
              │
              ▼
[KCLSU Admin Portal exports CSV]
              │
              ▼
[Committee navigates to /admin/reconcile and uploads CSV]
              │
              ▼
[parseKclsuCsv() processes data]:
  1. Validates KCL Student ID (starts with 'K')
  2. Cleans purchaser name: "HONNOLD, Alex" -> "Alex Honnold"
  3. Neutralizes CSV formula injection (=, +, -, @)
  4. Resolves Tiers:
     - [10166870] -> 'social' (£15)
     - [10002480] -> 'recreational' (£45)
     - [10188720] Soc-to-Rec Upgrade -> 'recreational' (Overrides earlier social row)
              │
              ▼
[Upsert to Supabase `kclsu_roster` table]
              │
              ▼
[Member registers/logs in at kclmc.org/login]
              │
              ▼
[Member visits /membership -> clicks "Link Student ID" -> enters K-number]
              │
              ▼
[/api/roster/link binds user_id to kclsu_roster record]
              │
              ▼
[MembershipCard displays active pass + QR code]
              │
              ▼
[Wall Desk / Trip Leader scans QR with /admin/scan]
              │
              ▼
[/api/verify/[membershipId] returns:
   - Valid: true
   - Member Name
   - Tier: Social / Recreational
   - Status: Active
   - Expiry: August 31, 2027]
```

### The Soc-to-Rec Upgrade Engine
KCLSU sells two primary memberships and an upgrade:
1. **Social Membership (£15)**: Bouldering, social meets, indoor walls.
2. **Recreational Membership (£45)**: Full insurance, outdoor trad/sport meets, gear hire, Scottish winter trips.
3. **Soc to Rec Upgrade (£30)**: For members who bought Social during Welcome Week and upgrade later.

The parsing engine in `lib/roster.ts` handles duplicates and upgrade sequencing:
- If a CSV contains both a Social purchase and an Upgrade purchase for the same student ID, the parser **strictly promotes the record to 'recreational'**, regardless of which row appears first in the file.
- The unit tests in `tests/roster.test.ts` verify this behavior against edge cases.

---

## 7. External Resources & Verified Links Reference

The following table documents all external canonical links used across the platform:

| Destination | Canonical Live URL | Purpose |
| :--- | :--- | :--- |
| **KCLSU Climbing Society** | `https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/` | Official union society page to buy passes |
| **KCLSU Policy Zone** | `https://www.kclsu.org/policyzone/` | Official union code of conduct & policies |
| **BMC Participation Statement** | `https://www.thebmc.co.uk/en/bmc-participation-statement` | Statutory voluntary assumption of risk notice |
| **BMC Regional Access Database** | `https://services.thebmc.co.uk/modules/rad/` | Official crag access restrictions & bird bans |
| **Harrison's Rocks BMC RAD** | `https://services.thebmc.co.uk/modules/RAD/View.aspx?id=119` | Access & sandstone rules (Harrison's Rocks) |
| **The Cuttings (Portland) BMC RAD**| `https://services.thebmc.co.uk/modules/RAD/View.aspx?id=299` | Access rules (Portland - The Cuttings Area) |
| **Stanage Edge BMC RAD** | `https://services.thebmc.co.uk/modules/RAD/View.aspx?id=150` | Access rules (Stanage / Eastern Gritstone) |
| **Bowles Rocks Access Info** | `https://bowles.rocks/individuals-and-families/rock-climbing/` | Reception permit and opening times |
| **UKC: Harrison's Rocks Topo** | `https://www.ukclimbing.com/logbook/crags/harrisons_rocks-57/` | Logbook & route topo for Harrison's Rocks |
| **UKC: Bowles Rocks Topo** | `https://www.ukclimbing.com/logbook/crags/bowles_rocks-54/` | Logbook & route topo for Bowles Rocks |
| **UKC: Portland The Cuttings** | `https://www.ukclimbing.com/logbook/crags/the_cuttings-276/` | Logbook & route topo for The Cuttings |
| **UKC: Stanage Popular Topo** | `https://www.ukclimbing.com/logbook/crags/stanage_popular-104/` | Logbook & route topo for Stanage Popular |
| **Mile End Climbing Wall** | `https://www.mileendwall.org.uk/` | Partner gym discount portal |
| **VauxWall East (LCC)** | `https://londonclimbingcentres.co.uk/locations/vauxwall-east/` | Partner bouldering gym portal |
| **The Castle Climbing Centre** | `https://www.castle-climbing.co.uk/` | Partner roped climbing gym portal |
| **The Arch (Climbing District)**| `https://climbingdistrict.uk/` | Partner bouldering gym portal |
| **Instagram** | `https://www.instagram.com/kclmc/` | Official club social updates & dispatches |
| **Club Email** | `mailto:kclmc.committee@gmail.com` | Official committee contact |

---

## 8. Environment Variables & Secrets Reference

Configuration templates are defined in [`sample.env`](../sample.env) and [`wrangler.jsonc`](../wrangler.jsonc).

```bash
# ------------------------------------------------------------------------------
# 1. Cloudflare D1 & Better Auth Core Configuration
# ------------------------------------------------------------------------------
ROSTER_STORAGE_ENGINE=d1
CLOUDFLARE_D1_DATABASE_ID=25583bc2-683b-49ac-a5c0-2419a66f651a
BETTER_AUTH_URL=https://kclmc.org
BETTER_AUTH_SECRET=your-64-char-hex-secret-key-here
ENFORCE_MANDATORY_2FA=true
TWO_FACTOR_ENCRYPTION_KEY=your-64-char-hex-secret-key-here

# ------------------------------------------------------------------------------
# 2. Role-Based Access Control (RBAC) Whitelists
# ------------------------------------------------------------------------------
SUPERADMIN_EMAIL=admin@kclmc.org
COMMITTEE_EMAILS=kclmc.committee@gmail.com,president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org,trips@kclmc.org,social@kclmc.org,portal@kclmc.org

# ------------------------------------------------------------------------------
# 3. Email Delivery & SMTP Configuration (Purelymail)
# ------------------------------------------------------------------------------
EMAIL_FROM=KCL Mountaineering <committee@kclmc.org>
SMTP_HOST=smtp.purelymail.com
SMTP_PORT=465
SMTP_USER=committee@kclmc.org
SMTP_PASS=your-purelymail-password
SMTP_FROM=King's College London Mountaineering Club <committee@kclmc.org>
```

> [!CAUTION]
> **Secret Key Isolation**: Never commit `BETTER_AUTH_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `SMTP_PASS` into git. The automated test `tests/security.test.ts` scans all source code and will fail `npm test` if any private secret or forbidden import is detected.

---

## 9. Deployment & Cloudflare / Wrangler Setup

The platform uses `@opennextjs/cloudflare` to transform Next.js 16 into a Cloudflare Workers bundle configured via [`wrangler.jsonc`](../wrangler.jsonc).

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run local dev server (port 3000)
npm run dev

# 3. Run all tests (22 suites / 328 tests)
npm test
```

### Production Build & Deployment
```bash
# Build standard Next.js application
npm run build

# Build OpenNext Cloudflare bundle (.open-next/worker.js)
npm run build:worker

# Deploy to Cloudflare Workers
npm run deploy:cloudflare
```

### Cloudflare Environment Setup
In the Cloudflare Dashboard (or via Wrangler CLI):
1. Navigate to **Workers & Pages** -> select the `kclmc-portal` Worker.
2. Verify D1 Database binding `DB` points to `kclmc-production` (`25583bc2-683b-49ac-a5c0-2419a66f651a`).
3. Set production secrets via CLI or Dashboard:
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put SMTP_PASS
   ```
4. Trigger a new deployment for changes to take effect.

---

## 10. Operational Health & GDPR Backup Jobs

### 1. System Health Check (`/api/health`)
- An endpoint is provided at `/api/health` (restricted to committee officers).
- Verifies Cloudflare D1 connectivity, database latency, and system environment readiness.

### 2. GDPR Data Redundancy Backup Script
Under Article 32 of UK GDPR, the club must maintain off-site data availability.
- Run the backup script:
  ```bash
  npm run backup
  ```
- This exports all Cloudflare D1 production tables (`kclsu_roster`, `profiles`, `users`, `portal_links`, `guides`) and legacy snapshots into timestamped JSON files in `backups/`.
- The `backups/` directory is explicitly excluded by `.gitignore` to prevent confidential student data from entering version control.

### 3. Email Infrastructure Verification
- Run the email diagnostic script:
  ```bash
  npm run test:email
  ```
- This verifies MX records, SPF records (`v=spf1 include:_spf.purelymail.com ~all`), DKIM (`purelymail._domainkey`), DMARC, and active TLS handshakes with `smtp.purelymail.com` and `imap.purelymail.com`.

---

## 11. Annual Committee Handover Checklist & Troubleshooting

### Handover Checklist (Outgoing -> Incoming Committee)

- [ ] **1. Cloudflare Account & D1 Access**:
  - Transfer or invite the incoming Platform Lead / President as an Administrator in Cloudflare (`dash.cloudflare.com`).
  - Verify nameservers for `kclmc.org` and D1 database `kclmc-production` remain active.
- [ ] **2. Purelymail & Email Routing**:
  - Provide master credentials for Purelymail management console.
  - Update forwarding addresses or aliases for `president@kclmc.org`, `treasurer@kclmc.org`, `gear@kclmc.org`, `trips@kclmc.org`.
- [ ] **3. GitHub Repositories**:
  - Add incoming leads as Administrators to `RemTypes/kclmc-portal`.
- [ ] **4. Update Committee Whitelist**:
  - Edit `COMMITTEE_EMAILS` in `wrangler.jsonc` / Cloudflare settings to reflect the new officers' email addresses, and set `role = 1` in D1 `"user"` and `profiles`.
- [ ] **5. New Academic Season Roster Setup**:
  - Log in to KCLSU eXpression / MSL union portal.
  - Download the Welcome Week climbing membership CSV.
  - Upload to `kclmc.org/admin/reconcile` to seed the new year's members into Cloudflare D1.
- [ ] **6. Run Full Verification Gate**:
  - Run `npm test`, `npx tsc --noEmit`, `npm run check:frontend-copy`, and `npm run build:worker` to ensure 100% clean passes before start of term.

### Troubleshooting Playbook

| Symptom | Cause | Remedy |
| :--- | :--- | :--- |
| **Pass shows "No official KCLMC membership found"** | Member hasn't been uploaded via KCLSU CSV or entered wrong K-number | Have member verify their K-number from their student ID card. Check `/admin/reconcile` to verify the KCLSU CSV report was uploaded to D1. |
| **Pass says "Student ID already linked to another account"** | Student registered with a personal email and is trying to link from a different account | Search student ID in D1 `profiles` or `kclsu_roster`. Clear the conflicting `user_id` or merge duplicate student profiles (see `docs/DATABASE_PRUNING_PLAN.md`). |
| **Committee officer locked out or needs 2FA reset** | Officer changed phone or lost authenticator app | A SuperAdmin (`role = 2`) can reset the officer's 2FA via the **SuperAdmin 2FA Reset** card on `/admin` (`/api/admin/reset-2fa`), allowing fresh QR enrollment on next login. |
| **Committee user gets redirected to 403 Forbidden on /admin** | Their email is not in the `COMMITTEE_EMAILS` whitelist or D1 role is 0 | Add their email to `COMMITTEE_EMAILS` in `wrangler.jsonc` or update their `role` to `1` in D1 `"user"` and `profiles`. |
| **QR code scanner doesn't open camera on phone** | Camera permissions blocked or site accessed via insecure HTTP | Ensure accessing via `https://kclmc.org/admin/scan` (cameras require HTTPS context). Allow browser camera permissions in phone settings. |

---

*Authored by the KCLMC Platform Engineering Team. Maintained for the climbers of King's College London.*
