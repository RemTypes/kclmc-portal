/**
 * KCLMC Platform - Cryptographic Password Hasher & Edge JIT Bumping Engine
 * 
 * Standard: PBKDF2-SHA512 (100,000 iterations, 32-byte salt, 64-byte key length)
 * Adheres to OWASP and NIST SP 800-63B guidelines for password storage.
 * Native WebCrypto / Node Crypto execution in Cloudflare Workers edge environment.
 */

import crypto from 'crypto';
import { getD1Database } from '@/lib/db/d1';

export const PBKDF2_ITERATIONS = 100_000;
export const PBKDF2_KEYLEN = 64;
export const PBKDF2_DIGEST = 'sha512';
export const SALT_BYTES = 32;

export interface HashedPasswordResult {
  hash: string;
  salt: string;
}

/**
 * Derives a cryptographically secure PBKDF2-SHA512 password hash with a random salt.
 */
export function hashPassword(password: string, customSalt?: string): HashedPasswordResult {
  const salt = customSalt || crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

/**
 * Timing-safe verification of a candidate password against an existing hash and salt.
 */
export function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  if (!password || !expectedHash || !salt) {
    return false;
  }
  try {
    const { hash: candidateHash } = hashPassword(password, salt);
    const candidateBuffer = Buffer.from(candidateHash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Identifies whether a stored password hash is a temporary migration placeholder.
 */
export function isPlaceholderPassword(hash: string | null | undefined): boolean {
  if (!hash) return true;
  const h = hash.trim().toUpperCase();
  return (
    h === 'MIGRATED_ACCOUNT' ||
    h === 'MIGRATED_PROFILE' ||
    h.startsWith('AUTH_EXTERNAL') ||
    h.length < 32
  );
}

/**
 * JIT (Just-In-Time) Auto-Bump:
 * Automatically and silently migrates a user's password hash into Cloudflare D1
 * immediately after Supabase Auth validates their credentials.
 * 
 * Non-blocking: will never interrupt, delay, or fail the caller's login process.
 */
export async function autoBumpUserPasswordInD1(
  userId: string,
  email: string,
  password: string,
  role: number = 0
): Promise<boolean> {
  if (!userId || !password) {
    return false;
  }

  try {
    const db = await getD1Database();
    if (!db) {
      console.warn('[autoBumpUserPasswordInD1] D1 database handle not available (bypassing bump)');
      return false;
    }

    const cleanEmail = (email || '').trim().toLowerCase();

    // 1. Check if user already exists in D1 by either UUID or email
    const existing = await db
      .prepare('SELECT id, email, password_hash, salt FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1')
      .bind(userId, cleanEmail || userId)
      .first<{ id: string; email: string; password_hash: string; salt: string }>();

    if (existing && !isPlaceholderPassword(existing.password_hash) && existing.salt) {
      // Already bumped to native PBKDF2 hash, no action required
      return false;
    }

    // 2. Hash plaintext password with fresh random 32-byte salt and 100k iterations
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    let baHash: string | null = null;
    try {
      const { hashPassword: hashBetterAuthPassword } = await import('better-auth/crypto');
      baHash = await hashBetterAuthPassword(password);
    } catch {}

    if (existing) {
      // Update existing record by its primary key ID
      await db
        .prepare(`
          UPDATE users SET
            password_hash = ?,
            salt = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(hash, salt, now, existing.id)
        .run();

      if (baHash) {
        await db
          .prepare(`UPDATE "account" SET password = ?, updatedAt = ? WHERE userId = ? AND providerId = 'credential'`)
          .bind(baHash, now, existing.id)
          .run()
          .catch(() => {});
      }
    } else {
      // User doesn't exist in D1 yet, insert new record
      await db
        .prepare(`
          INSERT INTO users (id, email, password_hash, salt, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(userId, cleanEmail || `${userId}@kclmc.internal`, hash, salt, role, now, now)
        .run();

      if (baHash) {
        await db
          .prepare(`
            INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, role)
            VALUES (?, ?, ?, 1, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET updatedAt = excluded.updatedAt
          `)
          .bind(userId, cleanEmail.split('@')[0] || 'Climber', cleanEmail, now, now, role)
          .run()
          .catch(() => {});

        await db
          .prepare(`
            INSERT INTO "account" (id, accountId, providerId, userId, password, createdAt, updatedAt)
            VALUES (?, ?, 'credential', ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET password = excluded.password, updatedAt = excluded.updatedAt
          `)
          .bind(`acc_${userId}`, userId, userId, baHash, now, now)
          .run()
          .catch(() => {});
      }
    }

    console.log(`[autoBumpUserPasswordInD1] Successfully bumped password hash in D1 for ${cleanEmail || userId}`);
    return true;
  } catch (err: any) {
    // Non-blocking catch to ensure zero authentication side-effects
    console.warn('[autoBumpUserPasswordInD1] Failed to auto-bump user hash into D1:', err?.message || err);
    return false;
  }
}
