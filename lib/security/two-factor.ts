/**
 * Two-Factor Authentication (2FA) & OTP Engine
 * 
 * Features:
 * - RFC 6238 Time-based One-Time Password (TOTP / Authenticator App: Google Auth, Authy, 1Password)
 * - Cryptographic Email OTP generation & verification
 * - 5-minute strict OTP expiry
 * - Single-use 8-character Backup Codes (XXXX-XXXX) with burn-on-use
 * - Mandatory 2FA enforcement for Admin & Committee accounts (Role >= 1)
 * - Rate-limited challenge verification (max 3 attempts per challenge token)
 */

import crypto from 'crypto';
import { getUserRole } from '@/lib/auth';

export interface Pending2FAChallenge {
  challengeToken: string;
  userId: string;
  email: string;
  role: number;
  hashedOtp: string;
  expiresAt: number;
  attemptsLeft: number;
  sessionData?: any; // Stored session payload or cookie tuples to promote upon successful 2FA
  enrollSecret?: string;
  isSetup?: boolean;
  totpSecret?: string;
  hashedBackupCodes?: string[];
}

// In-memory challenge store (keyed by challengeToken)
const pendingChallenges = new Map<string, Pending2FAChallenge>();

// Set of invalidated or consumed challenge tokens (to prevent replay and reuse)
const invalidatedChallenges = new Set<string>();

// Account backup codes store (in-memory with hashing, persistent across session in memory)
// Map<userId, Set<hashedBackupCode>>
const userBackupCodes = new Map<string, Set<string>>();

// Account TOTP secrets store: Map<userId, string>
const userTotpSecrets = new Map<string, string>();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;

