-- ============================================================
-- 008_roster_curated_names.sql
-- KCLMC Platform — Curated Member Names & Reconciliation Protection
-- ============================================================

-- Add index on full_name to optimize member lookups and autocomplete
create index if not exists idx_kclsu_roster_full_name on public.kclsu_roster(full_name);

-- Comment explaining the survivor rule architecture
comment on column public.kclsu_roster.full_name is 'Member full name. Manually curated edits are protected from CSV reconciliation overwrite via ETL survivor rules.';
