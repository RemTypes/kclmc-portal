import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/server';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { clear2FAStores } from '@/lib/security/two-factor';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/reset-2fa
 * Lists committee accounts and their D1 2FA enrollment status (SuperAdmin clearance required: role >= 2).
 */
export async function GET(request?: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser(request);
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
  } catch {
    return NextResponse.json({ error: 'Error fetching committee accounts' }, { status: 500 });
  }
}

/**
 * POST /api/admin/reset-2fa
 * Resets 2FA credentials for a committee member (SuperAdmin clearance required: role >= 2).
 * Wipes the D1 "twoFactor" record, sets "twoFactorEnabled" = 0, revokes active sessions,
 * and clears legacy Supabase 2FA metadata, prompting clean re-enrollment on next login.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedUser(request);
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

    // 3. Revoke active D1 sessions for the target user so compromised sessions cannot persist
    await db
      .prepare('DELETE FROM "session" WHERE userId = ?')
      .bind(effectiveUserId)
      .run()
      .catch(() => {});

    // 4. Clear legacy Supabase user_metadata 2FA fields if configured
    if (process.env.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminSupabase = createAdminClient();
        if (adminSupabase?.auth?.admin?.updateUserById) {
          await adminSupabase.auth.admin.updateUserById(effectiveUserId, {
            user_metadata: {
              is_2fa_enrolled: false,
              totp_secret: null,
              backup_codes: [],
            },
          });
        }
      } catch {}
    }

    // 5. Clear in-memory caches
    clear2FAStores();

    return NextResponse.json({
      success: true,
      message: `Successfully reset 2FA credentials for user ${effectiveUserId}. They will be prompted to re-enroll on their next login.`,
    });
  } catch {
    return NextResponse.json({ error: 'Error resetting 2FA credentials' }, { status: 500 });
  }
}
