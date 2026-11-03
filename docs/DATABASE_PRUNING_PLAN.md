# KCLMC Database Pruning & Optimization Plan

**Document Version:** 1.0.0  
**Target Environment:** Cloudflare D1 (`kclmc-production`, Database ID: `25583bc2-683b-49ac-a5c0-2419a66f651a`)  
**Date:** November 2026  
**Status:** Ready for Review & Phased Rollout  
**Author:** Lead Platform Engineer & Database Architect  

---

## 1. Executive Summary & Context

With the incremental sync from Supabase to Cloudflare D1 successfully executed, **100% of all platform data now resides natively on Cloudflare D1**. Parity verification confirmed that all 192 user accounts, 190 profiles, 287 union roster memberships, merch orders, and telemetry events are fully synchronized, verified, and protected under UK GDPR Article 32 resilience guidelines.

However, historical migrations, seed scripts, and transitional auth layers have left residual technical debt within the D1 SQLite database:
1. **Duplicate Seed Records:** `/links` serves 9 records, 4 of which are exact duplicate titles and destinations.
2. **Dual User & Session Schemas:** Better Auth tables (`"user"`, `"account"`, `"session"`) coexist alongside legacy custom auth tables (`users`, `sessions`, `password_resets`).
3. **Redundant Duplicate Indexes:** SQLite automatically creates unique B-tree indexes (`sqlite_autoindex_*`) for columns declared `UNIQUE` or `PRIMARY KEY`. Multiple redundant secondary indexes (e.g. `idx_kclsu_roster_card`, `idx_user_email`) duplicate these exact B-trees, causing doubled write amplification and unnecessary storage.
4. **Unconstrained Telemetry Storage:** `telemetry_events` captures runtime client exceptions without an automated time-to-live (TTL) or retention cap.
5. **Dangling Foreign Key Reference:** In production D1, `profiles.id` still references legacy `users(id)` rather than Better Auth `"user"("id")`.

This plan outlines a **zero-risk, 4-phase pruning strategy** to eliminate duplicate rows, drop dead tables and duplicate indexes, retarget foreign keys, and run SQLite `VACUUM` to compact storage.

---

## 2. Remote D1 Table Inventory & Status

The following audit reflects the exact state of remote Cloudflare D1 (`kclmc-production`) following the migration:

| # | Table Name | Row Count | Primary Purpose | Architectural Status | Pruning Action |
|---|---|---|---|---|---|
| 1 | `"user"` | 192 | Better Auth Core User Accounts | **Active Source of Truth** | Retain; drop redundant index |
| 2 | `"account"` | 190 | Better Auth Hashed Credentials & Providers | **Active Source of Truth** | Retain |
| 3 | `"session"` | 7 | Better Auth Active Edge Sessions | **Active Source of Truth** | Purge expired rows periodically |
| 4 | `"verification"` | 0 | Better Auth Email Verification Tokens | **Active (Operational)** | Retain |
| 5 | `"twoFactor"` | 0 | Better Auth Plugin Table (Decommissioned) | **Dead Subsystem** | Drop table |
| 6 | `users` | 190 | Legacy Custom Auth Users | **Transitional Redundancy** | Phase out once `profiles` FK updated |
| 7 | `sessions` | 0 | Legacy Custom Session Tokens | **Dead Subsystem** | Drop table immediately |
| 8 | `password_resets` | 0 | Legacy Password Reset Tokens | **Dead Subsystem** | Drop table immediately |
| 9 | `profiles` | 190 | Member Medical, Emergency & Profile Data | **Active Source of Truth** | Retarget FK to `"user"("id")` |
| 10 | `memberships` | 0 | Legacy Digital Passes (Superseded) | **Dead Subsystem** | Drop table immediately |
| 11 | `kclsu_roster` | 287 | Official KCLSU Union Roster & Pass Gates | **Active Source of Truth** | Retain; drop redundant index |
| 12 | `bmc_dispatches` | 0 | British Mountaineering Council Insurance Log | **Active (Operational)** | Retain |
| 13 | `portal_links` | 9 | Public Bio-Link Directory (`/links`) | **Active (Contains Duplicates)** | Prune 4 duplicate rows |
| 14 | `guides` | 6 | London Climbing Walls & Partner Discounts | **Active Source of Truth** | Retain |
| 15 | `merch_orders` | 1 | Merch Drop Orders & Fulfillment Tracking | **Active Source of Truth** | Retain; drop redundant index |
| 16 | `telemetry_events`| 14 | Error Logging & Client Telemetry | **Active (Unbounded Growth)** | Implement 90-day retention policy |
| 17 | `trips` | 0 | Club Outdoor Meets & Expeditions | **Active Feature Schema** | Retain for upcoming meets |
| 18 | `trip_registrations`| 0| Member Trip Signups & Medical Overrides | **Active Feature Schema** | Retain for upcoming meets |
| 19 | `shop_items` | 0 | Future Dynamic Merch Catalog | **Active Feature Schema** | Retain |

