import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber } from '@/lib/roster';
import { isD1Available, queryOneD1 } from '@/lib/db/d1';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;

  if (!membershipId || typeof membershipId !== 'string') {
    return NextResponse.json({ valid: false, error: 'Missing membership ID' }, { status: 400 });
  }

  let cleanId = '';
  try {
    cleanId = decodeURIComponent(membershipId).trim().toUpperCase();
  } catch {
    return NextResponse.json({ valid: false, error: 'Malformed membership ID parameter' }, { status: 400 });
  }

  // Validate format and length to prevent SQLi / buffer overflows
  if (cleanId.length === 0 || cleanId.length > 64) {
    return NextResponse.json({ valid: false, error: 'Invalid membership ID length' }, { status: 400 });
  }

  // Reject malicious input containing control characters, null bytes, or SQL/script syntax
  if (/[\0\r\n\t'"`;\\<>]/.test(cleanId)) {
    return NextResponse.json({ valid: false, error: 'Invalid membership ID characters' }, { status: 400 });
  }

  // 1. If Cloudflare D1 is available (preview or edge runtime), check D1 first
  if (await isD1Available()) {
    try {
      const rosterData = await queryOneD1<any>(
        'SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ? LIMIT 1',
        [cleanId]
      );
      if (rosterData) {
        return NextResponse.json({
          valid: true,
          member: {
            name: rosterData.full_name,
            tier: rosterData.tier,
            membership_number: rosterData.card_number,
            student_id: rosterData.card_number,
            expires: '2027-08-31',
            transaction_id: rosterData.transaction_id,
            product_name: rosterData.product_name,
            source: 'Cloudflare D1 Database',
            userId: rosterData.user_id,
          },
        });
      }
    } catch (err) {
      console.warn('D1 verification query error:', err);
    }
  }

  // 2. If Supabase is configured, check live database
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

      // Check official kclsu_roster table
      const { data: rosterData } = await supabase
        .from('kclsu_roster')
        .select('*')
        .eq('card_number', cleanId)
        .maybeSingle();

      if (rosterData) {
        return NextResponse.json({
          valid: true,
          member: {
            name: rosterData.full_name,
            tier: rosterData.tier,
            membership_number: rosterData.card_number,
            student_id: rosterData.card_number,
            expires: '2027-08-31',
            transaction_id: rosterData.transaction_id,
            product_name: rosterData.product_name,
            source: 'Supabase KCLSU Database',
            userId: rosterData.user_id,
          },
        });
      }

      // Check legacy/registered memberships table
      let query = supabase
        .from('memberships')
        .select(`
          id,
          membership_number,
          tier,
          valid_from,
          valid_until,
          is_active,
          payment_reference,
          profiles (
            full_name,
            student_id
          )
        `);

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
      if (isUuid) {
        query = query.eq('id', cleanId);
      } else {
        query = query.eq('membership_number', cleanId);
      }

      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const profileData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
        return NextResponse.json({
          valid: data.is_active,
          member: {
            name: profileData?.full_name || 'KCL Climber',
            tier: data.tier,
            membership_number: data.membership_number,
            expires: data.valid_until,
            student_id: profileData?.student_id || null,
            transaction_id: data.payment_reference || null,
            source: 'Database',
          },
        });
      }
    } catch (err: any) {
      console.error('Error verifying membership:', err);
    }
  }

  // 3. Local fallback check if offline or not yet synced to Supabase
  const fallbackRecord = findMemberByCardNumber(cleanId);
  if (fallbackRecord) {
    return NextResponse.json({
      valid: true,
      member: {
        name: fallbackRecord.name,
        tier: fallbackRecord.tier,
        membership_number: fallbackRecord.cardNumber,
        student_id: fallbackRecord.cardNumber,
        expires: '2027-08-31',
        transaction_id: fallbackRecord.transactionId,
        product_name: fallbackRecord.productName,
        source: 'KCLSU Official Roster (Local)',
      },
    });
  }

  const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  return NextResponse.json({
    valid: false,
    error: `No official KCLMC membership found for ID ${safeDisplayId}`,
  }, { status: 404 });
}
