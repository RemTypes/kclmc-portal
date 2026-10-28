import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as setup2FAGet, POST as setup2FAPost } from '@/app/api/auth/setup-2fa/route';
import { POST as verify2FAPost } from '@/app/api/auth/verify-2fa/route';
import { calculateTOTP } from '@/lib/security/two-factor';
import * as serverAuth from '@/lib/auth/server';

describe('Self-Service 2FA Setup API (/api/auth/setup-2fa)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated GET requests with 401', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue(null);

    const res = await setup2FAGet();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('rejects unauthenticated POST requests with 401', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue(null);

    const res = await setup2FAPost();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Unauthorized');
  });

  it('returns user info and enrollment status for authenticated committee member on GET', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'test-committee-id',
      email: 'president@kclmc.org',
      role: 1,
    });

    const res = await setup2FAGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.user.email).toBe('president@kclmc.org');
    expect(typeof data.enrolled).toBe('boolean');
  });

  it('initiates 2FA enrollment on POST and returns challenge, secret, QR URI, and backup codes', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'test-committee-id-2',
      email: 'remy.preston@outlook.com',
      role: 2,
    });

    const res = await setup2FAPost();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.secret).toBeDefined();
    expect(data.secret.length).toBe(32);
    expect(data.totpUri).toContain('otpauth://totp/KCLMC');
    expect(data.backupCodes).toHaveLength(8);
    expect(data.challengeToken).toBeDefined();

    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain('kclmc_2fa_pending=');

    // Verify code immediately via /api/auth/verify-2fa
    const validCode = calculateTOTP(data.secret);
    const verifyReq = new Request('http://localhost:3000/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: data.challengeToken,
        code: validCode,
      }),
    });

    const verifyRes = await verify2FAPost(verifyReq);
    expect(verifyRes.status).toBe(200);
    const verifyData = await verifyRes.json();
    expect(verifyData.success).toBe(true);
  });
});
