import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } from '@/lib/security/rate-limiter';
import { validatePasswordStrength } from '@/lib/security/password-validator';
import { setSessionCookies } from '@/lib/security/cookies';
import { sanitizeEmail, sanitizeStudentId, sanitizeUniversity } from '@/lib/auth';
import { trackServerEvent } from '@/lib/telemetry-server';

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
    const { email, password, fullName, studentId, university } = body;

    const cleanEmail = sanitizeEmail(email);
    const cleanStudentId = sanitizeStudentId(studentId);
    const cleanFullName = (fullName || '').trim().slice(0, 100);
    const cleanUniversity = sanitizeUniversity(university);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // 1. Rate limiting on signup
    const rateCheck = checkRateLimit(ip, cleanEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason || 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Strict Server-Side Password Policy Enforcement
    const pwdValidation = validatePasswordStrength(password);
    if (!pwdValidation.isValid) {
      recordFailedAttempt(ip, cleanEmail, 'Password does not meet security policy');
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

    // 3. Register user with Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

    let cookiesToSet: any[] = [];
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

    const origin = new URL(request.url).origin;
    const { data: authData, error: authError } = await serverSupabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanFullName,
          student_id: cleanStudentId,
          university: cleanUniversity,
        },
        emailRedirectTo: `${origin}/auth/callback?next=/membership`,
      },
    });

    if (authError) {
      recordFailedAttempt(ip, cleanEmail, authError.message);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    recordSuccessfulAttempt(ip, cleanEmail);

    // Track user signup conversion event
    trackServerEvent('user_signup', {
      userId: authData.user?.id,
      emailDomain: cleanEmail.split('@')[1],
      university: cleanUniversity || "King's College London",
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      user: authData.user ? { id: authData.user.id, email: authData.user.email } : null,
      message: 'Account created successfully.',
    });

    // If session was generated immediately, attach httpOnly cookies
    if (authData.session) {
      setSessionCookies(response, authData.session);
    }

    return response;
  } catch (err: any) {
    console.error('Signup error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating your account.' },
      { status: 500 }
    );
  }
}
