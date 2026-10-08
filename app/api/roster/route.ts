import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { getAuthenticatedUserRole } from '@/lib/auth';
import { memberRoster } from '@/lib/roster/service';

/**
 * GET /api/roster
 * Fetches the entire KCLSU membership roster joined with safety contacts (Role >= 1).
 */
export async function GET() {
  try {
    if (isSupabaseConfigured()) {
      const userClient = await createClient();
      const { data: { user } } = await userClient.auth.getUser();
      const role = await getAuthenticatedUserRole(userClient, user);

      if (role < 1) {
        return NextResponse.json(
          { error: 'Unauthorized: Committee access required to view membership roster' },
          { status: 403 }
        );
      }
    }

    const data = await memberRoster.listRoster();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch roster' }, { status: 500 });
  }
}

/**
 * POST /api/roster
 * Ingests and synchronizes KCLSU roster sales records (Role >= 1).
 */
export async function POST(request: Request) {
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const role = await getAuthenticatedUserRole(userClient, user);

    if (role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required to synchronize roster' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const input = body.csv || body.records || [];
    const outcome = await memberRoster.syncRoster(input);

    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      source: outcome.source,
      message: `Successfully synchronized ${outcome.totalSynced} members to database.`,
      totalSynced: outcome.totalSynced,
      records: outcome.records,
    });
  } catch (err: any) {
    console.error('Roster sync error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync roster' }, { status: 500 });
  }
}
