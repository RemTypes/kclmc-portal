-- ============================================================
-- KCLMC Platform — Cloudflare D1 (SQLite) Initial Schema
-- Migration: 0001_d1_initial_schema.sql
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id                      TEXT PRIMARY KEY,
  full_name               TEXT NOT NULL DEFAULT '',
  student_id              TEXT,
  university              TEXT NOT NULL DEFAULT "King's College London",
  phone                   TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  dietary_requirements    TEXT,
  medical_notes           TEXT,
  role                    INTEGER NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
  avatar_url              TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. KCLSU ROSTER (Membership Purchases)
CREATE TABLE IF NOT EXISTS kclsu_roster (
  id              TEXT PRIMARY KEY,
  card_number     TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  raw_purchaser   TEXT NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('social', 'recreational')),
  product_name    TEXT NOT NULL,
  transaction_id  TEXT NOT NULL,
  purchase_date   TEXT,
  academic_year   TEXT NOT NULL DEFAULT '2026/27',
  user_id         TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kclsu_roster_card ON kclsu_roster(card_number);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_user ON kclsu_roster(user_id);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_tier ON kclsu_roster(tier);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_year ON kclsu_roster(academic_year);

-- 3. TRIPS
CREATE TABLE IF NOT EXISTS trips (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  trip_type         TEXT NOT NULL DEFAULT 'social' CHECK (trip_type IN ('trad', 'sport', 'bouldering', 'winter', 'social', 'expedition')),
  location          TEXT NOT NULL DEFAULT '',
  date_start        TEXT NOT NULL,
  date_end          TEXT,
  difficulty_grade  TEXT,
  trip_leader_id    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  max_capacity      INTEGER,
  gear_requirements TEXT NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'waitlist', 'full', 'completed', 'cancelled')),
  price_pence       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date_start);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- 4. TRIP REGISTRATIONS
CREATE TABLE IF NOT EXISTS trip_registrations (
  id                          TEXT PRIMARY KEY,
  trip_id                     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id                     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                      TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  gear_notes                  TEXT,
  dietary_notes               TEXT,
  emergency_contact_override  TEXT,
  registered_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (trip_id, user_id)
);

-- 5. GUIDES (Crags & Gym Discounts)
CREATE TABLE IF NOT EXISTS guides (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL CHECK (category IN ('indoor', 'crag')),
  location      TEXT,
  grade_range   TEXT,
  discount_info TEXT,
  website_url   TEXT,
  image_url     TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. SHOP ITEMS
CREATE TABLE IF NOT EXISTS shop_items (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  brand         TEXT NOT NULL CHECK (brand IN ('KCL', 'LUBE')),
  price_pence   INTEGER NOT NULL,
  garment_types TEXT NOT NULL DEFAULT '',
  current_moq   INTEGER NOT NULL DEFAULT 0,
  target_moq    INTEGER NOT NULL DEFAULT 50,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. MERCH ORDERS
CREATE TABLE IF NOT EXISTS merch_orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  order_code      TEXT NOT NULL UNIQUE,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  items           TEXT NOT NULL DEFAULT '[]',
  total_pence     INTEGER NOT NULL DEFAULT 0,
  brand           TEXT NOT NULL CHECK (brand IN ('KCL', 'LUBE')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'collected', 'refunded')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_code ON merch_orders(order_code);
CREATE INDEX IF NOT EXISTS idx_merch_orders_user ON merch_orders(user_id);

-- 8. TELEMETRY EVENTS
CREATE TABLE IF NOT EXISTS telemetry_events (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',
  session_id  TEXT,
  user_id     TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_events(created_at);

-- ============================================================
-- STARTER SEED DATA
-- ============================================================

-- Guides
INSERT OR IGNORE INTO guides (id, title, description, category, location, discount_info, sort_order, is_published)
VALUES
  ('guide-1', 'Mile End Climbing Wall', 'Community wall in Tower Hamlets. Great for after-lecture sessions. Bouldering and top-rope.', 'indoor', 'Mile End, E3', '20% off with KCL student ID', 1, 1),
  ('guide-2', 'VauxWall East', 'Premier bouldering in Vauxhall railway arches. Comp-grade setting and excellent training boards. Home to our weekly monday social!', 'indoor', 'Vauxhall, SE11', '£9.50 entry for KCLMC members including free shoe and chalk rental.', 2, 1),
  ('guide-3', 'The Castle Climbing Centre', 'Iconic converted Victorian water tower. Lead, top-rope, and bouldering across all grades.', 'indoor', 'Manor House, N4', 'Student concession rates with KCL student ID', 3, 1),
  ('guide-4', 'Arch Climbing Wall', 'Three London locations (Building One, Acton, Surrey Quays). Modern bouldering centres.', 'indoor', 'Bermondsey / Acton', 'Concession rates available', 4, 1),
  ('guide-5', 'Harrison''s Rocks', 'Southern Sandstone classic. Top-rope only. Perfect day trip from London Bridge (50 min train).', 'crag', 'Groombridge, Kent', 'Free crag access (BMC owned)', 5, 1),
  ('guide-6', 'Portland (The Cuttings)', 'Premier sea-cliff limestone sport climbing on the Jurassic Coast.', 'crag', 'Dorset', 'Tidal awareness required', 6, 1);

-- Shop Items
INSERT OR IGNORE INTO shop_items (id, name, brand, price_pence, garment_types, current_moq, target_moq, is_active)
VALUES
  ('shop-1', 'KCLMC Alpine Tee 2026', 'KCL', 1800, 'T-Shirt', 12, 30, 1),
  ('shop-2', 'KCLMC Summit Hoodie', 'KCL', 3500, 'Hoodie', 8, 25, 1),
  ('shop-3', 'KCLMC Expedition Sweater', 'KCL', 2800, 'Sweater', 5, 20, 1);