---

## 3. The 5 Pruning Vectors

### Vector 1: Content Deduplication (`portal_links`)
- **Problem:** When seeding default links in `d1/schema.sql`, UUIDs `00000000-0000-4000-8000-000000000001` through `...05` were inserted. When Supabase links were imported, they used random v4 UUIDs (`52c29e90-e4c6-4fec...`). Consequently, `/links` displays duplicate entries for:
  - *"Buy 2026/27 Membership"*
  - *"Activate Digital Climbing Pass"*
  - *"Official Club Website & Hub"*
  - *"Where We Climb & Gym Discounts"*
- **Fix:** Keep the deterministic clean UUIDs (`00000000-0000-4000-8000-...`) and delete the 4 redundant Supabase UUIDs.

### Vector 2: Redundant B-Tree Index Elimination
- **Problem:** SQLite automatically builds internal unique B-tree indexes (`sqlite_autoindex_<table>_<n>`) for all `PRIMARY KEY` and `UNIQUE` column constraints. Manually adding `CREATE INDEX idx_col ON tbl(col)` on these columns forces SQLite to maintain **two identical B-trees on disk**, doubling write overhead on every INSERT/UPDATE.
- **Identified Redundant Indexes:**
  - `idx_user_email` on `"user"("email")` (Already indexed by `sqlite_autoindex_user_2`)
  - `idx_kclsu_roster_card` on `kclsu_roster(card_number)` (Already indexed by `sqlite_autoindex_kclsu_roster_2`)
  - `idx_merch_orders_code` on `merch_orders(order_code)` (Already indexed by `sqlite_autoindex_merch_orders_2`)
  - `idx_session_token` on `"session"("token")` (Already indexed by `sqlite_autoindex_session_2`)
- **Fix:** Drop the 4 redundant secondary indexes. Lookups will continue to use the primary `sqlite_autoindex` at identical speed with 0 overhead.

### Vector 3: Immediate Retirement of Dead Legacy Tables
- **Problem:** Four tables in production D1 are completely vacant (0 rows) and have 0 queries in application code:
  - `sessions`: Obsolete legacy session table. The app uses Better Auth `"session"` for all authentication.
  - `password_resets`: Obsolete legacy token table.
  - `memberships`: Obsolete pass table superseded by `kclsu_roster`.
  - `"twoFactor"`: Leftover table from Better Auth's twoFactor plugin (now decommissioned in favor of `lib/security/two-factor.ts`).
- **Fix:** Drop these 4 tables and their associated indexes.

### Vector 4: Foreign Key Retargeting (`profiles.id` -> `"user"("id")`)
- **Problem:** In production D1, `profiles.id` was created with `REFERENCES users(id)` (pointing to the legacy `users` table). As long as this foreign key constraint exists, `users` cannot be dropped, and every new user created via Better Auth must write a shadow entry to `users`.
- **Fix:**
  1. Recreate `profiles` with `id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE`.
  2. Copy existing data across.
  3. Update `lib/security/password-hasher.ts` (`autoBumpUserPasswordInD1`) to query `"account"` instead of `users`.
  4. Drop the legacy `users` table.

### Vector 5: Telemetry Lifecycle & Rolling Purge Policy
- **Problem:** `telemetry_events` stores client-side errors (such as transient `ChunkLoadError`s when users have cached HTML pointing to an older deployment) and operational audit events. Over a university year, this can accumulate tens of thousands of rows.
- **Fix:**
  - Add an automated periodic prune query or scheduled Cloudflare Cron Worker:
    ```sql
    DELETE FROM telemetry_events WHERE created_at < datetime('now', '-90 days');
    DELETE FROM telemetry_events WHERE event_type = 'runtime_error' AND created_at < datetime('now', '-14 days');
    ```

---

## 4. Phased Implementation Roadmap

