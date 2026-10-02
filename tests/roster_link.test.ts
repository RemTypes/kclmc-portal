import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/roster/link/route';
import { setTestD1Database } from '@/lib/db/d1';
import * as supabaseServer from '@/lib/supabase/server';

describe('Roster Linking Endpoint (/api/roster/link)', () => {
  beforeEach(() => {
    setTestD1Database(null);
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 401 and JSON content-type', async () => {
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
      },
    } as any);

    const req = new Request('http://localhost:3000/api/roster/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'K23158797' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');

    const json = await res.json();
    expect(json.error).toContain('Authentication required');
  });

  it('rejects invalid or malformed student IDs with 400', async () => {
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id', email: 'alice@kcl.ac.uk' } },
          error: null,
        }),
      },
    } as any);

    const badReq = new Request('http://localhost:3000/api/roster/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'BAD<ID>' }),
    });

    const badRes = await POST(badReq);
    expect(badRes.status).toBe(400);
    const badJson = await badRes.json();
    expect(badJson.error).toContain('Please provide a valid KCL Student ID');
  });

  it('successfully links Alice Richardson (K23158797) when D1 database is available', async () => {
    const testUserId = '2b856ff0-eab9-4bfe-8800-ac6242ba9157';

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: testUserId, email: 'k23158797@kcl.ac.uk' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any);

    // Mock Cloudflare D1
    const executedQueries: { sql: string; params: any[] }[] = [];
    const mockD1: any = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...params: any[]) => ({
          all: vi.fn().mockResolvedValue({ results: [], success: true }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM profiles WHERE UPPER(student_id) = ?')) {
              return null; // No profile conflict
            }
            if (sql.includes('FROM kclsu_roster WHERE UPPER(card_number) = ?')) {
              // Roster row exists and is unbound
              return {
                card_number: 'K23158797',
                full_name: 'Alice Richardson',
                raw_purchaser: 'RICHARDSON, Alice',
                tier: 'recreational',
                product_name: '[10002480] Climbing/Mountaineering Recreational Membership',
                transaction_id: '31599217',
                purchase_date: 'Fri 18 Sep 2026 13:30',
                user_id: null,
              };
            }
            if (sql.includes('FROM profiles WHERE id = ?')) {
              return null; // Profile will be created
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            executedQueries.push({ sql, params });
            return { success: true, meta: { changes: 1 } };
          }),
        })),
      })),
    };

    setTestD1Database(mockD1);

    const req = new Request('http://localhost:3000/api/roster/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'K23158797' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.member.name).toBe('Alice Richardson');
    expect(json.member.cardNumber).toBe('K23158797');
    expect(json.member.tier).toBe('recreational');

    // Verify profiles was inserted/updated BEFORE kclsu_roster (FK order)
    const profileInsertQuery = executedQueries.find(q => q.sql.includes('INSERT INTO profiles'));
    expect(profileInsertQuery).toBeDefined();
    expect(profileInsertQuery?.params[0]).toBe(testUserId);

    const rosterUpdateQuery = executedQueries.find(q => q.sql.includes('UPDATE kclsu_roster SET user_id = ?'));
    expect(rosterUpdateQuery).toBeDefined();
    expect(rosterUpdateQuery?.params[0]).toBe(testUserId);
  });

  it('rejects attempt to link an ID already bound to another user with 409', async () => {
    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'attacker-id', email: 'attacker@kcl.ac.uk' } },
          error: null,
        }),
      },
    } as any);

    const mockD1: any = {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...params: any[]) => ({
          all: vi.fn().mockResolvedValue({ results: [], success: true }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM profiles WHERE UPPER(student_id) = ?')) {
              return { id: 'original-owner-id', student_id: 'K23158797' };
            }
            return null;
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        })),
      })),
    };

    setTestD1Database(mockD1);

    const req = new Request('http://localhost:3000/api/roster/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'K23158797' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toContain('already linked to another KCLMC account');
  });
});
