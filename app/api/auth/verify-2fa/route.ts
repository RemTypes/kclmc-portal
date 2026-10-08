import { NextResponse } from 'next/server';
import { verify2FAChallenge } from '@/lib/security/two-factor';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } from '@/lib/security/rate-limiter';
import { setSessionCookies } from '@/lib/security/cookies';

import { createAdminClient } from '@/lib/supabase/server';
import { createServerClient } from '@supabase/ssr';
import { getSafeRedirectUrl } from '@/lib/auth';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  try {
    const body = await request.json().catch(() => ({}));
    const { challengeToken, code, next: nextParam } = body;
    const requestedNext = typeof nextParam === 'string' && nextParam.trim() ? getSafeRedirectUrl(nextParam, '') : '';

    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/kclmc_2fa_pending=([^;]+)/);
    const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null;
    const effectiveToken = (challengeToken && typeof challengeToken === 'string' && challengeToken.trim())
      ? challengeToken.trim()
      : cookieToken;

    if (!effectiveToken || !code) {
      return NextResponse.json(
        { error: 'Challenge token and verification code are required' },
        { status: 400 }
      );
    }

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please wait before retrying.' },
        { status: 429 }
      );
    }

    const result = verify2FAChallenge(effectiveToken, code);

    if (!result.success || !result.sessionData) {
      recordFailedAttempt(ip, undefined, 'Invalid 2FA code');
      return NextResponse.json(
        { error: result.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    recordSuccessfulAttempt(ip, result.email);

    // Persist 2FA enrollment to Supabase user metadata with timeout protection
    if (result.enrolledSecret && result.userId) {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const adminSupabase = createAdminClient();
          if (adminSupabase?.auth?.admin?.updateUserById) {
            await Promise.race([
              adminSupabase.auth.admin.updateUserById(result.userId, {
                user_metadata: {
                  is_2fa_enrolled: true,
                  totp_secret: result.enrolledSecret,
                  backup_codes: result.hashedBackupCodes || [],
                },
              }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
            ]).catch(adminErr => {
              console.warn('[2FA] Admin persistence timeout/warning:', adminErr);
            });
          }
        } catch (adminErr) {
          console.warn('[2FA] Admin persistence warning:', adminErr);
        }
      }

      const accessToken = result.sessionData?.session?.access_token;
      if (accessToken) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';
          const userSupabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
            cookies: { getAll() { return []; }, setAll() {} },
          });
          await Promise.race([
            userSupabase.auth.updateUser({
              data: {
                is_2fa_enrolled: true,
                totp_secret: result.enrolledSecret,
                backup_codes: result.hashedBackupCodes || [],
              },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
          ]).catch(userErr => {
            console.warn('[2FA] User metadata update timeout/warning:', userErr);
          });
        } catch (userErr) {
          console.warn('[2FA] User metadata update warning:', userErr);
        }
      }
    }

    // Update remaining backup codes if a backup code was burned
    if (result.usedBackupCode && result.userId && result.remainingBackupCodes && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminSupabase = createAdminClient();
        if (adminSupabase?.auth?.admin?.updateUserById) {
          await Promise.race([
            adminSupabase.auth.admin.updateUserById(result.userId, {
              user_metadata: {
                backup_codes: result.remainingBackupCodes,
              },
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
          ]).catch(() => {});
        }
      } catch (e) {
        // non-fatal
      }
    }

    const resolvedRole = result.role ?? 0;
    let safeDestination = (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
      ? requestedNext
      : (resolvedRole >= 1 ? '/admin' : '/membership');

    if (!safeDestination || safeDestination === '/login' || safeDestination.startsWith('/login?')) {
      safeDestination = resolvedRole >= 1 ? '/admin' : '/membership';
    }

    const response = NextResponse.json({
      success: true,
      message: result.usedBackupCode
        ? 'Successfully authenticated with single-use backup code.'
        : 'Two-factor authentication verified successfully.',
      user: {
        id: result.userId,
        email: result.email,
        role: resolvedRole,
      },
      destination: safeDestination,
    });

    // Issue httpOnly, Secure, SameSite=Strict cookies
    setSessionCookies(response, result.sessionData);

    // Clear pending 2FA challenge cookie
    response.cookies.set('kclmc_2fa_pending', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    console.error('2FA verification handler error:', err);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}