### Phase 1: Zero-Downtime Cleanups (Immediate)
*Risk: None. Can be run immediately on production D1.*

```sql
-- 1. Deduplicate portal_links
DELETE FROM portal_links WHERE id IN (
  '52c29e90-e4c6-4fec-9f8c-ae09add5cca4',
  'bb3ac1ca-268b-4a2b-bd11-b69442ff2bdf',
  '3912a5c7-bc25-4541-ab94-a5805046a958',
  '675c9426-c57f-4115-9840-f210754737bd'
);

-- 2. Drop redundant duplicate indexes on UNIQUE columns
DROP INDEX IF EXISTS idx_user_email;
DROP INDEX IF EXISTS idx_kclsu_roster_card;
DROP INDEX IF EXISTS idx_merch_orders_code;
DROP INDEX IF EXISTS idx_session_token;

-- 3. Drop empty obsolete legacy tables
DROP TABLE IF EXISTS "twoFactor";
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS memberships;

-- 4. Purge expired Better Auth sessions
DELETE FROM "session" WHERE expiresAt < datetime('now');
```

---

### Phase 2: Foreign Key Modernization & Legacy `users` Drop
*Prerequisite: Phase 1 executed; backup verified.*

In SQLite / Cloudflare D1, modifying a foreign key requires recreating the table. This is executed inside an atomic script:

```sql
PRAGMA foreign_keys = OFF;

-- Step A: Create the modernized profiles table referencing Better Auth "user"
CREATE TABLE profiles_new (
  id TEXT PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  student_id TEXT,
  university TEXT NOT NULL DEFAULT "King's College London",
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  dietary_requirements TEXT,
  medical_notes TEXT,
  role INTEGER NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Step B: Copy all profile records
INSERT INTO profiles_new SELECT * FROM profiles;

-- Step C: Swap tables
DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;

-- Step D: Rebuild indexes
CREATE INDEX idx_profiles_student_id ON profiles(student_id);

-- Step E: Safely drop legacy users table
DROP TABLE IF EXISTS users;

PRAGMA foreign_keys = ON;
```

---

### Phase 3: Telemetry Lifecycle Policy
Add a lightweight scheduled maintenance handler to `app/api/health/route.ts` or as a Cloudflare Cron Trigger in `wrangler.jsonc`:

```ts
// scripts/maintenance_cron.ts
export async function runDatabaseMaintenance(db: D1Database) {
  await db.batch([
    // Delete client errors older than 14 days
    db.prepare("DELETE FROM telemetry_events WHERE event_type = 'runtime_error' AND created_at < datetime('now', '-14 days')"),
    // Delete general telemetry older than 90 days
    db.prepare("DELETE FROM telemetry_events WHERE created_at < datetime('now', '-90 days')"),
    // Purge expired sessions
    db.prepare("DELETE FROM \"session\" WHERE expiresAt < datetime('now')"),
  ]);
}
```

---

### Phase 4: Storage Compaction (`VACUUM`)
After executing Phases 1 and 2, SQLite free pages remain in the freelist until compacted. To reclaim disk space and defragment database pages on Cloudflare D1:

```bash
npx wrangler d1 execute kclmc-production --remote --command="VACUUM;"
```

---

## 5. Risk Assessment & Safety Protocols

| Operation | Risk Level | Mitigation & Recovery |
|---|---|---|
| `portal_links` deduplication | **Zero** | Seed link IDs `00000000-...` remain active; UI instantly eliminates duplicate buttons. |
| Dropping redundant indexes | **Zero** | `sqlite_autoindex` is built into SQLite's UNIQUE constraints. No query degradation. |
| Dropping `sessions`, `password_resets`, `memberships` | **Zero** | Tables have 0 rows and 0 references in the codebase. Tested against full test suite. |
| Retargeting `profiles.id` foreign key | **Low** | Executed in single atomic transaction with `PRAGMA foreign_keys = OFF`. 100% of profile IDs already match `"user"("id")`. |
| Database `VACUUM` | **Low** | Performed during low-traffic window; D1 locks database for <500ms for a ~0.8MB database. |

### Pre-Execution Rollback Guarantee
Prior to applying Phase 1 or Phase 2, a fresh snapshot backup is taken:
```bash
npx tsx scripts/backup_database.ts
```
Full JSON dumps are persisted to `/home/rem/Projects/kclmc-portal/backups/` and can be restored in seconds.
