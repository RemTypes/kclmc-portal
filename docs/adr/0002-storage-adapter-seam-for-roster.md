# 0002. Storage Adapter Seam for Roster Reconciliation and Pass Verification

## Context

Society members purchase climbing memberships through the King's College London Students' Union (KCLSU) shop. Originally, these records were ingested into Supabase PostgreSQL (`kclsu_roster` and `profiles` tables). As the platform scaled on Cloudflare Workers, migrating to native **Cloudflare D1 (Edge SQLite)** was required for sub-10ms edge reads, zero cold-start connection overhead, and unified infrastructure, while still preserving zero-dependency local testing and offline resilience.

Previously, four separate route handlers (`/api/membership`, `/api/roster/link`, `/api/roster`, and `/api/verify/[membershipId]`) each duplicated manual database lookups, failover logic, and fallback checks against an in-memory array.

## Decision

We introduce a deep `MemberRosterService` module backed by a `RosterStorageAdapter` interface at a clean seam.

The module provides three concrete adapters:
1. `D1RosterAdapter` ([`lib/roster/d1-adapter.ts`](../../lib/roster/d1-adapter.ts)): Primary production adapter executing parameterized SQLite queries and chunked `db.batch()` writes against Cloudflare D1 (`kclmc-production`), enforcing the Survivor Rule on membership tier upgrades and deduplicating multi-profile joins.
2. `PostgresRosterAdapter`: Transitional fallback adapter encapsulating legacy Supabase PostgreSQL queries.
3. `InMemoryRosterAdapter`: Operates over the canonical seeded `INITIAL_KCLSU_ROSTER` and an in-memory profile map for zero-dependency testing and offline resilience.

All pass resolution, roster linking, emergency safety gating, and wall verification logic lives entirely within `MemberRosterService`. Route handlers operate purely as thin HTTP adapters.

## Consequences

- Migrating production storage from Supabase PostgreSQL to Cloudflare D1 required zero changes to API route handlers or frontend components.
- Route handlers shrink to thin adapters with single-method delegations.
- The entire roster lifecycle (lookup, linking, safety gating, scanning, batch reconciliation) can be unit-tested against both `InMemoryRosterAdapter` and `MockD1Database` in milliseconds.
