import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/security/cookies';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: Request) {
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
