import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as reset2FAGet, POST as reset2FAPost } from '@/app/api/admin/reset-2fa/route';
import * as serverAuth from '@/lib/auth/server';
import * as d1Module from '@/lib/db/d1';

describe('SuperAdmin 2FA Reset Hatch API (/api/admin/reset-2fa)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 403', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue(null);

    const res = await reset2FAGet();
    expect(res.status).toBe(403);
  });

  it('rejects Tier 1 committee officers (role = 1) with 403 (SuperAdmin clearance required)', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'officer-id',
      email: 'treasurer@kclmc.org',
      role: 1,
    });

    const res = await reset2FAGet();
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('SuperAdmin clearance required');
  });

  it('allows Tier 2 SuperAdmin (role = 2) on GET to view committee accounts', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'superadmin-id',
      email: 'admin@kclmc.org',
      role: 2,
    });

    const mockDb: any = {
      prepare: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({
          results: [{ id: 'user-1', email: 'officer@kclmc.org', role: 1, hasD1Secret: 1 }],
          success: true,
        }),
      }),
    };
    vi.spyOn(d1Module, 'getD1Database').mockResolvedValue(mockDb);

    const res = await reset2FAGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.users).toHaveLength(1);
    expect(data.users[0].email).toBe('officer@kclmc.org');
  });

  it('allows Tier 2 SuperAdmin on POST to reset 2FA credentials by targetEmail', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'superadmin-id',
      email: 'admin@kclmc.org',
      role: 2,
    });

    const mockDb: any = {
      prepare: vi.fn((query: string) => {
        if (query.includes('SELECT id FROM "user"')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ id: 'target-user-123' }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        };
      }),
    };
    vi.spyOn(d1Module, 'getD1Database').mockResolvedValue(mockDb);

    const req = new Request('http://localhost:3000/api/admin/reset-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: 'lost.device@kclmc.org' }),
    });

    const res = await reset2FAPost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('Successfully reset 2FA credentials');
  });
});
