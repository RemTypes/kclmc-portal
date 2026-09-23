-- ============================================================
-- 001_initial_schema.sql
-- KCLMC Club Beta — Core Tables
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  student_id    text,                          -- KCL student number for verification
  university    text not null default 'King''s College London',
  phone         text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  dietary_requirements    text,
  medical_notes           text,
  role          smallint not null default 0     -- 0=public, 1=committee, 2=superadmin
    check (role in (0, 1, 2)),
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
create table public.memberships (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  membership_number text not null unique,       -- e.g. KCLMC-25-0042
  tier              text not null default 'recreational'
    check (tier in ('recreational', 'social', 'active', 'committee', 'alumni', 'honorary')),
  valid_from        date not null default current_date,
  valid_until       date not null,
  payment_reference text,                       -- KCLSU receipt number
  is_active         boolean generated always as (current_date between valid_from and valid_until) stored,
  created_at        timestamptz not null default now()
);

create index idx_memberships_user on public.memberships(user_id);
create index idx_memberships_number on public.memberships(membership_number);

-- ============================================================
-- TRIPS
-- ============================================================
create table public.trips (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  description      text not null default '',
  trip_type        text not null default 'social'
    check (trip_type in ('trad', 'sport', 'bouldering', 'winter', 'social', 'expedition')),
  location         text not null default '',
  date_start       date not null,
  date_end         date,
  difficulty_grade text,                        -- e.g. 'VS 4c', 'V3-V5', 'Grade II'
  trip_leader_id   uuid references public.profiles(id) on delete set null,
  max_capacity     integer,
  gear_requirements text[],                     -- e.g. {'helmet','harness','trad rack'}
  status           text not null default 'draft'
    check (status in ('draft', 'open', 'waitlist', 'full', 'completed', 'cancelled')),
  price_pence      integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_trips_date on public.trips(date_start);
create index idx_trips_status on public.trips(status);

-- ============================================================
-- TRIP REGISTRATIONS
-- ============================================================
create table public.trip_registrations (
  id               uuid primary key default uuid_generate_v4(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'confirmed'
    check (status in ('confirmed', 'waitlist', 'cancelled')),
  gear_notes       text,
  dietary_notes    text,
  emergency_contact_override text,
  registered_at    timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- ============================================================
-- GUIDES (Crags & Gym Discounts)
-- ============================================================
create table public.guides (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text not null default '',
  category      text not null
    check (category in ('indoor', 'crag')),
  location      text,
  grade_range   text,
  discount_info text,                           -- e.g. '20% off with KCL student ID'
  website_url   text,
  image_url     text,
  sort_order    integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- SHOP ITEMS (Active Merch Drops)
-- ============================================================
create table public.shop_items (
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

-- ============================================================
-- MERCH ORDERS
-- ============================================================
create table public.merch_orders (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete set null,
  order_code      text not null unique,         -- e.g. KCL-1234
  customer_name   text not null,
  customer_email  text not null,
  items           jsonb not null default '[]',
  total_pence     integer not null default 0,
  brand           text not null check (brand in ('KCL', 'LUBE')),
  status          text not null default 'pending'
    check (status in ('pending', 'paid', 'collected', 'refunded')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_merch_orders_code on public.merch_orders(order_code);
create index idx_merch_orders_user on public.merch_orders(user_id);

-- ============================================================
-- TELEMETRY EVENTS (Passive ML Data Collection)
-- ============================================================
create table public.telemetry_events (
  id          uuid primary key default uuid_generate_v4(),
  event_type  text not null,
  payload     jsonb not null default '{}',
  session_id  text,
  user_id     uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_telemetry_type on public.telemetry_events(event_type);
create index idx_telemetry_created on public.telemetry_events(created_at);
