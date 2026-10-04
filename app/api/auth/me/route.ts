import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
    }

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
      // Non-fatal if profiles table query fails
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
  } catch (err: any) {
    console.error('API /api/auth/me error:', err);
    return NextResponse.json({ authenticated: false, user: null, error: err?.message }, { status: 200 });
  }
}