function hashToken(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

function getTwoFactorSecretKey(): Buffer {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'kclmc-secure-production-2fa-token-salt-2026';
  return crypto.createHash('sha256').update(`kclmc-2fa-seal:${secret}`).digest();
}

/**
 * Statelessly seal a 2FA challenge using AES-256-GCM authenticated encryption.
 * Survives across Cloudflare Workers isolates, serverless cold starts, and multi-region routing.
 */
export function sealChallenge(challenge: Pending2FAChallenge): string {
  try {
    const key = getTwoFactorSecretKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const plainText = JSON.stringify(challenge);
    let ciphertext = cipher.update(plainText, 'utf8', 'base64url');
    ciphertext += cipher.final('base64url');
    const authTag = cipher.getAuthTag().toString('base64url');
    return `${iv.toString('base64url')}.${authTag}.${ciphertext}`;
  } catch (e) {
    console.error('Failed to seal 2FA challenge:', e);
    return challenge.challengeToken || crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Unseal and verify a sealed 2FA challenge token.
 */
export function unsealChallenge(token: string): Pending2FAChallenge | null {
  if (!token) return null;
  if (invalidatedChallenges.has(token)) {
    return null;
  }
  // If in-memory map has it (e.g. unit test or same isolate)
  if (pendingChallenges.has(token)) {
    return pendingChallenges.get(token) || null;
  }

  // Check if token is sealed (iv.tag.ciphertext format)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const [ivB64, tagB64, cipherB64] = parts;
    const key = getTwoFactorSecretKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(cipherB64, 'base64url', 'utf8');
    decrypted += decipher.final('utf8');
    const payload = JSON.parse(decrypted) as Pending2FAChallenge;
    return payload;
  } catch (e) {
    console.warn('Failed to unseal 2FA challenge token:', e);
    return null;
  }
}

/**
 * Check whether a user already has an enrolled 2FA authenticator secret.
 */
export function isUser2FAEnrolled(userId: string, userMetadata?: any): boolean {
  if (!userId) return false;
  if (userMetadata?.totp_secret || userMetadata?.is_2fa_enrolled) {
    if (userMetadata.totp_secret && !userTotpSecrets.has(userId)) {
      setUserTOTPSecret(userId, userMetadata.totp_secret);
    }
    if (userMetadata.backup_codes && Array.isArray(userMetadata.backup_codes)) {
      setUserHashedBackupCodes(userId, userMetadata.backup_codes);
    }
    return true;
  }
  return userTotpSecrets.has(userId);
}

/**
 * Create a first-time 2FA setup/enrollment challenge for an un-enrolled committee member.
 */
export function create2FAEnrollmentChallenge(
  userId: string,
  email: string,
  role: number,
  sessionData?: any
): { challengeToken: string; secret: string; totpUri: string; backupCodes: string[]; expiresAt: number } {
  const secret = generateTOTPSecret();
  const totpUri = `otpauth://totp/KCLMC:${encodeURIComponent(email)}?secret=${secret}&issuer=KCLMC&period=30&digits=6`;
  const backupCodes = generateBackupCodes(userId);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes for setup
  const hashedBackupCodes = getUserHashedBackupCodes(userId);

  const rawChallenge: Pending2FAChallenge = {
    challengeToken: '',
    userId,
    email,
    role,
    hashedOtp: '',
    expiresAt,
    attemptsLeft: 5,
    sessionData,
    enrollSecret: secret,
    isSetup: true,
    hashedBackupCodes,
  };

  const challengeToken = sealChallenge(rawChallenge);
  rawChallenge.challengeToken = challengeToken;

  pendingChallenges.set(challengeToken, rawChallenge);

  return { challengeToken, secret, totpUri, backupCodes, expiresAt };
}

/**
 * Base32 decode for RFC 6238 TOTP
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Calculate RFC 6238 TOTP token for given secret and timestamp
 */
export function calculateTOTP(secret: string, timestampMs = Date.now()): string {
  const secretBytes = base32Decode(secret);
  const timeStep = Math.floor(timestampMs / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against a secret with +/- 1 time-step window (90s tolerance)
 */
export function verifyTOTP(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  const cleanCode = code.trim().replace(/[^0-9]/g, '');
  if (cleanCode.length !== 6) return false;

  const now = Date.now();
  const step = 30 * 1000;
  for (const offset of [-1, 0, 1]) {
    const expected = calculateTOTP(secret, now + offset * step);
    if (expected === cleanCode) return true;
  }
  return false;
}

/**
 * Generate a random Base32 TOTP secret for authenticator apps
 */
export function generateTOTPSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const randomBytes = crypto.randomBytes(20);
  for (let i = 0; i < 32; i++) {
    secret += alphabet[randomBytes[i % randomBytes.length] % alphabet.length];
  }
  return secret;
}

/**
 * Store or retrieve user TOTP secret
 */
export function setUserTOTPSecret(userId: string, secret: string): void {
  userTotpSecrets.set(userId, secret);
}

export function getUserTOTPSecret(userId: string): string | undefined {
  return userTotpSecrets.get(userId);
}

/**
 * Determine if an account requires mandatory 2FA.
 * Admins (Role 2) and Committee (Role 1) are strictly required to use 2FA.
 */
export function requiresMandatory2FA(email: string, role?: number): boolean {
  if (!email) return false;
  const effectiveRole = role !== undefined ? role : getUserRole(email);
  return effectiveRole >= 1;
}

/**
 * Create a new 2FA challenge for a user logging in.
 */
export function create2FAChallenge(
  userId: string,
  email: string,
  role: number,
  sessionData?: any,
  totpSecret?: string,
  userBackupCodesList?: string[]
): { challengeToken: string; otpCode: string; expiresAt: number } {
  // Generate 6-digit numeric OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const hashedOtp = hashToken(otpCode);
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  const resolvedTotpSecret = totpSecret || userTotpSecrets.get(userId);
  const resolvedBackupCodes = userBackupCodesList || getUserHashedBackupCodes(userId);

  const rawChallenge: Pending2FAChallenge = {
    challengeToken: '',
    userId,
    email,
    role,
    hashedOtp,
    expiresAt,
    attemptsLeft: MAX_OTP_ATTEMPTS,
    sessionData,
    totpSecret: resolvedTotpSecret,
    hashedBackupCodes: resolvedBackupCodes,
  };

  const challengeToken = sealChallenge(rawChallenge);
  rawChallenge.challengeToken = challengeToken;

  pendingChallenges.set(challengeToken, rawChallenge);

  return { challengeToken, otpCode, expiresAt };
}

/**
 * Generate 8 secure, single-use backup codes for an account.
 * Format: XXXX-XXXX
 */
export function generateBackupCodes(userId: string): string[] {
  const rawCodes: string[] = [];
  const hashedSet = new Set<string>();

  for (let i = 0; i < 8; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    rawCodes.push(code);
    hashedSet.add(hashToken(code.replace(/[^A-Za-z0-9]/g, '').toUpperCase()));
  }

  userBackupCodes.set(userId, hashedSet);
  return rawCodes;
}

/**
 * Retrieve user's hashed backup codes.
 */
export function getUserHashedBackupCodes(userId: string): string[] {
  const existing = userBackupCodes.get(userId);
  return existing ? Array.from(existing) : [];
}

/**
 * Set user's hashed backup codes.
 */
export function setUserHashedBackupCodes(userId: string, hashedCodes: string[]): void {
  userBackupCodes.set(userId, new Set(hashedCodes));
}

/**
 * Ensure an account has backup codes available (generates default set if not yet initialized).
 */
export function getOrCreateBackupCodes(userId: string): string[] {
  const existing = userBackupCodes.get(userId);
  if (existing && existing.size > 0) {
    return Array.from(existing);
  }
  return generateBackupCodes(userId);
}

export interface Verify2FAResult {
  success: boolean;
  error?: string;
  sessionData?: any;
  userId?: string;
  email?: string;
  role?: number;
  usedBackupCode?: boolean;
  usedTOTP?: boolean;
  usedEmailOTP?: boolean;
  enrolledSecret?: string;
  hashedBackupCodes?: string[];
  remainingBackupCodes?: string[];
}

/**
 * Verify either an Email OTP code, Authenticator App (TOTP) code, or a Backup Code
 * against an active 2FA challenge.
 */
export function verify2FAChallenge(
  challengeToken: string,
  code: string
): Verify2FAResult {
  if (!challengeToken || !code) {
    return { success: false, error: 'Challenge token and verification code are required' };
  }

  const challenge = unsealChallenge(challengeToken);
  if (!challenge) {
    return { success: false, error: 'Invalid or expired 2FA session. Please log in again.' };
  }

  const now = Date.now();
  if (now > challenge.expiresAt) {
    invalidatedChallenges.add(challengeToken);
    pendingChallenges.delete(challengeToken);
    return { success: false, error: '2FA session has expired. Please log in again.' };
  }

  if (challenge.attemptsLeft <= 0) {
    invalidatedChallenges.add(challengeToken);
    pendingChallenges.delete(challengeToken);
    return { success: false, error: 'Maximum verification attempts exceeded. Please log in again.' };
  }

  const cleanCode = code.trim();
  const cleanNumeric = cleanCode.replace(/[^0-9]/g, '');
  const cleanBackup = cleanCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  // 0. Check first-time enrollment setup challenge
  if (challenge.isSetup && challenge.enrollSecret) {
    if (cleanNumeric.length === 6 && verifyTOTP(challenge.enrollSecret, cleanNumeric)) {
      setUserTOTPSecret(challenge.userId, challenge.enrollSecret);
      invalidatedChallenges.add(challengeToken);
      pendingChallenges.delete(challengeToken);
      const hashedBackupCodes = challenge.hashedBackupCodes || getUserHashedBackupCodes(challenge.userId);
      return {
        success: true,
        userId: challenge.userId,
        email: challenge.email,
        role: challenge.role,
        sessionData: challenge.sessionData,
        usedTOTP: true,
        enrolledSecret: challenge.enrollSecret,
        hashedBackupCodes,
      };
    }
  }

  // 1. Check Email OTP code
  if (cleanNumeric.length === 6) {
    const hashedAttempt = hashToken(cleanNumeric);
    if (challenge.hashedOtp && hashedAttempt === challenge.hashedOtp) {
      invalidatedChallenges.add(challengeToken);
      pendingChallenges.delete(challengeToken);
      return {
        success: true,
        userId: challenge.userId,
        email: challenge.email,
        role: challenge.role,
        sessionData: challenge.sessionData,
        usedEmailOTP: true,
      };
    }

    // Check TOTP if user has authenticator secret configured (in challenge or memory)
    const userTotpSecret = challenge.totpSecret || userTotpSecrets.get(challenge.userId);
    if (userTotpSecret && verifyTOTP(userTotpSecret, cleanNumeric)) {
      invalidatedChallenges.add(challengeToken);
      pendingChallenges.delete(challengeToken);
      return {
        success: true,
        userId: challenge.userId,
        email: challenge.email,
        role: challenge.role,
        sessionData: challenge.sessionData,
        usedTOTP: true,
      };
    }
  }

  // 2. Check Backup Code (8 chars e.g. XXXX-XXXX or XXXXXXXX)
  const userCodes = userBackupCodes.get(challenge.userId);
  const challengeCodesSet = challenge.hashedBackupCodes && challenge.hashedBackupCodes.length > 0
    ? new Set(challenge.hashedBackupCodes)
    : null;
  const codesSet = userCodes || challengeCodesSet;

  if (codesSet && cleanBackup.length === 8) {
    const hashedAttempt = hashToken(cleanBackup);
    if (codesSet.has(hashedAttempt)) {
      // Burn the single-use backup code
      if (userCodes) userCodes.delete(hashedAttempt);
      if (challengeCodesSet) challengeCodesSet.delete(hashedAttempt);
      invalidatedChallenges.add(challengeToken);
      pendingChallenges.delete(challengeToken);
      return {
        success: true,
        userId: challenge.userId,
        email: challenge.email,
        role: challenge.role,
        sessionData: challenge.sessionData,
        usedBackupCode: true,
        remainingBackupCodes: Array.from(codesSet),
      };
    }
  }

  // Failed attempt
  challenge.attemptsLeft -= 1;
  if (challenge.attemptsLeft <= 0) {
    invalidatedChallenges.add(challengeToken);
    pendingChallenges.delete(challengeToken);
    return {
      success: false,
      error: 'Too many incorrect 2FA attempts. This challenge has been invalidated. Please log in again.',
    };
  }

  return {
    success: false,
    error: `Invalid verification code. ${challenge.attemptsLeft} attempt${challenge.attemptsLeft === 1 ? '' : 's'} remaining.`,
  };
}

export function clear2FAStores(): void {
  pendingChallenges.clear();
  invalidatedChallenges.clear();
  userBackupCodes.clear();
  userTotpSecrets.clear();
}

