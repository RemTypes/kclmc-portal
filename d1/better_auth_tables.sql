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
