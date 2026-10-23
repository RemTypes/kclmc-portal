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
      return false;
    }

    // 1. Check if user already has an active, modern PBKDF2 hash in D1
    const existing = await db
      .prepare('SELECT password_hash, salt FROM users WHERE id = ?')
      .bind(userId)
      .first<{ password_hash: string; salt: string }>();

    if (existing && !isPlaceholderPassword(existing.password_hash) && existing.salt) {
      // Already bumped to native PBKDF2 hash, no action required
      return false;
    }

    // 2. Hash plaintext password with fresh random 32-byte salt and 100k iterations
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const cleanEmail = (email || '').trim().toLowerCase() || `${userId}@kclmc.internal`;

    // 3. Persist into D1 users table
    await db
      .prepare(`
        INSERT INTO users (id, email, password_hash, salt, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          password_hash = excluded.password_hash,
          salt = excluded.salt,
          updated_at = excluded.updated_at
      `)
      .bind(userId, cleanEmail, hash, salt, role, now, now)
      .run();

    return true;
  } catch (err: any) {
    // Non-blocking catch to ensure zero authentication side-effects
    console.warn('[autoBumpUserPasswordInD1] Failed to auto-bump user hash into D1:', err?.message || err);
    return false;
  }
}
