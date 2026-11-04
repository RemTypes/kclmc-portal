import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as quantTreasuryGet } from '@/app/api/admin/quant/treasury/route';
import * as serverAuth from '@/lib/auth/server';
import { NextRequest } from 'next/server';

describe('Treasury Quant Risk API Route (/api/admin/quant/treasury)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests with 403', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/admin/quant/treasury');
    const res = await quantTreasuryGet(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Committee clearance required');
  });

  it('rejects standard users (role = 0) with 403', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'climber-id',
      email: 'student@kcl.ac.uk',
      role: 0,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/quant/treasury');
    const res = await quantTreasuryGet(req);
    expect(res.status).toBe(403);
  });

  it('allows committee officers (role = 1) to run simulation and view risk report', async () => {
    vi.spyOn(serverAuth, 'getAuthenticatedUser').mockResolvedValue({
      id: 'officer-id',
      email: 'treasurer@kclmc.org',
      role: 1,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/quant/treasury?bmcAmount=1500&gearAmount=2750&alpsGuideAmount=2500');
    const res = await quantTreasuryGet(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.treasurySummary.totalCash).toBe(13497.40);
    expect(data.simulation.nPaths).toBe(10000);
    expect(data.simulation.lVar95).toBeGreaterThan(0);
    expect(data.simulation.lCVar99).toBeGreaterThanOrEqual(data.simulation.lVar99);
    expect(data.grantOffsetApplied).toBe(1200.0);
  });
});
