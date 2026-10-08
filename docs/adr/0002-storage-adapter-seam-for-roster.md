# 0002. Storage Adapter Seam for Roster Reconciliation and Pass Verification

## Context

Society members purchase climbing memberships through the King's College London Students' Union (KCLSU) shop. These records are ingested into Supabase PostgreSQL (`kclsu_roster` and `profiles` tables). However, wall scanner verification and local/testing workflows require immediate pass verification without database round-trips or dependency on live Supabase connections.

Previously, four separate route handlers (`/api/membership`, `/api/roster/link`, `/api/roster`, and `/api/verify/[membershipId]`) each duplicated manual two-phase database lookups, admin-client failover logic to bypass RLS errors, and fallback checks against an in-memory array.

## Decision

We introduce a deep `MemberRosterService` module backed by a `RosterStorageAdapter` interface at a clean seam.

The module provides two concrete adapters:
1. `PostgresRosterAdapter`: encapsulates all Supabase database queries, user-client queries, admin service-role failover logic, and profile updates.
2. `InMemoryRosterAdapter`: operates over the canonical seeded `INITIAL_KCLSU_ROSTER` and an in-memory profile map for zero-dependency testing and offline resilience.

All pass resolution, roster linking, emergency safety gating, and wall verification logic lives entirely within `MemberRosterService`. Route handlers operate purely as thin HTTP adapters.

## Consequences

- Route handlers shrink to thin adapters with single-method delegations.
- RLS failovers and schema joins concentrate centrally within `PostgresRosterAdapter`.
- The entire roster lifecycle (lookup, linking, safety gating, scanning) can be unit-tested in-memory without database mocks.
