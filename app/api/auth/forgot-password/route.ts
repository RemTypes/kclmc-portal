import { NextResponse } from 'next/server';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt, verifyCaptchaToken } from '@/lib/security/rate-limiter';
import { sanitizeEmail } from '@/lib/auth';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { createBetterAuth } from '@/lib/auth/better-auth';
import { createServerClient } from '@supabase/ssr';

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
    const { email, captchaToken } = body;
    const cleanEmail = sanitizeEmail(email);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // 1. Rate limiting & account lockout check
    const rateCheck = checkRateLimit(ip, cleanEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: rateCheck.reason || 'Too many recovery requests. Please try again later.',
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

    // 2. CAPTCHA enforcement after 3 attempts
    if (rateCheck.requiresCaptcha) {
      if (!captchaToken || !verifyCaptchaToken(captchaToken)) {
        return NextResponse.json(
          {
            error: 'Security verification required. Please complete the CAPTCHA.',
            requiresCaptcha: true,
          },
          { status: 403 }
        );
      }
    }

    // 3. Dispatch Password Reset via Better Auth on D1 & Cloudflare Email Service
    const origin = new URL(request.url).origin;
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;

    let dispatched = false;
    if (db) {
      try {
        const auth = createBetterAuth({ ...env, DB: db, BETTER_AUTH_URL: origin });
        await auth.api.requestPasswordReset({
          body: {
            email: cleanEmail,
            redirectTo: `${origin}/update-password`,
          },
        });
        dispatched = true;
        recordSuccessfulAttempt(ip, cleanEmail);
        console.log(`[PASSWORD RESET] Cloudflare Email dispatched for ${cleanEmail}`);
      } catch (betterAuthErr: any) {
        console.warn(`[PASSWORD RESET] Better Auth notice for ${cleanEmail}:`, betterAuthErr?.message || betterAuthErr);
      }
    }

    // 4. Fallback to Supabase password reset if D1 was unavailable
    if (!dispatched) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

        const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
          cookies: {
            getAll() { return []; },
            setAll() {},
          },
        });

        const { error: resetError } = await serverSupabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${origin}/auth/callback?next=/update-password`,
        });

        if (resetError) {
          recordFailedAttempt(ip, cleanEmail, resetError.message);
          console.warn(`[PASSWORD RESET] Supabase fallback notice for ${cleanEmail}: ${resetError.message}`);
        } else {
          recordSuccessfulAttempt(ip, cleanEmail);
        }
      } catch (fallbackErr) {
        console.warn('[PASSWORD RESET] Supabase fallback failed:', fallbackErr);
      }
    }

    // Always return generic success response to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been dispatched.',
    });
  } catch (err: any) {
    console.error('Password reset handler error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
