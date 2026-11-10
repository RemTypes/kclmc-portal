-- ============================================================
-- Migration 009: Portal Links (Bio Links Engine for /links)
-- Enables customizable Linktree-style directory for social media bios & KCLSU
-- ============================================================

create table if not exists public.portal_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  subtitle text,
  icon text not null default '🔗',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_highlighted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.portal_links enable row level security;

-- Drop any existing policies
drop policy if exists "Active portal links are viewable by everyone" on public.portal_links;
drop policy if exists "Committee can insert portal links" on public.portal_links;
drop policy if exists "Committee can update portal links" on public.portal_links;
drop policy if exists "Committee can delete portal links" on public.portal_links;

-- Public read access: Active links visible to all; committee can see all links
create policy "Active portal links are viewable by everyone"
  on public.portal_links for select
  using (
    is_active = true or public.get_user_role() >= 1
  );

-- Committee full write access (role >= 1)
create policy "Committee can insert portal links"
  on public.portal_links for insert
  with check (
    public.get_user_role() >= 1
  );

create policy "Committee can update portal links"
  on public.portal_links for update
  using (
    public.get_user_role() >= 1
  );

create policy "Committee can delete portal links"
  on public.portal_links for delete
  using (
    public.get_user_role() >= 1
  );

-- Seed default initial links with deterministic UUIDs
insert into public.portal_links (id, title, url, subtitle, icon, sort_order, is_active, is_highlighted)
values
  ('00000000-0000-4000-8000-000000000001', 'Buy 2026/27 Membership', 'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/', 'Official KCLSU Union Shop • Required for meets & pass', '🏛️', 1, true, true),
  ('00000000-0000-4000-8000-000000000002', 'Activate Digital Climbing Pass', '/membership', 'Safety gate, wall discount pass & verification QR', '🧗', 2, true, false),
  ('00000000-0000-4000-8000-000000000003', 'Official Club Website & Hub', '/', 'King''s College London Mountaineering Club', '⛰️', 3, true, false),
  ('00000000-0000-4000-8000-000000000004', 'Where We Climb & Gym Discounts', '/guides', 'London wall guide, partner discounts & crag topos', '📍', 4, true, false),
  ('00000000-0000-4000-8000-000000000005', 'Society Stash & Apparel Drops', '/drops/kclmc', 'Official society tees, hoodies & gear drops', '👕', 5, true, false)
on conflict (id) do update set
  title = excluded.title,
  url = excluded.url,
  subtitle = excluded.subtitle,
  icon = excluded.icon,
  sort_order = excluded.sort_order;
