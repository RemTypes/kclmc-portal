import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { 
  INITIAL_KCLSU_ROSTER, 
  parseKclsuCsv, 
  upsertRosterToSupabase, 
  KclsuMemberRecord 
} from '@/lib/roster';
import { getUserRole, getAuthenticatedUserRole } from '@/lib/auth';

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

      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('kclsu_roster')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, student_id, phone, emergency_contact_name, emergency_contact_phone, university');

      const profileByUserId = new Map<string, any>();
      const profileByStudentId = new Map<string, any>();
      (profilesData || []).forEach((p: any) => {
        if (p.id) profileByUserId.set(p.id, p);
        if (p.student_id) profileByStudentId.set(p.student_id.toUpperCase(), p);
      });

      const members = (data || []).map((row: any) => {
        const prof = (row.user_id ? profileByUserId.get(row.user_id) : null) || 
                     (row.card_number ? profileByStudentId.get(row.card_number.toUpperCase()) : null);

        const hasPhone = Boolean(prof?.phone && prof.phone.trim().length >= 8);
        const hasEmergency = Boolean(prof?.emergency_contact_phone && prof.emergency_contact_phone.trim().length >= 8);
        const safetyComplete = hasPhone && hasEmergency;

        return {
          cardNumber: row.card_number,
          name: row.full_name,
          rawPurchaser: row.raw_purchaser,
          tier: row.tier,
          productName: row.product_name,
          transactionId: row.transaction_id,
          purchaseDate: row.purchase_date || '',
          userId: row.user_id,
          phone: prof?.phone || null,
          emergencyContactName: prof?.emergency_contact_name || null,
          emergencyContactPhone: prof?.emergency_contact_phone || null,
          university: prof?.university || "King's College London",
          safetyComplete,
        };
      });

      const socialCount = members.filter(m => m.tier === 'social').length;
      const recCount = members.filter(m => m.tier === 'recreational').length;

      return NextResponse.json({
        source: 'supabase',
        total: members.length,
        socialCount,
        recreationalCount: recCount,
        members,
      });
    }

    // Local development fallback
    const socialCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'social').length;
    const recCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'recreational').length;
    return NextResponse.json({
      source: 'local_fallback',
      total: INITIAL_KCLSU_ROSTER.length,
      socialCount,
      recreationalCount: recCount,
      members: INITIAL_KCLSU_ROSTER,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch roster' }, { status: 500 });
  }
}

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

    const body = await request.json();
    let recordsToSync: KclsuMemberRecord[] = [];

    if (body.csv) {
      recordsToSync = parseKclsuCsv(body.csv);
    } else if (Array.isArray(body.records)) {
      recordsToSync = body.records;
    }

    if (!recordsToSync.length) {
      return NextResponse.json({ error: 'No valid KCLSU member records found in payload' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        success: true,
        source: 'local_preview',
        message: 'Supabase is not yet configured. Parsed records for local preview.',
        totalSynced: recordsToSync.length,
        records: recordsToSync,
      });
    }

    const supabase = createAdminClient();
    const { count, error } = await upsertRosterToSupabase(recordsToSync, supabase);

    if (error) {
      return NextResponse.json({ error: typeof error === 'string' ? error : error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: 'supabase',
      message: `Successfully synchronized ${count} members to database.`,
      totalSynced: count,
      records: recordsToSync,
    });
  } catch (err: any) {
    console.error('Roster sync error:', err);
    return NextResponse.json({ error: err.message || 'Failed to sync roster' }, { status: 500 });
  }
}
