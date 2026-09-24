-- ============================================================
-- KCLMC Platform — Consolidated Supabase Setup Migration
-- Fully Idempotent with Explicit Row Level Security (RLS)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Helper: get current user's role from profiles (0=public, 1=committee, 2=superadmin)
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

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  student_id    text,
  university    text not null default 'King''s College London',
  phone         text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  dietary_requirements    text,
  medical_notes           text,
  role          smallint not null default 0 check (role in (0, 1, 2)),
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column public.profiles.role is '0=Public/Climber, 1=Committee Member, 2=SuperAdmin';

-- Auto-create profile row on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS & Policies on profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "Committee can read all profiles" on public.profiles;
create policy "Committee can read all profiles"
  on public.profiles for select
  using (public.get_user_role() >= 1);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

drop policy if exists "SuperAdmin can update any profile" on public.profiles;
create policy "SuperAdmin can update any profile"
  on public.profiles for update
  using (public.get_user_role() = 2);

-- ============================================================
-- 2. MEMBERSHIPS
-- ============================================================
create table if not exists public.memberships (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  membership_number text not null unique,
  tier              text not null default 'recreational' check (tier in ('recreational', 'social', 'active', 'committee', 'alumni', 'honorary')),
  valid_from        date not null default current_date,
  valid_until       date not null,
  payment_reference text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- Enable RLS & Indexes on memberships
alter table public.memberships enable row level security;

create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_number on public.memberships(membership_number);

drop policy if exists "Users can read own memberships" on public.memberships;
create policy "Users can read own memberships"
  on public.memberships for select
  using (user_id = auth.uid());

drop policy if exists "Committee can read all memberships" on public.memberships;
create policy "Committee can read all memberships"
  on public.memberships for select
  using (public.get_user_role() >= 1);

drop policy if exists "Committee can insert memberships" on public.memberships;
create policy "Committee can insert memberships"
  on public.memberships for insert
  with check (public.get_user_role() >= 1);

drop policy if exists "Committee can update memberships" on public.memberships;
create policy "Committee can update memberships"
  on public.memberships for update
  using (public.get_user_role() >= 1);

-- ============================================================
-- 3. TRIPS
-- ============================================================
create table if not exists public.trips (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  description      text not null default '',
  trip_type        text not null default 'social' check (trip_type in ('trad', 'sport', 'bouldering', 'winter', 'social', 'expedition')),
  location         text not null default '',
  date_start       date not null,
  date_end         date,
  difficulty_grade text,
  trip_leader_id   uuid references public.profiles(id) on delete set null,
  max_capacity     integer,
  gear_requirements text[],
  status           text not null default 'draft' check (status in ('draft', 'open', 'waitlist', 'full', 'completed', 'cancelled')),
  price_pence      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Enable RLS & Indexes on trips
alter table public.trips enable row level security;

create index if not exists idx_trips_date on public.trips(date_start);
create index if not exists idx_trips_status on public.trips(status);

drop policy if exists "Anyone can read published trips" on public.trips;
create policy "Anyone can read published trips"
  on public.trips for select
  using (status != 'draft' or public.get_user_role() >= 1);

drop policy if exists "Committee can manage trips" on public.trips;
create policy "Committee can manage trips"
  on public.trips for all
  using (public.get_user_role() >= 1);

-- ============================================================
-- 4. TRIP REGISTRATIONS
-- ============================================================
create table if not exists public.trip_registrations (
  id               uuid primary key default uuid_generate_v4(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'confirmed' check (status in ('confirmed', 'waitlist', 'cancelled')),
  gear_notes       text,
  dietary_notes    text,
  emergency_contact_override text,
  registered_at    timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- Enable RLS on trip_registrations
alter table public.trip_registrations enable row level security;

drop policy if exists "Users can read own registrations" on public.trip_registrations;
create policy "Users can read own registrations"
  on public.trip_registrations for select
  using (user_id = auth.uid());

drop policy if exists "Committee can read all registrations" on public.trip_registrations;
create policy "Committee can read all registrations"
  on public.trip_registrations for select
  using (public.get_user_role() >= 1);

drop policy if exists "Authenticated users can register" on public.trip_registrations;
create policy "Authenticated users can register"
  on public.trip_registrations for insert
  with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Users can cancel own registration" on public.trip_registrations;
create policy "Users can cancel own registration"
  on public.trip_registrations for update
  using (user_id = auth.uid());

-- ============================================================
-- 5. GUIDES (Crags & Gym Discounts)
-- ============================================================
create table if not exists public.guides (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text not null default '',
  category      text not null check (category in ('indoor', 'crag')),
  location      text,
  grade_range   text,
  discount_info text,
  website_url   text,
  image_url     text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Enable RLS on guides
alter table public.guides enable row level security;

drop policy if exists "Anyone can read published guides" on public.guides;
create policy "Anyone can read published guides"
  on public.guides for select
  using (is_published = true or public.get_user_role() >= 1);

drop policy if exists "Committee can manage guides" on public.guides;
create policy "Committee can manage guides"
  on public.guides for all
  using (public.get_user_role() >= 1);

-- ============================================================
-- 6. SHOP ITEMS (Active Merch Drops)
-- ============================================================
create table if not exists public.shop_items (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  brand         text not null check (brand in ('KCL', 'LUBE')),
  price_pence   integer not null,
  garment_types text not null default '',
  current_moq   integer not null default 0,
  target_moq    integer not null default 50,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Enable RLS on shop_items
alter table public.shop_items enable row level security;

drop policy if exists "Anyone can read active shop items" on public.shop_items;
create policy "Anyone can read active shop items"
  on public.shop_items for select
  using (is_active = true or public.get_user_role() >= 1);

drop policy if exists "Committee can manage shop items" on public.shop_items;
create policy "Committee can manage shop items"
  on public.shop_items for all
  using (public.get_user_role() >= 1);

-- ============================================================
-- 7. MERCH ORDERS
-- ============================================================
create table if not exists public.merch_orders (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete set null,
  order_code      text not null unique,
  customer_name   text not null,
  customer_email  text not null,
  items           jsonb not null default '[]',
  total_pence     integer not null default 0,
  brand           text not null check (brand in ('KCL', 'LUBE')),
  status          text not null default 'pending' check (status in ('pending', 'paid', 'collected', 'refunded')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Enable RLS & Indexes on merch_orders
alter table public.merch_orders enable row level security;

create index if not exists idx_merch_orders_code on public.merch_orders(order_code);
create index if not exists idx_merch_orders_user on public.merch_orders(user_id);

drop policy if exists "Users can read own orders" on public.merch_orders;
create policy "Users can read own orders"
  on public.merch_orders for select
  using (user_id = auth.uid() or customer_email = auth.email());

drop policy if exists "Anyone can create orders" on public.merch_orders;
create policy "Anyone can create orders"
  on public.merch_orders for insert
  with check (true);

drop policy if exists "Committee can read all orders" on public.merch_orders;
create policy "Committee can read all orders"
  on public.merch_orders for select
  using (public.get_user_role() >= 1);

drop policy if exists "Committee can update order status" on public.merch_orders;
create policy "Committee can update order status"
  on public.merch_orders for update
  using (public.get_user_role() >= 1);

-- ============================================================
-- 8. TELEMETRY EVENTS
-- ============================================================
create table if not exists public.telemetry_events (
  id          uuid primary key default uuid_generate_v4(),
  event_type  text not null,
  payload     jsonb not null default '{}',
  session_id  text,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Enable RLS & Indexes on telemetry_events
alter table public.telemetry_events enable row level security;

create index if not exists idx_telemetry_type on public.telemetry_events(event_type);
create index if not exists idx_telemetry_created on public.telemetry_events(created_at);

drop policy if exists "Anyone can insert telemetry" on public.telemetry_events;
create policy "Anyone can insert telemetry"
  on public.telemetry_events for insert
  with check (true);

drop policy if exists "SuperAdmin can read telemetry" on public.telemetry_events;
create policy "SuperAdmin can read telemetry"
  on public.telemetry_events for select
  using (public.get_user_role() = 2);

-- ============================================================
-- 9. STARTER SEED DATA
-- ============================================================

-- Guides: Indoor Walls
insert into public.guides (title, description, category, location, discount_info, sort_order)
select 'Mile End Climbing Wall', 'Community wall in Tower Hamlets. Great for after-lecture sessions. Bouldering and top-rope.', 'indoor', 'Mile End, E3', '20% off with KCL student ID', 1
where not exists (select 1 from public.guides where title = 'Mile End Climbing Wall');

insert into public.guides (title, description, category, location, discount_info, sort_order)
select 'VauxWall East', 'Premier bouldering in Vauxhall railway arches. Comp-grade setting and excellent training boards.', 'indoor', 'Vauxhall, SE11', '£2 off day pass with KCLMC membership card', 2
where not exists (select 1 from public.guides where title = 'VauxWall East');

insert into public.guides (title, description, category, location, discount_info, sort_order)
select 'The Castle Climbing Centre', 'Iconic converted Victorian water tower. Lead, top-rope, and bouldering across all grades.', 'indoor', 'Manor House, N4', 'Free intro session for new KCL members', 3
where not exists (select 1 from public.guides where title = 'The Castle Climbing Centre');

insert into public.guides (title, description, category, location, discount_info, sort_order)
select 'Arch Climbing Wall', 'Three London locations. Modern commercial walls with auto-belays and competition bouldering.', 'indoor', 'Bermondsey / Brentford / North Greenwich', null, 4
where not exists (select 1 from public.guides where title = 'Arch Climbing Wall');

-- Guides: Outdoor Crags
insert into public.guides (title, description, category, location, grade_range, sort_order)
select 'Harrison''s Rocks', 'Southern Sandstone classic. Top-rope only. Perfect weekend trip from London Bridge (50 min train).', 'crag', 'Groombridge, Kent', 'VDiff to E3', 1
where not exists (select 1 from public.guides where title = 'Harrison''s Rocks');

insert into public.guides (title, description, category, location, grade_range, sort_order)
select 'Bowles Rocks', 'Nearby alternative to Harrison''s with a wider range of easier routes and good group logistics.', 'crag', 'Eridge, East Sussex', 'Mod to HVS', 2
where not exists (select 1 from public.guides where title = 'Bowles Rocks');

insert into public.guides (title, description, category, location, grade_range, sort_order)
select 'Portland', 'Sea-cliff limestone sport climbing on the Jurassic Coast. Weekend trip destination.', 'crag', 'Dorset', 'F4 to F7c', 3
where not exists (select 1 from public.guides where title = 'Portland');

insert into public.guides (title, description, category, location, grade_range, sort_order)
select 'Stanage Edge', 'Peak District gritstone. The UK''s most famous crag. Trad climbing at its finest.', 'crag', 'Sheffield, Peak District', 'VDiff to E7', 4
where not exists (select 1 from public.guides where title = 'Stanage Edge');

-- Trips: Upcoming season
insert into public.trips (title, description, trip_type, location, date_start, date_end, difficulty_grade, max_capacity, gear_requirements, status, price_pence)
select 'Weekly Social Wall — Mile End', 'Drop-in Tuesday evening session. No booking required. Meet at reception 6:30pm.', 'social', 'Mile End Climbing Wall, E3', '2026-10-01', null, 'All levels', 30, '{}', 'open', 0
where not exists (select 1 from public.trips where title = 'Weekly Social Wall — Mile End');

insert into public.trips (title, description, trip_type, location, date_start, date_end, difficulty_grade, max_capacity, gear_requirements, status, price_pence)
select 'Harrison''s Rocks Day Trip', 'Southern Sandstone top-roping. Transport arranged from Waterloo. All gear provided.', 'trad', 'Groombridge, Kent', '2026-10-12', '2026-10-12', 'VDiff to HVS', 16, '{"helmet","harness"}', 'open', 1500
where not exists (select 1 from public.trips where title = 'Harrison''s Rocks Day Trip');

insert into public.trips (title, description, trip_type, location, date_start, date_end, difficulty_grade, max_capacity, gear_requirements, status, price_pence)
select 'Peak District Weekend', 'Two days on Stanage Edge and Burbage. Wild camping option. Trad lead and second pairs.', 'trad', 'Hathersage, Peak District', '2026-10-25', '2026-10-26', 'Severe to E1', 12, '{"helmet","harness","trad rack","sleeping bag"}', 'open', 4500
where not exists (select 1 from public.trips where title = 'Peak District Weekend');

insert into public.trips (title, description, trip_type, location, date_start, date_end, difficulty_grade, max_capacity, gear_requirements, status, price_pence)
select 'Scottish Winter Mountaineering', 'Grade I-III winter routes in Glencoe. Crampon and ice axe skills required. Pre-trip training mandatory.', 'winter', 'Glencoe, Scotland', '2026-12-14', '2026-12-17', 'Grade I to III', 8, '{"crampons","ice axe","helmet","harness","winter boots"}', 'draft', 15000
where not exists (select 1 from public.trips where title = 'Scottish Winter Mountaineering');

-- Shop Items: Active KCL drop
insert into public.shop_items (name, brand, price_pence, garment_types, current_moq, target_moq)
select 'KCLMC Alpine Tee 2026', 'KCL', 1800, 'T-Shirt', 12, 30
where not exists (select 1 from public.shop_items where name = 'KCLMC Alpine Tee 2026');

insert into public.shop_items (name, brand, price_pence, garment_types, current_moq, target_moq)
select 'KCLMC Summit Hoodie', 'KCL', 3500, 'Hoodie', 8, 25
where not exists (select 1 from public.shop_items where name = 'KCLMC Summit Hoodie');

insert into public.shop_items (name, brand, price_pence, garment_types, current_moq, target_moq)
select 'KCLMC Expedition Sweater', 'KCL', 2800, 'Sweater', 5, 20
where not exists (select 1 from public.shop_items where name = 'KCLMC Expedition Sweater');

-- ============================================================
-- 10. OFFICIAL KCLSU ROSTER & MEMBERSHIP SYNCHRONIZATION
-- ============================================================

-- Table for official Student Union membership purchases
create table if not exists public.kclsu_roster (
  id              uuid primary key default uuid_generate_v4(),
  card_number     text not null unique,
  full_name       text not null,
  raw_purchaser   text not null,
  tier            text not null check (tier in ('social', 'recreational')),
  product_name    text not null,
  transaction_id  text not null,
  purchase_date   text,
  academic_year   text not null default '2026/27',
  user_id         uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Enable RLS & Indexes on kclsu_roster
alter table public.kclsu_roster enable row level security;

create index if not exists idx_kclsu_roster_card on public.kclsu_roster(card_number);
create index if not exists idx_kclsu_roster_user on public.kclsu_roster(user_id);
create index if not exists idx_kclsu_roster_tier on public.kclsu_roster(tier);
create index if not exists idx_kclsu_roster_year on public.kclsu_roster(academic_year);

-- Public can verify membership cards (e.g. wall scanners, QR codes)
drop policy if exists "Anyone can verify membership roster" on public.kclsu_roster;
create policy "Anyone can verify membership roster"
  on public.kclsu_roster for select
  using (true);

-- Authenticated users can claim/link their verified student ID to their profile
drop policy if exists "Users can link own card_number" on public.kclsu_roster;
create policy "Users can link own card_number"
  on public.kclsu_roster for update
  using (user_id is null or user_id = auth.uid())
  with check (user_id = auth.uid());

-- Committee (role >= 1) can insert, update, or delete roster entries
drop policy if exists "Committee can manage roster" on public.kclsu_roster;
create policy "Committee can manage roster"
  on public.kclsu_roster for all
  using (public.get_user_role() >= 1);

-- ============================================================
-- Seed 2026/27 Official KCLSU Members (26 Active Records)
-- ============================================================
insert into public.kclsu_roster (card_number, full_name, raw_purchaser, tier, product_name, transaction_id, purchase_date, academic_year)
values
  ('K26122068', 'David Baltensperger', 'BALTENSPERGER, David', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31631002', 'Wed 23 Sep 2026 17:55', '2026/27'),
  ('K26019642', 'Olivia Rochester-Hines', 'Rochester-Hines, Olivia', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31630684', 'Wed 23 Sep 2026 16:40', '2026/27'),
  ('K26010174', 'Alexander Lippi', 'LIPPI, Alexander', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31628197', 'Tue 22 Sep 2026 22:36', '2026/27'),
  ('K26140856', 'Sujay Suresh', 'Suresh, Sujay', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31624613', 'Mon 21 Sep 2026 23:37', '2026/27'),
  ('K25058734', 'John Lavadia', 'LAVADIA, John', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31620366', 'Mon 21 Sep 2026 14:58', '2026/27'),
  ('K26140111', 'Ian Salihu', 'Salihu, Ian', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31620176', 'Mon 21 Sep 2026 14:43', '2026/27'),
  ('K26083988', 'Beth Vivian', 'Vivian, Beth', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31609375', 'Sun 20 Sep 2026 16:07', '2026/27'),
  ('K22047409', 'Isaac Toh Si Boon', 'Toh Si Boon, Isaac', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31608073', 'Sun 20 Sep 2026 12:25', '2026/27'),
  ('K25101428', 'Souw Neo', 'NEO, Souw', 'social', '[10166870] Climbing/Mountaineering Social Membership', '31597733', 'Thu 17 Sep 2026 23:29', '2026/27'),
  ('K25005392', 'Zekai Lin', 'LIN, Zekai', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31631791', 'Wed 23 Sep 2026 21:14', '2026/27'),
  ('K23021924', 'Nuha Mohamed', 'Mohamed, Nuha', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31631767', 'Wed 23 Sep 2026 20:59', '2026/27'),
  ('K26005807', 'Lorenzo Mulhare', 'MULHARE, Lorenzo', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31629878', 'Wed 23 Sep 2026 14:24', '2026/27'),
  ('K25054815', 'Harry Allen', 'ALLEN, Harry', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31628828', 'Wed 23 Sep 2026 08:54', '2026/27'),
  ('K26016434', 'Joon Choi', 'Choi, Joon', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31625065', 'Tue 22 Sep 2026 07:26', '2026/27'),
  ('K26066449', 'Haofang Xu', 'XU, HAOFANG', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31624196', 'Mon 21 Sep 2026 22:20', '2026/27'),
  ('K25008223', 'Remy Preston', 'PRESTON, Remy', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31610582', 'Sun 20 Sep 2026 18:53', '2026/27'),
  ('K23158797', 'Alice Richardson', 'RICHARDSON, Alice', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31599217', 'Fri 18 Sep 2026 13:30', '2026/27'),
  ('K23004731', 'Megan Ho', 'HO, Megan', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31592767', 'Wed 16 Sep 2026 07:31', '2026/27'),
  ('K25074252', 'Eden Steen', 'STEEN, Eden', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31591811', 'Tue 15 Sep 2026 18:52', '2026/27'),
  ('K25004642', 'Arthur Dean', 'Dean, Arthur', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31591709', 'Tue 15 Sep 2026 18:06', '2026/27'),
  ('K26107823', 'Xue', 'XUE, -', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31591212', 'Tue 15 Sep 2026 15:50', '2026/27'),
  ('K26033971', 'Ethan Kellett', 'KELLETT, Ethan', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31591117', 'Tue 15 Sep 2026 15:11', '2026/27'),
  ('K23166535', 'Jennifer Johnston', 'JOHNSTON, Jennifer', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31590394', 'Tue 15 Sep 2026 12:43', '2026/27'),
  ('K25005467', 'Andrew Berresford', 'BERRESFORD, Andrew', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31578818', 'Fri 04 Sep 2026 19:21', '2026/27'),
  ('K25082359', 'Funmi Osoteku', 'OSOTEKU, Funmi', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31574792', 'Tue 01 Sep 2026 17:41', '2026/27'),
  ('K26142908', 'Hasvinjit D/O Gulwant Singh', 'D/O GULWANT SINGH, Hasvinjit', 'recreational', '[10002480] Climbing/Mountaineering Recreational Membership', '31561092', 'Wed 05 Aug 2026 06:01', '2026/27')
on conflict (card_number) do update set
  full_name = excluded.full_name,
  raw_purchaser = excluded.raw_purchaser,
  tier = excluded.tier,
  product_name = excluded.product_name,
  transaction_id = excluded.transaction_id,
  purchase_date = excluded.purchase_date,
  updated_at = now();
