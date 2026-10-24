import { Role, getUserRole, getAuthenticatedUserRole } from '@/lib/auth';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  fullName?: string | null;
  studentId?: string | null;
  university?: string | null;
  user_metadata?: Record<string, any>;
}

/**
 * Universal server-side session resolver supporting both Better Auth (Cloudflare D1) and Supabase SSR.
 * Isolated in server.ts to prevent next/headers from leaking into client-side bundles.
 */
export async function getAuthenticatedUser(request?: Request): Promise<AuthenticatedUser | null> {
  // 1. Try Better Auth session via Cloudflare D1
  try {
    const { getCloudflareEnv, getD1Database } = await import('@/lib/db/d1');
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;

    if (db) {
      const { createBetterAuth } = await import('@/lib/auth/better-auth');
      const auth = createBetterAuth({ ...env, DB: db });

      let headersObj: Headers;
      if (request?.headers) {
        headersObj = request.headers;
      } else {
        headersObj = new Headers();
        try {
          const { cookies } = await import('next/headers');
          const c = await cookies();
          const cookieStr = c.getAll().map((x: any) => `${x.name}=${x.value}`).join('; ');
          if (cookieStr) headersObj.set('cookie', cookieStr);
        } catch {}
      }

      const session = await auth.api.getSession({ headers: headersObj });
      if (session?.user) {
        const u = session.user;
        let profile: any = null;
        try {
          profile = await db.prepare('SELECT * FROM profiles WHERE id = ?').bind(u.id).first();
        } catch {}

        const rawRole = (u as any).role ?? profile?.role ?? getUserRole(u.email);
        const role = (rawRole === 1 || rawRole === 2 ? rawRole : 0) as Role;

        return {
          id: u.id,
          email: u.email,
          role,
          fullName: u.name || profile?.full_name || null,
          studentId: profile?.student_id || null,
          university: profile?.university || "King's College London",
          user_metadata: {
            full_name: u.name || profile?.full_name || null,
            student_id: profile?.student_id || null,
            university: profile?.university || "King's College London",
          },
        };
      }
    }
  } catch (err) {
    console.warn('[getAuthenticatedUser] Better Auth check non-fatal error:', err);
  }

  // 2. Fallback to Supabase SSR session during migration window
  try {
    const { createClient, isSupabaseConfigured } = await import('@/lib/supabase/server');
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        let role: Role = 0;
        try {
          role = await getAuthenticatedUserRole(supabase, user);
        } catch {}

        return {
          id: user.id,
          email: user.email || '',
          role,
          fullName: user.user_metadata?.full_name || null,
          studentId: user.user_metadata?.student_id || null,
          university: user.user_metadata?.university || "King's College London",
          user_metadata: user.user_metadata || {},
        };
      }
    }
  } catch (err) {
    console.warn('[getAuthenticatedUser] Supabase check non-fatal error:', err);
  }

  return null;
}
