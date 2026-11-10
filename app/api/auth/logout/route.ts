import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/security/cookies';
import { createServerClient } from '@supabase/ssr';
import { getCloudflareEnv, getD1Database } from '@/lib/db/d1';
import { createBetterAuth } from '@/lib/auth/better-auth';

export async function POST(request: Request) {
  // 1. Revoke Better Auth session in D1
  try {
    const env = await getCloudflareEnv();
    const db = (await getD1Database()) || env?.DB;
    if (db) {
      const origin = new URL(request.url).origin;
      const auth = createBetterAuth({ ...env, DB: db, BETTER_AUTH_URL: origin });
      await auth.api.signOut({ headers: request.headers });
    }
  } catch (baErr) {
    // Ignore if Better Auth session already expired or unconfigured
  }

  // 2. Revoke Supabase session
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';

  const cookieHeader = request.headers.get('cookie') || '';
  const parsedCookies = cookieHeader.split(';').map(c => {
    const [name, ...rest] = c.trim().split('=');
    return { name, value: rest.join('=') };
  });

  const serverSupabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return parsedCookies; },
      setAll() {},
    },
  });

  try {
    await serverSupabase.auth.signOut();
  } catch (e) {
    // Ignore signout error if session already expired
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  clearSessionCookies(response, parsedCookies);
  return response;
}
