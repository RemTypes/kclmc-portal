import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt, verifyCaptchaToken } from '@/lib/security/rate-limiter';
import { sanitizeEmail } from '@/lib/auth';

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

    // 3. Supabase password reset request
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

    const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get('cookie') || '';
          return cookieHeader.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll() {},
      },
    });

    const origin = new URL(request.url).origin;
    const { error: resetError } = await serverSupabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${origin}/auth/callback?next=/update-password`,
    });

    if (resetError) {
      recordFailedAttempt(ip, cleanEmail, resetError.message);
      // Prevent user enumeration by returning consistent success response for security
      console.warn(`[PASSWORD RESET] Supabase notice for ${cleanEmail}: ${resetError.message}`);
    } else {
      recordSuccessfulAttempt(ip, cleanEmail);
    }

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
