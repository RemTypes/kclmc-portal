import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { clear2FAStores } from '@/lib/security/two-factor';

/**
 * GET /api/admin/reset-2fa
 * Lists committee accounts and their D1 2FA enrollment status (SuperAdmin clearance required: role >= 2).
 */
export async function GET(): Promise<NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user || user.role < 2) {
    return NextResponse.json({ error: 'Unauthorized: SuperAdmin clearance required' }, { status: 403 });
  }

  try {
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;
    if (!db) {
      return NextResponse.json({ error: 'D1 Database unavailable' }, { status: 503 });
    }

    // Query committee users and their 2FA status from D1
    const usersResult = await db
      .prepare(`
        SELECT u.id, u.email, u.name, u.role, u."twoFactorEnabled",
               CASE WHEN tf.id IS NOT NULL THEN 1 ELSE 0 END AS hasD1Secret
        FROM "user" u
        LEFT JOIN "twoFactor" tf ON u.id = tf.userId
        WHERE u.role >= 1 OR u.email LIKE '%@kclmc.org'
        ORDER BY u.role DESC, u.email ASC
      `)
      .all()
      .catch(() => ({ results: [], success: false }));

    return NextResponse.json({
      success: true,
      users: usersResult.results || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching committee accounts' }, { status: 500 });
  }
}

/**
 * POST /api/admin/reset-2fa
 * Resets 2FA credentials for a committee member (SuperAdmin clearance required: role >= 2).
 * Wipes the D1 "twoFactor" record and sets "twoFactorEnabled" = 0, prompting clean re-enrollment on next login.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser();
  if (!user || user.role < 2) {
    return NextResponse.json({ error: 'Unauthorized: SuperAdmin clearance required' }, { status: 403 });
  }

  let body: { targetUserId?: string; targetEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const { targetUserId, targetEmail } = body;
  if (!targetUserId && !targetEmail) {
    return NextResponse.json({ error: 'targetUserId or targetEmail is required' }, { status: 400 });
  }

  try {
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;
    if (!db) {
      return NextResponse.json({ error: 'D1 Database unavailable' }, { status: 503 });
    }

    let effectiveUserId = targetUserId;
    if (!effectiveUserId && targetEmail) {
      const cleanEmail = targetEmail.trim().toLowerCase();
      const userRow = (await db
        .prepare('SELECT id FROM "user" WHERE LOWER(email) = ?')
        .bind(cleanEmail)
        .first()) as { id?: string } | null;
      effectiveUserId = userRow?.id;
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: 'Target user not found in D1 database' }, { status: 404 });
    }

    // 1. Delete 2FA credentials in D1
    await db
      .prepare('DELETE FROM "twoFactor" WHERE userId = ?')
      .bind(effectiveUserId)
      .run()
      .catch(() => {});

    // 2. Disable 2FA flag on user in D1
    await db
      .prepare('UPDATE "user" SET "twoFactorEnabled" = 0 WHERE id = ?')
      .bind(effectiveUserId)
      .run()
      .catch(() => {});

    // 3. Clear in-memory caches
    clear2FAStores();

    return NextResponse.json({
      success: true,
      message: `Successfully reset 2FA credentials for user ${effectiveUserId}. They will be prompted to re-enroll on their next login.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error resetting 2FA credentials' }, { status: 500 });
  }
}
