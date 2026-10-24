/**
 * KCLMC Platform - Migrate Existing D1 Users to Better Auth Schema
 * 
 * Safely copies all existing users and profiles into Better Auth's standard:
 * - "user" table
 * - "account" table (preserving 'MIGRATED_ACCOUNT' placeholder for JIT auto-bump)
 * 
 * Idempotent: Uses INSERT OR IGNORE / ON CONFLICT to avoid duplicate key errors.
 */

import { getD1Database } from '../lib/db/d1';

export async function migrateUsersToBetterAuth(db: any) {
  console.log('🔄 Checking existing users and profiles in D1...');

  // 1. Fetch all users from legacy users table
  const usersRes = await db.prepare('SELECT * FROM users').all();
  const users = usersRes?.results || [];
  console.log(`Found ${users.length} legacy users.`);

  // 2. Fetch profiles
  const profilesRes = await db.prepare('SELECT id, full_name FROM profiles').all();
  const profileMap = new Map((profilesRes?.results || []).map((p: any) => [p.id, p.full_name]));

  let migratedCount = 0;
  for (const u of users) {
    const name = profileMap.get(u.id) || u.email.split('@')[0];
    const email = u.email.toLowerCase().trim();
    const role = u.role ?? 0;
    const createdAt = u.created_at || new Date().toISOString();
    const updatedAt = u.updated_at || new Date().toISOString();
    const twoFactorEnabled = u.mfa_secret ? 1 : 0;

    // Insert into "user"
    await db
      .prepare(`
        INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, twoFactorEnabled, role)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          email = excluded.email,
          role = excluded.role,
          updatedAt = excluded.updatedAt
      `)
      .bind(u.id, name, email, createdAt, updatedAt, twoFactorEnabled, role)
      .run();

    // Insert into "account"
    const accountId = `acc_${u.id}`;
    await db
      .prepare(`
        INSERT INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          password = excluded.password,
          updatedAt = excluded.updatedAt
      `)
      .bind(
        accountId,
        u.id,
        u.id,
        u.password_hash?.includes(':') ? u.password_hash : 'MIGRATED_ACCOUNT',
        createdAt,
        updatedAt
      )
      .run();

    migratedCount++;
  }

  console.log(`✅ Successfully synced ${migratedCount} accounts to Better Auth schema.`);
}

async function main() {
  const db = await getD1Database();
  if (!db) {
    console.error('❌ Could not obtain D1 database handle. Ensure environment is configured.');
    process.exit(1);
  }
  await migrateUsersToBetterAuth(db);
}

if (process.argv[1]?.includes('migrate_d1_to_better_auth')) {
  main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
