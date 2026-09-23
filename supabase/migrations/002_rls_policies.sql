-- ============================================================
-- 002_rls_policies.sql
-- RLS for all public tables
-- ============================================================

-- Helper: get current user's role from profiles
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

-- ────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Committee can read all profiles"
  on public.profiles for select
  using (public.get_user_role() >= 1);

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())  -- cannot self-promote
  );

create policy "SuperAdmin can update any profile"
  on public.profiles for update
  using (public.get_user_role() = 2);

-- ────────────────────────────────────────
-- MEMBERSHIPS
-- ────────────────────────────────────────
alter table public.memberships enable row level security;

create policy "Users can read own memberships"
  on public.memberships for select
  using (user_id = auth.uid());

create policy "Committee can read all memberships"
  on public.memberships for select
  using (public.get_user_role() >= 1);

create policy "Committee can insert memberships"
  on public.memberships for insert
  with check (public.get_user_role() >= 1);

create policy "Committee can update memberships"
  on public.memberships for update
  using (public.get_user_role() >= 1);

-- ────────────────────────────────────────
-- TRIPS (public read, committee write)
-- ────────────────────────────────────────
alter table public.trips enable row level security;

create policy "Anyone can read published trips"
  on public.trips for select
  using (status != 'draft' or public.get_user_role() >= 1);

create policy "Committee can manage trips"
  on public.trips for all
  using (public.get_user_role() >= 1);

-- ────────────────────────────────────────
-- TRIP REGISTRATIONS
-- ────────────────────────────────────────
alter table public.trip_registrations enable row level security;

create policy "Users can read own registrations"
  on public.trip_registrations for select
  using (user_id = auth.uid());

create policy "Committee can read all registrations"
  on public.trip_registrations for select
  using (public.get_user_role() >= 1);

create policy "Authenticated users can register"
  on public.trip_registrations for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "Users can cancel own registration"
  on public.trip_registrations for update
  using (user_id = auth.uid());

-- ────────────────────────────────────────
-- GUIDES (public read, committee write)
-- ────────────────────────────────────────
alter table public.guides enable row level security;

create policy "Anyone can read published guides"
  on public.guides for select
  using (is_published = true or public.get_user_role() >= 1);

create policy "Committee can manage guides"
  on public.guides for all
  using (public.get_user_role() >= 1);

-- ────────────────────────────────────────
-- SHOP ITEMS (public read, committee write)
-- ────────────────────────────────────────
alter table public.shop_items enable row level security;

create policy "Anyone can read active shop items"
  on public.shop_items for select
  using (is_active = true or public.get_user_role() >= 1);

create policy "Committee can manage shop items"
  on public.shop_items for all
  using (public.get_user_role() >= 1);

-- ────────────────────────────────────────
-- MERCH ORDERS
-- ────────────────────────────────────────
alter table public.merch_orders enable row level security;

create policy "Users can read own orders"
  on public.merch_orders for select
  using (user_id = auth.uid() or customer_email = auth.email());

create policy "Anyone can create orders"
  on public.merch_orders for insert
  with check (true);  -- guest checkout allowed

create policy "Committee can read all orders"
  on public.merch_orders for select
  using (public.get_user_role() >= 1);

create policy "Committee can update order status"
  on public.merch_orders for update
  using (public.get_user_role() >= 1);

-- ────────────────────────────────────────
-- TELEMETRY EVENTS (insert-only for users, read for superadmin)
-- ────────────────────────────────────────
alter table public.telemetry_events enable row level security;

create policy "Anyone can insert telemetry"
  on public.telemetry_events for insert
  with check (true);

create policy "SuperAdmin can read telemetry"
  on public.telemetry_events for select
  using (public.get_user_role() = 2);
