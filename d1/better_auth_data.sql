-- Populate Better Auth "user" from existing users and profiles
INSERT OR REPLACE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, twoFactorEnabled, role)
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
LEFT JOIN profiles p ON u.id = p.id;

-- Populate Better Auth "account" from existing users (preserving MIGRATED_ACCOUNT for JIT bump)
INSERT OR REPLACE INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt)
SELECT
  'acc_' || u.id,
  u.id,
  'credential',
  u.id,
  CASE WHEN u.password_hash IS NOT NULL AND u.password_hash LIKE '$scrypt$%' THEN u.password_hash ELSE 'MIGRATED_ACCOUNT' END,
  u.created_at,
  u.updated_at
FROM users u;
