import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeLinkUrl, DEFAULT_PORTAL_LINKS, resolveLinkId, isValidUuid } from '@/lib/links';
import { GET, POST, PATCH, DELETE } from '@/app/api/links/route';
import * as supabaseServer from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

describe('Portal Links Domain & Security Utilities', () => {
  it('sanitizes valid HTTPS URLs correctly', () => {
    expect(sanitizeLinkUrl('https://kclmc.org/membership')).toBe('https://kclmc.org/membership');
    expect(sanitizeLinkUrl('https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/')).toBe(
      'https://www.kclsu.org/groups/sports/join/mountaineerclimbsoc/'
    );
  });

  it('sanitizes relative internal portal routes', () => {
    expect(sanitizeLinkUrl('/membership')).toBe('/membership');
    expect(sanitizeLinkUrl('/safety')).toBe('/safety');
    expect(sanitizeLinkUrl('/trips')).toBe('/trips');
  });

  it('normalizes bare domain names to https://', () => {
    expect(sanitizeLinkUrl('instagram.com/kclmc')).toBe('https://instagram.com/kclmc');
  });

  it('blocks dangerous javascript: and data: URIs and falls back to #', () => {
    expect(sanitizeLinkUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeLinkUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(sanitizeLinkUrl('vbscript:msgbox(1)')).toBe('#');
  });

  it('handles empty or malformed URLs cleanly', () => {
    expect(sanitizeLinkUrl('')).toBe('#');
    expect(sanitizeLinkUrl('not-a-valid-url-format')).toBe('#');
  });

  it('contains expected default links in DEFAULT_PORTAL_LINKS with valid UUIDs', () => {
    expect(DEFAULT_PORTAL_LINKS.length).toBeGreaterThanOrEqual(4);
    const titles = DEFAULT_PORTAL_LINKS.map(l => l.title);
    expect(titles).toContain('Buy 2026/27 Membership');
    expect(titles).toContain('Activate Digital Climbing Pass');
    expect(titles).toContain('Official Club Website & Hub');

    for (const link of DEFAULT_PORTAL_LINKS) {
      expect(link.is_active).toBe(true);
      expect(isValidUuid(link.id)).toBe(true);
      expect(sanitizeLinkUrl(link.url)).not.toBe('#');
    }
  });

  it('resolves legacy default link IDs to standard UUIDs', () => {
    expect(resolveLinkId('link-kclsu-shop')).toBe('00000000-0000-4000-8000-000000000001');
    expect(resolveLinkId('link-membership-pass')).toBe('00000000-0000-4000-8000-000000000002');
    expect(resolveLinkId('link-club-hub')).toBe('00000000-0000-4000-8000-000000000003');
    expect(resolveLinkId('00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(resolveLinkId('custom-random-id')).toBe('custom-random-id');
  });
});

describe('Portal Links API Route (/api/links)', () => {
  let mockStore: any[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    mockStore = [
      {
        id: 'test-1',
        title: 'Test Link 1',
        url: 'https://kclmc.org/test',
        subtitle: 'Test description',
        icon: '🧗',
        sort_order: 1,
        is_active: true,
        is_highlighted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'test-2',
        title: 'Inactive Link',
        url: 'https://kclmc.org/inactive',
        subtitle: 'Hidden link',
        icon: '🔒',
        sort_order: 2,
        is_active: false,
        is_highlighted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  });

  const setupMockSupabase = (role: number | null) => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: role !== null ? { id: 'test-user-id', email: 'committee@kcl.ac.uk' } : null,
          },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { role }, error: null }),
              }),
            }),
          };
        }
        return {
          select: (cols: string, opts?: any) => {
            if (opts?.head) {
              return Promise.resolve({ count: mockStore.length, error: null });
            }
            return {
              order: (col: string, { ascending }: { ascending: boolean }) => ({
                eq: (eqCol: string, eqVal: any) => {
                  const filtered = mockStore.filter(item => item[eqCol] === eqVal);
                  return Promise.resolve({ data: filtered, error: null });
                },
              }),
              eq: (eqCol: string, eqVal: any) => ({
                maybeSingle: () => {
                  const item = mockStore.find(i => i[eqCol] === eqVal);
                  return Promise.resolve({ data: item || null, error: null });
                },
              }),
            };
          },
          insert: (newRows: any) => {
            const rows = Array.isArray(newRows) ? newRows : [newRows];
            const createdRows = rows.map(r => ({
              ...r,
              id: r.id || `new-${Date.now()}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            mockStore.push(...createdRows);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: createdRows[0], error: null }),
                then: (fn: any) => Promise.resolve({ data: createdRows, error: null }).then(fn),
              }),
            };
          },
          update: (updates: any) => ({
            eq: (col: string, val: any) => ({
              select: () => ({
                single: () => {
                  const target = mockStore.find(item => item[col] === val);
                  if (target) Object.assign(target, updates);
                  return Promise.resolve({ data: target, error: null });
                },
              }),
            }),
          }),
          delete: () => ({
            eq: (col: string, val: any) => {
              mockStore = mockStore.filter(item => item[col] !== val);
              return Promise.resolve({ error: null });
            },
          }),
        };
      },
    };

    vi.spyOn(supabaseServer, 'createClient').mockResolvedValue(mockClient as any);
    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue(mockClient as any);
    vi.spyOn(supabaseServer, 'isSupabaseConfigured').mockReturnValue(true);
  };

  it('GET /api/links returns active links for public visitors', async () => {
    setupMockSupabase(null);
    const req = new NextRequest('http://localhost:3000/api/links');
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.links).toBeDefined();
    expect(Array.isArray(data.links)).toBe(true);
    const inactive = data.links.find((l: any) => l.is_active === false);
    expect(inactive).toBeUndefined();
  });

  it('POST /api/links blocks unauthenticated requests with 401', async () => {
    setupMockSupabase(null);
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Link',
        url: 'https://kclmc.org',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/links blocks non-committee authenticated members with 403', async () => {
    setupMockSupabase(0); // Regular member
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Link',
        url: 'https://kclmc.org',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('POST /api/links allows committee member (role 1) to create a link via admin client', async () => {
    setupMockSupabase(1); // Committee
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Freshers Fair Discord',
        url: 'https://discord.gg/kclmc',
        subtitle: 'Meet other climbers',
        icon: '💬',
        is_highlighted: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.link.title).toBe('Freshers Fair Discord');
  });

  it('POST /api/links validates required title and url', async () => {
    setupMockSupabase(1);
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'POST',
      body: JSON.stringify({
        title: '',
        url: '',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('PATCH /api/links updates an existing link', async () => {
    setupMockSupabase(1);
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'test-1',
        title: 'Updated Link Title',
        is_highlighted: true,
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.link.title).toBe('Updated Link Title');
  });

  it('PATCH /api/links resolves legacy built-in string IDs and materializes update', async () => {
    setupMockSupabase(1);
    const req = new NextRequest('http://localhost:3000/api/links', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'link-kclsu-shop',
        is_highlighted: false,
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.link.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(data.link.is_highlighted).toBe(false);
  });

  it('DELETE /api/links deletes an existing link', async () => {
    setupMockSupabase(1);
    const req = new NextRequest('http://localhost:3000/api/links?id=test-1', {
      method: 'DELETE',
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockStore.find(item => item.id === 'test-1')).toBeUndefined();
  });

  it('DELETE /api/links handles legacy built-in link IDs gracefully', async () => {
    setupMockSupabase(1);
    const req = new NextRequest('http://localhost:3000/api/links?id=link-kclsu-shop', {
      method: 'DELETE',
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
