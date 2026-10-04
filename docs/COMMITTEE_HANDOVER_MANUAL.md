# KCLMC Platform: Committee Architecture & Operations Handover Manual

**Organisation**: King's College London Mountaineering Club (KCLMC)  
**Parent Body**: King's College London Students' Union (KCLSU, Registered Charity No. 1136043)  
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

The platform is designed to be **serverless, resilient, self-healing, and low-cost** (operating entirely within free/community tiers of Cloudflare and Supabase).

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
|             SUPABASE LIVE BACKEND               |   |            LOCAL IN-MEMORY FALLBACK         |
|  - PostgreSQL 15 database                       |   |  - Zero-downtime offline mode               |
|  - Row Level Security (RLS) policies            |   |  - INITIAL_KCLSU_ROSTER static dataset      |
|  - Supabase Auth (GoTrue magic links & pass)    |   |  - Active whenever Supabase is offline,     |
|  - PostgREST parameterized queries              |   |    unreachable, or unconfigured             |
+-------------------------------------------------+   +---------------------------------------------+
```

### Component Technologies
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) with React 19.
- **Styling**: [Tailwind CSS v3](https://tailwindcss.com/) with custom KCLMC color palette (`#052322` Alpine Forest, `#FFBD59` Summit Gold, `#084746` Deep Pine).
- **TypeScript**: Strict mode with complete type coverage across models and routes.
- **Testing**: [Vitest](https://vitest.dev/) suite with unit, integration, and static analysis security scans.
- **Hosting / Edge Runtime**: [Cloudflare Pages & Workers](https://workers.cloudflare.com/) deployed via `@opennextjs/cloudflare` and `wrangler`.
- **Database / Auth**: [Supabase](https://supabase.com/) (Managed PostgreSQL with Row Level Security and SSR Cookie Auth).
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
├── docs/                             # Official Committee Documentation
│   ├── COMMITTEE_HANDOVER_MANUAL.md  # This document
│   └── LEGAL_COMPLIANCE_AND_RISK_AUDIT.md # ICO exemption & risk audit
├── lib/                              # Core Utilities & Services
│   ├── auth.ts                       # RBAC hierarchy & committee email resolver
│   ├── roster.ts                     # Roster parser, Soc-to-Rec logic, CSV sanitization
│   ├── security.ts                   # Input validation & sanitization helpers
│   ├── store.ts                      # In-memory mock store
│   └── supabase/                     # Supabase SSR client factories
│       ├── client.ts                 # Browser client (anon key only)
│       └── server.ts                 # Server client (cookies + admin service role)
├── scripts/                          # Operational Automation Scripts
│   ├── backup_database.ts            # UK GDPR Art. 32 automated JSON backup
│   └── verify_email_system.ts        # Purelymail DNS, SPF, DKIM, TLS inspector
├── supabase/                         # Database Migration & Schema SQL
│   ├── consolidated_setup.sql        # Full idempotent database migration
│   └── migrations/                   # Individual migration steps (001-004)
├── tests/                            # Automated Vitest Testing Suite
│   ├── roster.test.ts                # CSV parsing & Soc-to-Rec upgrade tests
│   ├── security.test.ts              # SQLi, XSS, Secret Scan & RBAC tests
│   └── verify_pass.test.ts           # Pass verification route tests
├── package.json                      # NPM dependencies & operational scripts
├── sample.env                        # Template environment configuration
└── wrangler.json                     # Cloudflare Worker deployment manifest
```

---

## 4. Database Schema & Row-Level Security (RLS)

All tables live in the `public` schema in Supabase. The complete, idempotent database setup script is located in `supabase/consolidated_setup.sql`.

### Core Tables

| Table Name | Primary Key | Purpose | Key Columns |
| :--- | :--- | :--- | :--- |
| `profiles` | `id (uuid -> auth.users)` | User profile data | `full_name`, `student_id`, `role (0,1,2)`, `emergency_contact_name`, `emergency_contact_phone`, `medical_notes` |
| `kclsu_roster` | `id (bigint generated)` | Ingested official KCLSU purchases | `card_number (e.g. K25008223)`, `full_name`, `tier ('social'\|'recreational')`, `product_name`, `transaction_id`, `purchase_date`, `user_id` |
| `memberships` | `id (uuid)` | Legacy / platform passes | `membership_number`, `tier`, `valid_from`, `valid_until`, `is_active`, `payment_reference` |
| `trips` | `id (uuid)` | Club meets & calendar | `title`, `trip_type ('trad'\|'sport'\|'bouldering'\|'winter'\|'social')`, `date_start`, `date_end`, `location`, `price_pence`, `max_capacity`, `status` |
| `trip_registrations`| `id (uuid)` | Member registrations for trips | `trip_id`, `user_id`, `payment_status ('pending'\|'paid'\|'refunded')`, `emergency_contact_name`, `emergency_contact_phone` |
| `guides` | `id (uuid)` | Indoor gyms & crags | `title`, `category ('indoor'\|'crag')`, `location`, `grade_range`, `discount_info`, `website_url`, `map_url`, `topo_url`, `sort_order`, `is_published` |
| `shop_items` | `id (uuid)` | Apparel & stash products | `title`, `category`, `price_pence`, `sizes`, `is_active` |
| `merch_orders` | `id (uuid)` | Stash orders | `order_code`, `customer_name`, `customer_email`, `items (jsonb)`, `status ('pending'\|'paid'\|'fulfilled'\|'cancelled')`, `total_pence`, `brand ('KCL'\|'LUBE')` |
| `telemetry_events` | `id (uuid)` | Observability logs | `event_type`, `payload (jsonb)`, `session_id`, `created_at` |

### Row Level Security (RLS) Policy Architecture
Every single table has RLS explicitly enabled:
1. `profiles`: Users can select and update their own profile (cannot escalate their own `role`). Committee members (`get_user_role() >= 1`) can select all profiles. SuperAdmin (`get_user_role() = 2`) can update any profile.
2. `kclsu_roster`: Anyone can SELECT by `card_number` for pass verification. Users can link their own authenticated user ID to their `card_number`. Committee members have full INSERT/UPDATE/DELETE rights.
3. `memberships`: Users can read their own pass. Committee can view and manage all.
4. `trips` & `guides` & `shop_items`: Public read for published items (`is_published = true` or `status != 'draft'`). Write restricted strictly to committee.
5. `merch_orders`: Public read strictly by matching `order_code`. Listing all orders and status updates restricted to committee.

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
  2. Cleans purchaser name: "BALTENSPERGER, David" -> "David Baltensperger"
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

Configuration templates are defined in `sample.env`.

```bash
# ------------------------------------------------------------------------------
# 1. Supabase Public Client Credentials (Safe for browser / client components)
# ------------------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://bsvnyibipcwrcyzqilge.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg

# ------------------------------------------------------------------------------
# 2. Supabase Server & Admin Credentials (CONFIDENTIAL - Server side only)
# ------------------------------------------------------------------------------
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# ------------------------------------------------------------------------------
# 3. Role-Based Access Control (RBAC) Whitelists
# ------------------------------------------------------------------------------
SUPERADMIN_EMAIL=admin@kclmc.org
COMMITTEE_EMAILS=kclmc.committee@gmail.com,president@kclmc.org,treasurer@kclmc.org,gear@kclmc.org,trips@kclmc.org,social@kclmc.org,portal@kclmc.org

# ------------------------------------------------------------------------------
# 4. Email Delivery & SMTP Configuration (Purelymail)
# ------------------------------------------------------------------------------
SMTP_HOST=smtp.purelymail.com
SMTP_PORT=465
SMTP_USER=committee@kclmc.org
SMTP_PASS=your-purelymail-password
SMTP_FROM=King's College London Mountaineering Club <committee@kclmc.org>
```

> [!CAUTION]
> **Secret Key Isolation**: Never commit `SUPABASE_SERVICE_ROLE_KEY` or `SMTP_PASS` into git. Never import `@/lib/supabase/server` inside any file with `'use client'`. The automated test `tests/security.test.ts` scans all source code and will fail `npm test` if any private secret or forbidden import is detected.

---

## 9. Deployment & Cloudflare / Wrangler Setup

The platform uses `@opennextjs/cloudflare` to transform Next.js 16 into a Cloudflare Workers bundle.

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run local dev server (port 3000)
npm run dev

# 3. Run all tests
npm test
```

### Production Build & Deployment
```bash
# Build standard Next.js application
npm run build

# Build OpenNext Cloudflare bundle
npm run build:worker

# Deploy to Cloudflare Pages/Workers
npm run deploy:cloudflare
```

### Cloudflare Environment Setup
In the Cloudflare Dashboard:
1. Navigate to **Workers & Pages** -> select the `kclmc-platform` project.
2. Go to **Settings** -> **Variables and Secrets**.
3. Add the production values for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Store as Secret)
   - `SUPERADMIN_EMAIL`
   - `COMMITTEE_EMAILS`
4. Trigger a new deployment for the changes to take effect.

---

## 10. Operational Keep-Alive & GDPR Backup Jobs

### 1. Supabase Inactivity Keep-Alive
Supabase free-tier projects automatically pause after 7 consecutive days of database inactivity.
- An endpoint is provided at `/api/health`.
- This performs a lightweight query against `shop_items` and resets the 7-day timer.
- **Setup**: Configure an external uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com/) or [Cron-Job.org](https://cron-job.org/)) to send a `GET` request to `https://kclmc.org/api/health` once every 24 hours.

### 2. GDPR Data Redundancy Backup Script
Under Article 32 of UK GDPR, the club must maintain off-site data availability.
- Run the backup script:
  ```bash
  npm run backup
  ```
- This exports all database tables (`kclsu_roster`, `profiles`, `trips`, `guides`, `shop_items`, `merch_orders`) into a timestamped JSON file in `backups/`.
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

- [ ] **1. Cloudflare Account Access**:
  - Transfer or invite the incoming Platform Lead / President as an Administrator in Cloudflare (`dash.cloudflare.com`).
  - Verify nameservers for `kclmc.org` remain active.
- [ ] **2. Supabase Dashboard Access**:
  - Invite incoming committee leads to the Supabase Organization (`app.supabase.com`).
  - Check that the Project is active and not paused.
- [ ] **3. Purelymail & Email Routing**:
  - Provide master credentials for Purelymail management console.
  - Update forwarding addresses or aliases for `president@kclmc.org`, `treasurer@kclmc.org`, `gear@kclmc.org`, `trips@kclmc.org`.
- [ ] **4. GitHub Repositories**:
  - Add incoming leads as Administrators to `RemTypes/kclmc-platform` and `RemTypes/kclmc-portal`.
  - Check that `origin` and `portal` remotes are in sync.
- [ ] **5. Update Committee Whitelist**:
  - Edit `COMMITTEE_EMAILS` in Cloudflare settings to reflect the new officers' email addresses.
- [ ] **6. New Academic Season Roster Setup**:
  - Log in to KCLSU eXpression / MSL union portal.
  - Download the Welcome Week climbing membership CSV.
  - Upload to `kclmc.org/admin/reconcile` to seed the new year's members.
- [ ] **7. Run Full Test Suite**:
  - Run `npm test` and `npm run test:security` to ensure 100% clean passes before start of term.

### Troubleshooting Playbook

| Symptom | Cause | Remedy |
| :--- | :--- | :--- |
| **Pass lookup shows "Database not configured" or local preview** | `NEXT_PUBLIC_SUPABASE_URL` is missing or pointing to placeholder | Check `.env.local` or Cloudflare dashboard variables. Ensure valid HTTPS Supabase URL is set. |
| **Pass shows "No official KCLMC membership found"** | Member hasn't been uploaded via KCLSU CSV or entered wrong K-number | Have member verify their K-number from their student ID card. Check `/admin/reconcile` to verify the KCLSU CSV report was uploaded. |
| **Pass says "Student ID already linked to another account"** | Student registered with a personal email and is trying to link from a different account | Search student ID in Supabase `profiles` or `kclsu_roster`. Clear the conflicting `user_id` or contact `kclmc.committee@gmail.com`. |
| **Supabase database paused** | Free-tier 7-day inactivity pause triggered | Log into `supabase.com`, click **Restore Project**. Verify the uptime keep-alive ping to `https://kclmc.org/api/health` is firing daily. |
| **Committee user gets redirected to 403 Forbidden on /admin** | Their email is not in the `COMMITTEE_EMAILS` whitelist | Add their email to `COMMITTEE_EMAILS` in Cloudflare Variables and trigger a redeploy, or update their `role` to `1` in `public.profiles`. |
| **QR code scanner doesn't open camera on phone** | Camera permissions blocked or site accessed via insecure HTTP | Ensure accessing via `https://kclmc.org/admin/scan` (cameras require HTTPS context). Allow browser camera permissions in phone settings. |

---

*Authored by the KCLMC Platform Engineering Team. Maintained for the climbers of King's College London.*
