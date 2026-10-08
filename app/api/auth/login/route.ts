import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt, verifyCaptchaToken } from '@/lib/security/rate-limiter';
import { requiresMandatory2FA, create2FAChallenge, create2FAEnrollmentChallenge, isUser2FAEnrolled, getUserTOTPSecret, getUserHashedBackupCodes } from '@/lib/security/two-factor';
import { setSessionCookies, applySessionCookies } from '@/lib/security/cookies';
import { getUserRole, getAuthenticatedUserRole, sanitizeEmail, getSafeRedirectUrl } from '@/lib/auth';

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
    const { email, password, captchaToken, next: nextParam } = body;
    const requestedNext = typeof nextParam === 'string' && nextParam.trim() ? getSafeRedirectUrl(nextParam, '') : '';

    const cleanEmail = sanitizeEmail(email);

    if (!cleanEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 1. Check Rate Limit & Account Lockout
    const rateCheck = checkRateLimit(ip, cleanEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.reason || 'Too many login attempts. Account temporarily locked.',
          isLocked: true,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
          requiresCaptcha: rateCheck.requiresCaptcha,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfterSeconds || 900) },
        }
      );
    }

    // 2. Enforce CAPTCHA if threshold reached (3+ failures)
    if (rateCheck.requiresCaptcha) {
      if (!captchaToken || !verifyCaptchaToken(captchaToken)) {
        return NextResponse.json(
          {
            error: 'Security verification required. Please complete the CAPTCHA challenge.',
            requiresCaptcha: true,
          },
          { status: 403 }
        );
      }
    }

    // 3. Authenticate with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

    let cookiesToSet: { name: string; value: string; options: any }[] = [];
    const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || '';
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll(toSet) {
          cookiesToSet = toSet;
        },
      },
    });

    const { data: authData, error: authError } = await serverSupabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (authError || !authData?.user || !authData?.session) {
      const failRecord = recordFailedAttempt(ip, cleanEmail, authError?.message || 'Invalid credentials');
      return NextResponse.json(
        {
          error: authError?.message || 'Invalid email or password',
          remainingAttempts: Math.max(0, 5 - failRecord.attemptCount),
          requiresCaptcha: failRecord.requiresCaptcha,
          isLocked: failRecord.isLocked,
          backoffSeconds: failRecord.backoffSeconds,
        },
        { status: 401 }
      );
    }

    const user = authData.user;
    const session = authData.session;
    const userRole = await getAuthenticatedUserRole(serverSupabase, user);

    // 4. Check 2FA Requirement
    if (requiresMandatory2FA(cleanEmail, userRole)) {
      const isEnrolled = isUser2FAEnrolled(user.id, user.user_metadata);
      const sessionPayload = {
        session,
        cookiesToSet: cookiesToSet.length > 0 ? cookiesToSet : undefined,
      };

      if (!isEnrolled) {
        const setup = create2FAEnrollmentChallenge(
          user.id,
          cleanEmail,
          userRole,
          sessionPayload
        );

        const response = NextResponse.json({
          requires2FASetup: true,
          challengeToken: setup.challengeToken,
          secret: setup.secret,
          totpUri: setup.totpUri,
          backupCodes: setup.backupCodes,
          expiresAt: setup.expiresAt,
          message: 'Two-factor authentication is required for committee accounts. Please scan the QR code into your authenticator app to complete activation.',
          destination: (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
            ? requestedNext
            : (userRole >= 1 ? '/admin' : '/membership'),
        });

        response.cookies.set('kclmc_2fa_pending', setup.challengeToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 10 * 60, // 10 minutes
        });

        return response;
      }

      // User is already enrolled, create standard 2FA verification challenge
      const userTotpSecret = user.user_metadata?.totp_secret || getUserTOTPSecret(user.id);
      const userBackupCodesList = user.user_metadata?.backup_codes || getUserHashedBackupCodes(user.id);

      const challenge = create2FAChallenge(
        user.id,
        cleanEmail,
        userRole,
        sessionPayload,
        userTotpSecret,
        userBackupCodesList
      );

      console.log(`[2FA NOTICE] 2FA Challenge created for ${cleanEmail} (Role: ${userRole}). OTP: ${challenge.otpCode} (Expires in 5 min)`);

      const response = NextResponse.json({
        requires2FA: true,
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt,
        message: 'Please enter the 6-digit code from your authenticator app or an emergency backup code.',
        destination: (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
          ? requestedNext
          : (userRole >= 1 ? '/admin' : '/membership'),
      });

      response.cookies.set('kclmc_2fa_pending', challenge.challengeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 5 * 60, // 5 minutes
      });

      return response;
    }

    // 5. Successful login without 2FA: Reset rate limits & set httpOnly, Secure, SameSite=Strict cookies
    recordSuccessfulAttempt(ip, cleanEmail);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: userRole,
      },
      destination: (requestedNext && requestedNext !== '/login' && !requestedNext.startsWith('/login?') && !requestedNext.startsWith('/auth'))
        ? requestedNext
        : (userRole >= 1 ? '/admin' : '/membership'),
    });

    if (cookiesToSet.length > 0) {
      applySessionCookies(response, cookiesToSet);
    } else {
      setSessionCookies(response, session);
    }
    return response;
  } catch (err: any) {
    console.error('Login handler exception:', err);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
