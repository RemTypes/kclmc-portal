import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { memberRoster } from '@/lib/roster/service';

/**
 * POST /api/roster/link
 * Links a student ID to an authenticated Climber account, validating against KCLSU purchases.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database is not configured' },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to link your membership.' },
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawStudentId = typeof body?.studentId === 'string' ? body.studentId : '';

    const outcome = await memberRoster.linkStudentId(user.id, rawStudentId);

    if (!outcome.success) {
      return NextResponse.json(
        { error: outcome.error },
        { status: outcome.statusCode, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        member: outcome.member,
        message: outcome.message,
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('Error linking student ID:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error while linking student ID.' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
