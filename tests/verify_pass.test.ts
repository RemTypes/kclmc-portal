import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/verify/[membershipId]/route';

// Mock Supabase server module to test both Supabase-enabled and fallback modes
vi.mock('@/lib/supabase/server', () => {
  return {
    isSupabaseConfigured: vi.fn(),
    createClient: vi.fn(),
  };
});

import { isSupabaseConfigured, createClient } from '@/lib/supabase/server';

describe('Pass Verification Route Handler (app/api/verify/[membershipId]/route.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      expect(data.member.name).toBe('David Baltensperger');
      expect(data.member.tier).toBe('social');
      expect(data.member.membership_number).toBe('K26122068');
      expect(data.member.student_id).toBe('K26122068');
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
      expect(data.member.student_id).toBe('K26122068');
    });

    it('verifies a recreational member correctly', async () => {
      const request = new Request('http://localhost:3000/api/verify/K25004642');
      const response = await GET(request, {
        params: Promise.resolve({ membershipId: 'K25004642' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.member.name).toBe('Arthur Dean');
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
  });
});
