import { NextResponse } from 'next/server';
import { verify2FAChallenge } from '@/lib/security/two-factor';
import { checkRateLimit, recordFailedAttempt, recordSuccessfulAttempt } from '@/lib/security/rate-limiter';
import { setSessionCookies } from '@/lib/security/cookies';

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
    const { challengeToken, code } = body;

    if (!challengeToken || !code) {
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

    const result = verify2FAChallenge(challengeToken, code);

    if (!result.success || !result.sessionData) {
      recordFailedAttempt(ip, undefined, 'Invalid 2FA code');
      return NextResponse.json(
        { error: result.error || 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    recordSuccessfulAttempt(ip, result.email);

    const response = NextResponse.json({
      success: true,
      message: result.usedBackupCode
        ? 'Successfully authenticated with single-use backup code.'
        : 'Two-factor authentication verified successfully.',
      user: {
        id: result.userId,
        email: result.email,
        role: result.role,
      },
      destination: (result.role || 0) >= 1 ? '/admin' : '/membership',
    });

    // Issue httpOnly, Secure, SameSite=Strict cookies
    setSessionCookies(response, result.sessionData);
    return response;
  } catch (err: any) {
    console.error('2FA verification handler error:', err);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication' },
      { status: 500 }
    );
  }
}
