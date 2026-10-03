import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UNIVERSITIES, DEFAULT_UNIVERSITY, sanitizeUniversity } from '@/lib/auth';
import { POST } from '@/app/api/roster/link/route';
import { setTestD1Database } from '@/lib/db/d1';
import * as supabaseServer from '@/lib/supabase/server';

describe('University Selection & Profile Persistence', () => {
  beforeEach(() => {
    setTestD1Database(null);
    vi.restoreAllMocks();
  });

  describe('University Constants & Sanitizer', () => {
    it('provides comprehensive list of London and UK institutions', () => {
      expect(UNIVERSITIES).toContain("King's College London");
      expect(UNIVERSITIES).toContain("University College London (UCL)");
      expect(UNIVERSITIES).toContain("Imperial College London");
      expect(UNIVERSITIES).toContain("Queen Mary University of London (QMUL)");
      expect(UNIVERSITIES).toContain("London School of Economics (LSE)");
      expect(UNIVERSITIES).toContain("Brunel University London");
      expect(UNIVERSITIES).toContain("Other UK Institution");
      expect(UNIVERSITIES).toContain("Alumni / Associate / Guest");
    });

    it('defaults to King\'s College London', () => {
      expect(DEFAULT_UNIVERSITY).toBe("King's College London");
    });

    it('sanitizes university input correctly', () => {
      expect(sanitizeUniversity(null)).toBe("King's College London");
      expect(sanitizeUniversity(undefined)).toBe("King's College London");
      expect(sanitizeUniversity('')).toBe("King's College London");
      expect(sanitizeUniversity('   ')).toBe("King's College London");
      expect(sanitizeUniversity('  University of Oxford  ')).toBe('University of Oxford');
      expect(sanitizeUniversity('UCL')).toBe('UCL');
    });

    it('truncates excessively long institution names safely', () => {
      const longName = 'A'.repeat(200);
      const sanitized = sanitizeUniversity(longName);
      expect(sanitized.length).toBe(150);
    });
  });

  describe('D1 Roster Linking Profile Preservation', () => {
    it('uses university from user metadata when creating new D1 profile', async () => {
      const executedStatements: { sql: string; params: any[] }[] = [];

      const mockD1: any = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...params: any[]) => ({
            first: vi.fn(async () => {
              if (sql.includes('FROM profiles WHERE UPPER(student_id)')) return null;
              if (sql.includes('FROM kclsu_roster WHERE UPPER(card_number)')) return null;
              if (sql.includes('FROM profiles WHERE id = ?')) return null;
              return null;
            }),
            run: vi.fn(async () => {
              executedStatements.push({ sql, params });
              return { success: true, meta: { changes: 1 } };
            }),
            all: vi.fn(async () => ({ results: [], success: true })),
          })),
        })),
        batch: vi.fn(async () => []),
      };

      setTestD1Database(mockD1);

      vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'custom-uni-user-123',
                email: 'external@ucl.ac.uk',
                user_metadata: {
                  university: 'University College London (UCL)',
                  full_name: 'External Climber',
                },
              },
            },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })),
      } as any);

      const req = new Request('http://localhost:3000/api/roster/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: 'K23158797' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify that the INSERT INTO profiles statement in D1 received the UCL university value
      const profileInsert = executedStatements.find(s => s.sql.includes('INSERT INTO profiles'));
      expect(profileInsert).toBeDefined();
      expect(profileInsert?.params).toContain('University College London (UCL)');
    });
  });
});
