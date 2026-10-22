-- ============================================================
-- Migration 010: Fix Portal Links RLS Policies & Deterministic Seed
-- Resolves "new row violates row-level security policy for table portal_links"
-- ============================================================

-- Ensure helper function exists
create or replace function public.get_user_role()
returns smallint
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    0
  );
$$;

-- Drop prior inline policies
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

-- Committee write access using security definer get_user_role()
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

-- Ensure deterministic default initial links exist with valid UUIDs
insert into public.portal_links (id, title, url, subtitle, icon, sort_order, is_active, is_highlighted)
values
  ('00000000-0000-4000-8000-000000000001', 'Buy 2026/27 Membership', 'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/', 'Official KCLSU Union Shop • Required for meets & pass', '🏛️', 1, true, true),
  ('00000000-0000-4000-8000-000000000002', 'Activate Digital Climbing Pass', '/membership', 'Safety gate, wall discount pass & verification QR', '🧗', 2, true, false),
  ('00000000-0000-4000-8000-000000000003', 'Official Club Website & Hub', '/', 'King''s College London Mountaineering Club', '⛰️', 3, true, false),
  ('00000000-0000-4000-8000-000000000004', 'Where We Climb & Gym Discounts', '/guides', 'London wall guide, partner discounts & crag topos', '📍', 4, true, false),
  ('00000000-0000-4000-8000-000000000005', 'Society Stash & Apparel Drops', '/drops/kclmc', 'Official society tees, hoodies & gear drops', '👕', 5, true, false)
on conflict (id) do nothing;
