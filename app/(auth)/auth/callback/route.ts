import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/membership';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data?.user) {
        try {
          const user = data.user;
          const meta = user.user_metadata || {};
          if (meta.university || meta.full_name || meta.student_id) {
            await supabase.from('profiles').upsert(
              {
                id: user.id,
                full_name: meta.full_name || '',
                student_id: meta.student_id || null,
                university: meta.university || "King's College London",
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          }
        } catch (syncErr) {
          console.warn('Auth callback profile sync warning:', syncErr);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If the next destination was password update, pass a specific error query param
  const errorParam = next.includes('update-password') ? 'reset_link_expired' : 'auth_failed';
  return NextResponse.redirect(`${origin}/login?error=${errorParam}`);
}
