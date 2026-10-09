import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { memberRoster } from '@/lib/roster/service';

/**
 * GET /api/membership
 * Resolves current Climber profile, linked student ID, pass tier, and safety compliance.
 */
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

    const result = await memberRoster.resolveMemberPass(user);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /api/membership GET error:', err);
    return NextResponse.json({ authenticated: false, user: null, error: err?.message }, { status: 500 });
  }
}

/**
 * POST /api/membership
 * Updates climber safety profile notes (phone, emergency contact).
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await memberRoster.updateSafetyNotes(user.id, body);

    return NextResponse.json({
      success: true,
      profile: result.profile,
      safetyCheck: result.safetyCheck,
      message: 'Safety notes and profile updated successfully.',
    });
  } catch (err: any) {
    console.error('API /api/membership POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update profile' }, { status: 500 });
  }
}
