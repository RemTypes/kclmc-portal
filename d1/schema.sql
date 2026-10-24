-- ============================================================
-- KCLMC Platform: Cloudflare D1 (SQLite) Unified Schema
-- ============================================================

-- 0. BETTER AUTH TABLES (Edge Native Auth, Sessions, 2FA, Magic Links)
CREATE TABLE IF NOT EXISTS "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" integer not null default 0,
  "image" text,
  "createdAt" date not null,
  "updatedAt" date not null,
  "twoFactorEnabled" integer default 0,
  "role" integer not null default 0
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text not null primary key,
  "expiresAt" date not null,
  "token" text not null unique,
  "createdAt" date not null,
  "updatedAt" date not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" date,
  "refreshTokenExpiresAt" date,
  "scope" text,
  "password" text,
  "createdAt" date not null,
  "updatedAt" date not null
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" date not null,
  "createdAt" date not null,
  "updatedAt" date not null
);

CREATE TABLE IF NOT EXISTS "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" integer default 1,
  "failedVerificationCount" integer default 0,
  "lockedUntil" date
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "user" ("email");
CREATE INDEX IF NOT EXISTS idx_session_token ON "session" ("token");
CREATE INDEX IF NOT EXISTS idx_session_user ON "session" ("userId");
CREATE INDEX IF NOT EXISTS idx_account_user ON "account" ("userId");
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON "verification" ("identifier");
CREATE INDEX IF NOT EXISTS idx_twoFactor_user ON "twoFactor" ("userId");

-- 1. USERS & CREDENTIALS (Edge Native Auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role INTEGER NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
  mfa_secret TEXT,
  mfa_backup_codes TEXT, -- JSON array of hashed strings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. SESSIONS (Stateless Edge Validation)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 3. PASSWORD RESETS
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- 4. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  student_id TEXT,
  university TEXT NOT NULL DEFAULT "King's College London",
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  dietary_requirements TEXT,
  medical_notes TEXT,
  role INTEGER NOT NULL DEFAULT 0 CHECK (role IN (0, 1, 2)),
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON profiles(student_id);

-- 5. MEMBERSHIPS (Digital Passes)
CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  membership_number TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'recreational' CHECK (tier IN ('recreational', 'social', 'active', 'committee', 'alumni', 'honorary')),
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  payment_reference TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_number ON memberships(membership_number);

-- 6. KCLSU ROSTER (Purchasers & Passes)
CREATE TABLE IF NOT EXISTS kclsu_roster (
  id TEXT PRIMARY KEY,
  card_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  raw_purchaser TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('social', 'recreational')),
  product_name TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  purchase_date TEXT,
  academic_year TEXT NOT NULL DEFAULT '2026/27',
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_associate INTEGER NOT NULL DEFAULT 0,
  member_email TEXT,
  university TEXT,
  su_status TEXT NOT NULL DEFAULT 'verified' CHECK (su_status IN ('verified', 'awaiting_su', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kclsu_roster_card ON kclsu_roster(card_number);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_user ON kclsu_roster(user_id);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_tier ON kclsu_roster(tier);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_full_name ON kclsu_roster(full_name);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_is_assoc ON kclsu_roster(is_associate);
CREATE INDEX IF NOT EXISTS idx_kclsu_roster_su_status ON kclsu_roster(su_status);

-- 7. BMC DISPATCHES (Insurance Record Tracking)
CREATE TABLE IF NOT EXISTS bmc_dispatches (
  id TEXT PRIMARY KEY,
  card_number TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  academic_year TEXT NOT NULL DEFAULT '2026/27',
  UNIQUE (card_number, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_bmc_dispatches_card ON bmc_dispatches(card_number);
CREATE INDEX IF NOT EXISTS idx_bmc_dispatches_email ON bmc_dispatches(email);

-- 8. PORTAL BIO LINKS (/links Directory)
CREATE TABLE IF NOT EXISTS portal_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  subtitle TEXT,
  icon TEXT NOT NULL DEFAULT '🔗',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_highlighted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_portal_links_active ON portal_links(is_active);
CREATE INDEX IF NOT EXISTS idx_portal_links_order ON portal_links(sort_order);

-- 9. TRIPS & MEETS
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trip_type TEXT NOT NULL DEFAULT 'social' CHECK (trip_type IN ('trad', 'sport', 'bouldering', 'winter', 'social', 'expedition')),
  location TEXT NOT NULL DEFAULT '',
  date_start TEXT NOT NULL,
  date_end TEXT,
  difficulty_grade TEXT,
  trip_leader_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  max_capacity INTEGER,
  gear_requirements TEXT, -- JSON array of strings
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'waitlist', 'full', 'completed', 'cancelled')),
  price_pence INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date_start);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- 10. TRIP REGISTRATIONS
CREATE TABLE IF NOT EXISTS trip_registrations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  gear_notes TEXT,
  dietary_notes TEXT,
  emergency_contact_override TEXT,
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (trip_id, user_id)
);

-- 11. GUIDES (Climbing Walls & Crags)
CREATE TABLE IF NOT EXISTS guides (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('indoor', 'crag')),
  location TEXT,
  grade_range TEXT,
  discount_info TEXT,
  website_url TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. SHOP ITEMS (Merch Drops)
CREATE TABLE IF NOT EXISTS shop_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('KCL', 'LUBE')),
  price_pence INTEGER NOT NULL,
  garment_types TEXT NOT NULL DEFAULT '',
  current_moq INTEGER NOT NULL DEFAULT 0,
  target_moq INTEGER NOT NULL DEFAULT 50,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 13. MERCH ORDERS
CREATE TABLE IF NOT EXISTS merch_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  order_code TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]', -- JSON array string
  total_pence INTEGER NOT NULL DEFAULT 0,
  brand TEXT NOT NULL CHECK (brand IN ('KCL', 'LUBE')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'collected', 'refunded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_code ON merch_orders(order_code);
CREATE INDEX IF NOT EXISTS idx_merch_orders_user ON merch_orders(user_id);

-- 14. TELEMETRY EVENTS
CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}', -- JSON string
  session_id TEXT,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created ON telemetry_events(created_at);

-- ============================================================
-- SEED DATA: Default Portal Links
-- ============================================================
INSERT OR IGNORE INTO portal_links (id, title, url, subtitle, icon, sort_order, is_active, is_highlighted)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Buy 2026/27 Membership', 'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/', 'Official KCLSU Union Shop • Required for meets & pass', '🏛️', 1, 1, 1),
  ('00000000-0000-4000-8000-000000000002', 'Activate Digital Climbing Pass', '/membership', 'Safety gate, wall discount pass & verification QR', '🧗', 2, 1, 0),
  ('00000000-0000-4000-8000-000000000003', 'Official Club Website & Hub', '/', 'King''s College London Mountaineering Club', '⛰️', 3, 1, 0),
  ('00000000-0000-4000-8000-000000000004', 'Where We Climb & Gym Discounts', '/guides', 'London wall guide, partner discounts & crag topos', '📍', 4, 1, 0),
  ('00000000-0000-4000-8000-000000000005', 'Merch Drops & Club Stash', '/drops/kclmc', 'Exclusive apparel, hoodies, tees & beanies', '👕', 5, 1, 0);
