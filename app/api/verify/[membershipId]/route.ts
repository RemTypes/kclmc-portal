import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber } from '@/lib/roster';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;

  if (!membershipId) {
    return NextResponse.json({ valid: false, error: 'Missing membership ID' }, { status: 400 });
  }

  const cleanId = decodeURIComponent(membershipId).trim().toUpperCase();

  // 1. First check the official KCLSU member roster by card_number (e.g. K25008223)
  const rosterRecord = findMemberByCardNumber(cleanId);
  if (rosterRecord) {
    return NextResponse.json({
      valid: true,
      member: {
        name: rosterRecord.name,
        tier: rosterRecord.tier,
        membership_number: rosterRecord.cardNumber,
        student_id: rosterRecord.cardNumber,
        expires: '2027-08-31',
        transaction_id: rosterRecord.transactionId,
        product_name: rosterRecord.productName,
        source: 'KCLSU Official Record',
      },
    });
  }

  // 2. If Supabase is configured, check live database
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();

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

  return NextResponse.json({
    valid: false,
    error: `No official KCLMC membership found for ID ${cleanId}`,
  }, { status: 404 });
}
