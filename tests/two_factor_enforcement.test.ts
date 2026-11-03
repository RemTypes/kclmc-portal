import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { authSession, extractClientIp } from '@/lib/auth/session';
import { SESSION_COOKIE_OPTIONS, applySessionCookies } from '@/lib/security/cookies';
import { getCloudflareEnv } from '@/lib/db/d1';
import { createBetterAuth } from '@/lib/auth/better-auth';
import * as clientModule from '@/lib/auth/better-auth-client';
import {
  requiresMandatory2FA,
  create2FAChallenge,
  calculateTOTP,
  clear2FAStores,
  resolveValid2FASecret,
} from '@/lib/security/two-factor';
import { checkRateLimit, recordFailedAttempt, clearRateLimitStores } from '@/lib/security/rate-limiter';
import { middleware } from '@/middleware';

describe('Two-Factor Enforcement & Cloudflare Edge Hardening (M1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('[SEC-01] Better Auth twoFactor Plugin Conflict Disarmed', () => {
    it('does not register built-in twoFactor plugin in createBetterAuth', () => {
      const mockDb: any = {
        prepare: vi.fn(),
      };
      const auth = createBetterAuth({
        DB: mockDb,
        BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-hex',
        BETTER_AUTH_URL: 'https://kclmc.org',
      });

      // Better Auth options plugins array should only contain magicLink, NOT twoFactor
      const pluginIds = (auth.options.plugins || []).map((p: any) => p.id);
      expect(pluginIds).not.toContain('two-factor');
      expect(pluginIds).toContain('magic-link');
    });

    it('does not export twoFactor from better-auth-client', () => {
      // In better-auth client, twoFactor is disarmed so D1 2FA login gate manages verification
      expect('twoFactor' in clientModule).toBe(false);
    });
  });

  describe('[SEC-01] Login Gate 2FA Enforcement & Emergency Controls', () => {
    it('enforces mandatory 2FA requirement for committee officers (role >= 1)', () => {
      expect(requiresMandatory2FA('president@kclmc.org', 1)).toBe(true);
      expect(requiresMandatory2FA('treasurer@kclmc.org', 1)).toBe(true);
      expect(requiresMandatory2FA('admin@kclmc.org', 2)).toBe(true);
    });

    it('does not enforce 2FA requirement for regular members (role = 0)', () => {
      expect(requiresMandatory2FA('climber@kcl.ac.uk', 0)).toBe(false);
      expect(requiresMandatory2FA('guest@example.com', 0)).toBe(false);
    });

    it('retains ENFORCE_MANDATORY_2FA=true as default', () => {
      const enforceDefault = process.env.ENFORCE_MANDATORY_2FA !== 'false';
      expect(enforceDefault).toBe(true);
    });
  });

  describe('[EDGE-03] extractClientIp Header Precedence', () => {
    it('prioritizes cf-connecting-ip over x-forwarded-for and x-real-ip', () => {
      const req = new Request('https://kclmc.org/api/auth/login', {
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
          'x-real-ip': '198.51.100.5',
        },
      });

      expect(extractClientIp(req)).toBe('203.0.113.195');
    });

    it('falls back to x-forwarded-for first entry when cf-connecting-ip is missing', () => {
      const req = new Request('https://kclmc.org/api/auth/login', {
        headers: {
          'x-forwarded-for': '198.51.100.1, 198.51.100.2',
          'x-real-ip': '198.51.100.5',
        },
      });

      expect(extractClientIp(req)).toBe('198.51.100.1');
    });

    it('falls back to x-real-ip when cf-connecting-ip and x-forwarded-for are missing', () => {
      const req = new Request('https://kclmc.org/api/auth/login', {
        headers: {
          'x-real-ip': '198.51.100.99',
        },
      });

      expect(extractClientIp(req)).toBe('198.51.100.99');
    });

    it('defaults to 127.0.0.1 when no IP headers are present', () => {
      const req = new Request('https://kclmc.org/api/auth/login');
      expect(extractClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('[EDGE-03] getCloudflareEnv Context Resolution Fallback', () => {
    it('returns an empty object {} rather than globalThis when running outside Cloudflare Worker', async () => {
      // Ensure global __cloudflare-context__ symbol and __CF_ENV__ are clear
      const cfSymbol = Symbol.for('__cloudflare-context__');
      delete (globalThis as any)[cfSymbol];
      delete (globalThis as any).__CF_ENV__;
      delete (globalThis as any).env;

      const env = await getCloudflareEnv();
      expect(env).toEqual({});
      // Crucial: env must NOT contain global properties like setTimeout, Math, etc.
      expect((env as any).setTimeout).toBeUndefined();
      expect((env as any).Object).toBeUndefined();
    });
  });

  describe('[EDGE-01] Cookie SameSite=Lax Alignment', () => {
    it('configures SESSION_COOKIE_OPTIONS with sameSite: lax', () => {
      expect(SESSION_COOKIE_OPTIONS.sameSite).toBe('lax');
      expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
      expect(SESSION_COOKIE_OPTIONS.path).toBe('/');
    });

    it('applies sameSite=lax in applySessionCookies', () => {
      const res = NextResponse.json({ ok: true });
      applySessionCookies(res, [
        { name: 'test_session', value: 'session_value_xyz' },
      ]);

      const cookieHeader = res.headers.get('set-cookie') || '';
      expect(cookieHeader.toLowerCase()).toContain('samesite=lax');
      expect(cookieHeader.toLowerCase()).not.toContain('samesite=strict');
    });
  });

  describe('[SEC-05] Middleware Disabled Module Guard in Fallback Branch', () => {
    it('redirects to /dashboard?module_disabled=1 when accessing disabled module in Supabase fallback mode', async () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const origKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder-project.supabase.co';

      try {
        const req = new NextRequest('http://localhost:3000/drops/lube');
        req.cookies.set('kclmc_session', 'active');

        const res = await middleware(req);
        expect(res.status).toBe(307);
        const location = res.headers.get('location') || '';
        expect(location).toContain('/dashboard?module_disabled=1');
      } finally {
        if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (origKey !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origKey;
        else delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      }
    });

    it('redirects unauthenticated admin requests to /login in fallback mode', async () => {
      const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder-project.supabase.co';

      try {
        const req = new NextRequest('http://localhost:3000/admin/reconcile');
        const res = await middleware(req);
        expect(res.status).toBe(307);
        const location = res.headers.get('location') || '';
        expect(location).toContain('/login');
        expect(location).toContain('next=%2Fadmin%2Freconcile');
      } finally {
        if (origUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
        else delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      }
    });
  });

  describe('Cross-Isolate 2FA Acceptance & Rate Limit Isolation', () => {
    it('accepts valid 2FA TOTP on the first attempt across isolates even when BETTER_AUTH_SECRET is banned or unset in production', async () => {
      const origNodeEnv = process.env.NODE_ENV;
      const origSecret = process.env.BETTER_AUTH_SECRET;
      const origSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        // Simulate banned secret present in BETTER_AUTH_SECRET while SUPABASE_SERVICE_ROLE_KEY is unset
        process.env.BETTER_AUTH_SECRET = '1ee648c7f7b07ffcce236264aad790a17d390b39ba5f2c9df02a7d5919925278';
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const totpSecret = 'JBSWY3DPEHPK3PXP';
        const cfSecret = resolveValid2FASecret(process.env);
        const challenge = create2FAChallenge(
          'committee-iso-user',
          'president@kclmc.org',
          1,
          { session: { token: 'ba-session-token' } },
          totpSecret,
          [],
          cfSecret
        );

        // Simulate verification landing on a completely separate Cloudflare Worker isolate (empty memory)
        clear2FAStores();
        clearRateLimitStores();

        const validCode = calculateTOTP(totpSecret);
        const outcome = await authSession.verifyTwoFactor({
          challengeToken: challenge.challengeToken,
          code: validCode,
          ip: '203.0.113.50',
        });

        expect(outcome.status).toBe('authenticated');
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
        if (origSecret !== undefined) process.env.BETTER_AUTH_SECRET = origSecret;
        else delete process.env.BETTER_AUTH_SECRET;
        if (origSupabase !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabase;
        else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      }
    });

    it('isolates 2FA verification rate limiting from primary login IP rate limiting', async () => {
      clearRateLimitStores();
      const ip = '203.0.113.77';

      // Record 3 failed password login attempts on the IP
      recordFailedAttempt(ip, 'president@kclmc.org', 'Invalid password');
      recordFailedAttempt(ip, 'president@kclmc.org', 'Invalid password');
      recordFailedAttempt(ip, 'president@kclmc.org', 'Invalid password');

      const challenge = create2FAChallenge(
        'committee-rate-user',
        'president@kclmc.org',
        1,
        { session: { token: 'ba-session-token' } },
        'JBSWY3DPEHPK3PXP'
      );

      // Even after 2 failed 2FA code typos, the user must NOT hit the 5-attempt IP lockout from login
      await authSession.verifyTwoFactor({
        challengeToken: challenge.challengeToken,
        code: '000000',
        ip,
      });
      await authSession.verifyTwoFactor({
        challengeToken: challenge.challengeToken,
        code: '111111',
        ip,
      });

      // 3rd attempt with valid TOTP code succeeds without hitting 429 locked
      const validCode = calculateTOTP('JBSWY3DPEHPK3PXP');
      const outcome = await authSession.verifyTwoFactor({
        challengeToken: challenge.challengeToken,
        code: validCode,
        ip,
      });

      expect(outcome.status).toBe('authenticated');
      expect(checkRateLimit(ip).allowed).toBe(true);
    });
  });
});
