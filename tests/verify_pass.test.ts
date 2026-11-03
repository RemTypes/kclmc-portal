import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/verify/[membershipId]/route';
import { clearRateLimitStores, recordFailedAttempt, verifyCaptchaToken } from '@/lib/security/rate-limiter';
import { GET as ordersGet, POST as ordersPost, PUT as ordersPut } from '@/app/api/orders/route';
import MlLayout from '@/app/admin/ml/layout';

// Mock Next.js navigation redirect
vi.mock('next/navigation', () => {
  return {
    redirect: vi.fn((url: string) => {
      const err = new Error(`NEXT_REDIRECT: ${url}`);
      (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
      throw err;
    }),
  };
});

// Mock Supabase server module to test both Supabase-enabled and fallback modes
vi.mock('@/lib/supabase/server', () => {
  return {
    isSupabaseConfigured: vi.fn(),
    createClient: vi.fn(),
    createAdminClient: vi.fn(),
  };
});

vi.mock('@/lib/auth/server', () => {
  return {
    getAuthenticatedUser: vi.fn(),
  };
});

import { isSupabaseConfigured, createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth/server';

describe('Pass Verification Route Handler (app/api/verify/[membershipId]/route.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStores();
    vi.mocked(getAuthenticatedUser).mockResolvedValue(null);
  });



  describe('Validation & Parameter Handling', () => {
    it('returns 400 if membershipId is empty or missing', async () => {
      const request = new Request('http://localhost:3000/api/verify/');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: '' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ valid: false, error: 'Missing membership ID' });
    });

    it('returns 404 for an unknown membership ID', async () => {
      // Mock Supabase as unconfigured to test fallback behavior directly
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/verify/K99999999');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K99999999' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.error).toContain('No official KCLMC membership found for ID K99999999');
    });
  });

  describe('Local Roster Fallback (findMemberByCardNumber)', () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    });

    it('successfully verifies an existing member from the initial roster', async () => {
      const request = new Request('http://localhost:3000/api/verify/K26122068');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K26122068' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member).toBeDefined();
      expect(data.member.name).toBe('Alex Honnold');
      expect(data.member.tier).toBe('social');
      expect(data.member.membership_number).toBe('K26122068');
      expect(data.member.student_id).toBe('***068');
      expect(data.member.transaction_id).toBeUndefined();
      expect(data.member.kclsu_transaction_id).toBeUndefined();
      expect(data.member.source).toBe('KCLSU Official Roster (Local)');
    });

    it('handles lowercase IDs and URL-encoded whitespace gracefully', async () => {
      const request = new Request('http://localhost:3000/api/verify/%20k26122068%20');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: '%20k26122068%20' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.student_id).toBe('***068');
    });

    it('verifies a recreational member correctly', async () => {
      const request = new Request('http://localhost:3000/api/verify/K25004642');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K25004642' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.name).toBe('Shauna Coxsey');
      expect(data.member.tier).toBe('recreational');
    });
  });

  describe('Supabase Database Verification Flow', () => {
    it('returns member data from Supabase kclsu_roster table when present', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'kclsu_roster') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  card_number: 'K24009999',
                  full_name: 'Alex Honnold',
                  tier: 'recreational',
                  transaction_id: '99999999',
                  product_name: '[10002480] Recreational Membership',
                  user_id: 'mock-user-uuid-1234',
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new Request('http://localhost:3000/api/verify/K24009999');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K24009999' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.name).toBe('Alex Honnold');
      expect(data.member.tier).toBe('recreational');
      expect(data.member.source).toBe('Supabase KCLSU Database');
      expect(data.member.userId).toBe('mock-user-uuid-1234');
    });

    it('returns validity flag from legacy memberships table when active is true', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'kclsu_roster') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'c1234567-1234-1234-1234-123456789abc',
                  membership_number: 'KCLMC-REC-101',
                  tier: 'recreational',
                  valid_from: '2026-09-01',
                  valid_until: '2027-08-31',
                  is_active: true,
                  payment_reference: 'STRIPE_TX_123',
                  profiles: {
                    full_name: 'Tommy Caldwell',
                    student_id: 'K21001234',
                  },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new Request('http://localhost:3000/api/verify/KCLMC-REC-101');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'KCLMC-REC-101' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.name).toBe('Tommy Caldwell');
      expect(data.member.source).toBe('Database');
    });

    it('correctly marks inactive pass as valid: false from legacy memberships table', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);

      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'kclsu_roster') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (table === 'memberships') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'c1234567-1234-1234-1234-123456789abc',
                  membership_number: 'EXPIRED-PASS-99',
                  tier: 'social',
                  valid_from: '2025-09-01',
                  valid_until: '2026-08-31',
                  is_active: false,
                  payment_reference: null,
                  profiles: {
                    full_name: 'Expired Climber',
                    student_id: 'K20000000',
                  },
                },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

      const request = new Request('http://localhost:3000/api/verify/EXPIRED-PASS-99');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'EXPIRED-PASS-99' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(false);
      expect(data.member.name).toBe('Expired Climber');
    });

    it('returns unmasked student ID and transaction ID when caller is authenticated committee member', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-committee',
        email: 'officer@kclmc.co.uk',
        role: 1,
      });

      const request = new Request('http://localhost:3000/api/verify/K26122068');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K26122068' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.student_id).toBe('K26122068');
      expect(data.member.transaction_id).toBeDefined();
    });

    it('enforces IP rate limiting on verify endpoint after exceeding attempt limits', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      const blockedIp = '203.0.113.199';
      for (let i = 0; i < 5; i++) {
        recordFailedAttempt(blockedIp, undefined, 'Simulated rate limit lockout');
      }

      const req = new Request('http://localhost:3000/api/verify/K26122068', {
        headers: { 'cf-connecting-ip': blockedIp },
      });
      const blockedRes = await GET(req, { params: Promise.resolve({ membershipId: 'K26122068' }) });
      expect(blockedRes.status).toBe(429);
      const blockedData = await blockedRes.json();
      expect(blockedData.valid).toBe(false);
      expect(blockedData.error).toContain('Too many requests');
    });
  });
});

