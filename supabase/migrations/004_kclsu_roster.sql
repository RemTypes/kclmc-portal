-- ============================================================
-- 004_kclsu_roster.sql
-- KCLMC Club Beta — Official KCLSU Member Roster & Synchronization
-- ============================================================

-- Table for official Student Union membership purchases
create table if not exists public.kclsu_roster (
  id              uuid primary key default uuid_generate_v4(),
  card_number     text not null unique,               -- KCL Student ID e.g. 'K25008223'
  full_name       text not null,                      -- Formatted name e.g. 'Remy Preston'
  raw_purchaser   text not null,                      -- Raw SU name e.g. 'PRESTON, Remy'
  tier            text not null check (tier in ('social', 'recreational')),
  product_name    text not null,                      -- Official SU product title
  transaction_id  text not null,                      -- KCLSU transaction ID
  purchase_date   text,                               -- Purchase date string e.g. 'Sun 20 Sep 2026 18:53'
  academic_year   text not null default '2026/27',
  user_id         uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Fast lookup indexes
create index if not exists idx_kclsu_roster_card on public.kclsu_roster(card_number);
create index if not exists idx_kclsu_roster_user on public.kclsu_roster(user_id);
create index if not exists idx_kclsu_roster_tier on public.kclsu_roster(tier);
create index if not exists idx_kclsu_roster_year on public.kclsu_roster(academic_year);

-- Enable Row Level Security
alter table public.kclsu_roster enable row level security;

-- Public can verify membership cards (e.g. wall scanners, QR codes)
create policy "Anyone can verify membership roster"
  on public.kclsu_roster for select
  using (true);

-- Authenticated users can claim/link their verified student ID to their profile
create policy "Users can link own card_number"
  on public.kclsu_roster for update
  using (user_id is null or user_id = auth.uid())
  with check (user_id = auth.uid());

-- Committee (role >= 1) can insert, update, or delete roster entries
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
