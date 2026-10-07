-- ============================================================
-- 007_bmc_dispatches.sql
-- KCLMC Platform — Track BMC Insurance Form Dispatches
-- Prevents duplicate emails when broadcasting to new members later.
-- ============================================================

create table if not exists public.bmc_dispatches (
  id              uuid primary key default uuid_generate_v4(),
  card_number     text not null,                       -- KCL Student ID (e.g. 'K26135219')
  email           text not null,                       -- Official KCL email
  full_name       text not null default '',            -- Member full name
  sent_at         timestamptz not null default now(),  -- Dispatch timestamp
  academic_year   text not null default '2026/27',
  constraint uq_bmc_dispatches_card_year unique (card_number, academic_year)
);

create index if not exists idx_bmc_dispatches_card on public.bmc_dispatches(card_number);
create index if not exists idx_bmc_dispatches_email on public.bmc_dispatches(email);
create index if not exists idx_bmc_dispatches_year on public.bmc_dispatches(academic_year);

-- Enable Row Level Security
alter table public.bmc_dispatches enable row level security;

-- Committee officers (role >= 1) can read and manage dispatch logs
create policy "Committee can view and manage bmc_dispatches"
  on public.bmc_dispatches for all
  using ((select public.get_user_role()) >= 1);
