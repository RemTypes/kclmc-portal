import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { create2FAEnrollmentChallenge } from '@/lib/security/two-factor';

/**
 * GET /api/auth/setup-2fa
 * Returns the current 2FA status for the logged-in user.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let enrolled = false;
  try {
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;
    if (db) {
      await db
        .exec(
          `CREATE TABLE IF NOT EXISTS "twoFactor" (
            id TEXT PRIMARY KEY,
            secret TEXT NOT NULL,
            backupCodes TEXT,
            userId TEXT NOT NULL UNIQUE,
            verified INTEGER DEFAULT 1
          );`
        )
        .catch(() => {});

      const row = (await db
        .prepare('SELECT id, verified FROM "twoFactor" WHERE userId = ?')
        .bind(user.id)
        .first()) as { id?: string; verified?: number } | null;

      if (row?.id) {
        enrolled = true;
      }
    }
  } catch (err) {
    console.warn('[setup-2fa] D1 query non-fatal warning:', err);
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    enrolled,
  });
}

/**
 * POST /api/auth/setup-2fa
 * Initiates self-service 2FA enrollment/re-enrollment for the authenticated committee user.
 * Generates a fresh RFC 6238 TOTP secret, QR code URI, emergency backup codes, and a sealed challenge token.
 */
export async function POST(): Promise<NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: Session required to re-enroll 2FA' }, { status: 401 });
  }

  const env = await getCloudflareEnv();
  const cfSecret = env?.BETTER_AUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY;

  const setup = create2FAEnrollmentChallenge(
    user.id,
    user.email,
    user.role,
    { session: {} },
    cfSecret
  );

  const response = NextResponse.json({
    success: true,
    secret: setup.secret,
    totpUri: setup.totpUri,
    backupCodes: setup.backupCodes,
    challengeToken: setup.challengeToken,
    expiresAt: setup.expiresAt,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });

  // Attach pending 2FA challenge cookie
  response.cookies.set('kclmc_2fa_pending', setup.challengeToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
