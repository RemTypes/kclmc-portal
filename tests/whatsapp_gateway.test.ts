import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/whatsapp/join/route';

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

import { isSupabaseConfigured, createClient, createAdminClient } from '@/lib/supabase/server';

describe('Protected WhatsApp Gateway (/api/whatsapp/join)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_COMMUNITY_INVITE_URL = 'https://chat.whatsapp.com/SECRET-COMMUNITY-TOKEN';
  });

  it('redirects unauthenticated users to login with 307 without revealing WhatsApp URL', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('No session') }),
      },
    } as any);

    const req = new Request('https://kclmc.org/api/whatsapp/join');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('https://kclmc.org/login?next=/membership');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('blocks users with incomplete safety profile from accessing WhatsApp link', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-incomplete', email: 'student@kcl.ac.uk' },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'user-incomplete',
                student_id: 'K23000000',
                phone: null, // missing phone!
                emergency_contact_phone: null,
              },
            }),
          }),
        }),
      }),
    } as any);

    const req = new Request('https://kclmc.org/api/whatsapp/join');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('https://kclmc.org/membership?error=safety_required');
    expect(location).not.toContain('chat.whatsapp.com');
  });

  it('redirects verified members to secret WhatsApp community URL with anti-cache headers', async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'user-verified', email: 'alice@kcl.ac.uk' },
          },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'user-verified',
                student_id: 'K23158797',
                phone: '+44 7123 456789',
                emergency_contact_name: 'Sarah Richardson',
                emergency_contact_phone: '+44 7987 654321',
              },
            }),
          }),
        }),
      }),
    } as any);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { card_number: 'K23158797', full_name: 'Alice Richardson' },
            }),
          }),
        }),
      }),
    } as any);

    const req = new Request('https://kclmc.org/api/whatsapp/join');
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('https://chat.whatsapp.com/SECRET-COMMUNITY-TOKEN');
    expect(res.headers.get('cache-control')).toContain('no-store');
    expect(res.headers.get('cache-control')).toContain('no-cache');
  });
});
