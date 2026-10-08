import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } from '@/lib/security/rate-limiter';
import { validatePasswordStrength } from '@/lib/security/password-validator';
import { applySessionCookies, setSessionCookies } from '@/lib/security/cookies';

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
    const { password } = body;

    // 1. Rate limiting on password reset
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason || 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Strict password strength validation
    const pwdValidation = validatePasswordStrength(password);
    if (!pwdValidation.isValid) {
      recordFailedAttempt(ip, undefined, 'Password does not meet security policy');
      return NextResponse.json(
        {
          error: pwdValidation.errors[0] || 'Password does not meet security requirements',
          details: pwdValidation.errors,
          suggestions: pwdValidation.suggestions,
          score: pwdValidation.score,
        },
        { status: 400 }
      );
    }

    // 3. Update password via Supabase server client (supports cookie session and Bearer token)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

    let cookiesToSet: any[] = [];
    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (typeof body.accessToken === 'string' && body.accessToken.trim() ? body.accessToken.trim() : null);

    let data: any = null;
    let error: any = null;

    if (bearerToken) {
      const tokenClient = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll: () => [],
          setAll: (toSet) => { cookiesToSet = toSet; },
        },
        global: {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        },
      });
      const res = await tokenClient.auth.updateUser({ password });
      data = res.data;
      error = res.error;
    } else {
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
      const res = await serverSupabase.auth.updateUser({ password });
      data = res.data;
      error = res.error;
    }

    if (error) {
      recordFailedAttempt(ip, undefined, error.message);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    recordSuccessfulAttempt(ip, data.user?.email);

    const response = NextResponse.json({
      success: true,
      message: 'Password updated successfully. You are now logged in.',
    });

    if (cookiesToSet.length > 0) {
      applySessionCookies(response, cookiesToSet);
    }

    return response;
  } catch (err: any) {
    console.error('Reset password handler error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while resetting your password.' },
      { status: 500 }
    );
  }
}
