import { NextResponse } from 'next/server';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { createBetterAuth } from '@/lib/auth/better-auth';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    // 1. Try resolving Better Auth session directly from D1 on edge (<10ms)
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;

    if (db) {
      try {
        const auth = createBetterAuth({ ...env, DB: db });
        const session = await auth.api.getSession({ headers: request.headers });

        if (session?.user) {
          const user = session.user;
          let profile: any = null;
          try {
            profile = await db
              .prepare('SELECT * FROM profiles WHERE id = ?')
              .bind(user.id)
              .first();
          } catch {
            // Non-fatal
          }

          return NextResponse.json({
            authenticated: true,
            user: {
              id: user.id,
              email: user.email,
              role: (user as any).role ?? profile?.role ?? 0,
              fullName: user.name || profile?.full_name || null,
              studentId: profile?.student_id || null,
              university: profile?.university || "King's College London",
            },
            profile,
          });
        }
      } catch (betterAuthErr) {
        console.warn('[api/auth/me] Better Auth session check non-fatal error:', betterAuthErr);
      }
    }

    // 2. Fallback to Supabase SSR session during migration window
    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!authError && user) {
        const role = await getAuthenticatedUserRole(supabase, user);
        let profile: any = null;
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          profile = profData;
        } catch {
          // Non-fatal
        }

        return NextResponse.json({
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            role,
            fullName: profile?.full_name || user.user_metadata?.full_name || null,
            studentId: profile?.student_id || user.user_metadata?.student_id || null,
            university: profile?.university || user.user_metadata?.university || null,
          },
          profile,
        });
      }
    }

    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  } catch (err: any) {
    console.error('API /api/auth/me error:', err);
    return NextResponse.json({ authenticated: false, user: null, error: err?.message }, { status: 200 });
  }
}