describe('Milestone M2 Security Remediation Comprehensive Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStores();
  });

  describe('SEC-02: /admin/ml Layout RBAC Defense-in-Depth', () => {
    it('redirects unauthenticated users to /login', async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      await expect(MlLayout({ children: 'Secret ML Telemetry' })).rejects.toThrow('NEXT_REDIRECT: /login');
    });

    it('redirects committee members (role 1) with insufficient clearance to /admin?error=insufficient_clearance', async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-committee',
        email: 'officer@kclmc.co.uk',
        role: 1,
      });

      await expect(MlLayout({ children: 'Secret ML Telemetry' })).rejects.toThrow('NEXT_REDIRECT: /admin?error=insufficient_clearance');
    });

    it('allows SuperAdmins (role 2) to render ML layout', async () => {
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-superadmin',
        email: 'superadmin@kclmc.co.uk',
        role: 2,
      });

      const element = await MlLayout({ children: 'Telemetry Data' });
      expect(element).toBeDefined();
    });
  });

  describe('SEC-05 & SEC-06: /api/orders Route RBAC & State Machine', () => {
    it('blocks unauthenticated public callers from listing orders in fallback mode', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized: Committee access required');
    });

    it('blocks regular climbers from listing orders in fallback mode', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-climber',
        email: 'climber@kcl.ac.uk',
        role: 0,
      });

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(403);
    });

    it('allows committee members to list orders in fallback mode', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-committee',
        email: 'committee@kcl.ac.uk',
        role: 1,
      });

      const request = new Request('http://localhost:3000/api/orders');
      const response = await ordersGet(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('rejects POST /api/orders with 403 when brand is LUBE and dropsLube module is disabled', async () => {
      const request = new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'LUBE',
          customerName: 'Climber',
          customerEmail: 'climber@kcl.ac.uk',
          total: 25,
        }),
      });

      const response = await ordersPost(request);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('disabled');
    });

    it('accepts POST /api/orders when brand is KCL and module is enabled', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      const request = new Request('http://localhost:3000/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: 'KCL',
          customerName: 'Climber',
          customerEmail: 'climber@kcl.ac.uk',
          total: 20,
        }),
      });

      const response = await ordersPost(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.orderCode).toBeDefined();
    });

    it('accepts collected and refunded statuses on PUT /api/orders for committee callers', async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      vi.mocked(getAuthenticatedUser).mockResolvedValue({
        id: 'usr-committee',
        email: 'officer@kcl.ac.uk',
        role: 1,
      });

      // Test uppercase COLLECTED (from /admin/scan)
      const resCollected = await ordersPut(new Request('http://localhost:3000/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'KCL-1234', status: 'COLLECTED' }),
      }));
      expect(resCollected.status).toBe(200);
      expect((await resCollected.json()).success).toBe(true);

      // Test refunded status
      const resRefunded = await ordersPut(new Request('http://localhost:3000/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'KCL-1234', status: 'refunded' }),
      }));
      expect(resRefunded.status).toBe(200);
      expect((await resRefunded.json()).success).toBe(true);
    });
  });

  describe('SEC-04: CAPTCHA Token Security Hardening', () => {
    it('strictly restricts bypass_test_token to test environment', () => {
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        expect(verifyCaptchaToken('bypass_test_token')).toBe(false);

        (process.env as any).NODE_ENV = 'test';
        expect(verifyCaptchaToken('bypass_test_token')).toBe(true);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
      }
    });

    it('rejects arbitrary 20-character tokens in production when TURNSTILE_SECRET_KEY is unset', () => {
      const origEnv = process.env.NODE_ENV;
      const origKey = process.env.TURNSTILE_SECRET_KEY;
      try {
        (process.env as any).NODE_ENV = 'production';
        delete process.env.TURNSTILE_SECRET_KEY;

        expect(verifyCaptchaToken('random_string_20_chars_long')).toBe(false);

        // Turnstile and simulation prefixes are still allowed
        expect(verifyCaptchaToken('cf_turnstile_token_12345')).toBe(true);
        expect(verifyCaptchaToken('kclmc_captcha_verified_123')).toBe(true);

        // When TURNSTILE_SECRET_KEY is configured in production, 20+ char tokens are accepted
        process.env.TURNSTILE_SECRET_KEY = '0x4AAAAAAATestKey';
        expect(verifyCaptchaToken('random_string_20_chars_long')).toBe(true);
      } finally {
        (process.env as any).NODE_ENV = origEnv;
        if (origKey !== undefined) {
          process.env.TURNSTILE_SECRET_KEY = origKey;
        } else {
          delete process.env.TURNSTILE_SECRET_KEY;
        }
      }
    });
  });
});


