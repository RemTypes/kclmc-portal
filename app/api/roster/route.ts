import { NextResponse } from 'next/server';
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { 
  INITIAL_KCLSU_ROSTER, 
  parseKclsuCsv, 
  upsertRosterToSupabase, 
  KclsuMemberRecord 
} from '@/lib/roster';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      const socialCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'social').length;
      const recCount = INITIAL_KCLSU_ROSTER.filter(m => m.tier === 'recreational').length;
      return NextResponse.json({
        source: 'local_fallback',
        total: INITIAL_KCLSU_ROSTER.length,
        socialCount,
        recreationalCount: recCount,
        members: INITIAL_KCLSU_ROSTER,
      });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('kclsu_roster')
      .select('*')
      .order('purchase_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const members = (data || []).map((row: any) => ({
      cardNumber: row.card_number,
      name: row.full_name,
      rawPurchaser: row.raw_purchaser,
      tier: row.tier,
      productName: row.product_name,
      transactionId: row.transaction_id,
      purchaseDate: row.purchase_date || '',
      userId: row.user_id,
    }));

    const socialCount = members.filter(m => m.tier === 'social').length;
    const recCount = members.filter(m => m.tier === 'recreational').length;

    return NextResponse.json({
      source: 'supabase',
      total: members.length,
      socialCount,
      recreationalCount: recCount,
      members,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch roster' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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
