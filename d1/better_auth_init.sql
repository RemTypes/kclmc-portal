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

-- Populate Better Auth "user" from existing users and profiles
INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, twoFactorEnabled, role)
SELECT 
  u.id,
  COALESCE(NULLIF(p.full_name, ''), SUBSTR(u.email, 1, INSTR(u.email, '@') - 1)),
  LOWER(u.email),
  1,
  u.created_at,
  u.updated_at,
  CASE WHEN u.mfa_secret IS NOT NULL THEN 1 ELSE 0 END,
  COALESCE(u.role, 0)
FROM users u
LEFT JOIN profiles p ON u.id = p.id
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  updatedAt = excluded.updatedAt;

-- Populate Better Auth "account" from existing users (preserving MIGRATED_ACCOUNT for JIT bump)
INSERT INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt)
SELECT
  'acc_' || u.id,
  u.id,
  'credential',
  u.id,
  COALESCE(u.password_hash, 'MIGRATED_ACCOUNT'),
  u.created_at,
  u.updated_at
FROM users u
ON CONFLICT(id) DO UPDATE SET
  password = excluded.password,
  updatedAt = excluded.updatedAt;

