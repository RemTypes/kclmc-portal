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

  // 1. If Supabase is configured, check live database first
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

  return NextResponse.json({
    valid: false,
    error: `No official KCLMC membership found for ID ${cleanId}`,
  }, { status: 404 });
}
