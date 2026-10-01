import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database is not configured' },
        { status: 503 }
      );
    }

    // 1. Authenticate user from session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please sign in to link your membership.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawStudentId = typeof body.studentId === 'string' ? body.studentId : '';
    const cleanId = rawStudentId.trim().toUpperCase();

    if (!cleanId || cleanId.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanId)) {
      return NextResponse.json(
        { error: 'Please provide a valid KCL Student ID (e.g. K25008223).' },
        { status: 400 }
      );
    }

    const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    const admin = createAdminClient();

    // 2. Check if this student ID is already linked to another user in profiles
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, full_name, student_id')
      .eq('student_id', cleanId)
      .maybeSingle();

    if (existingProfile && existingProfile.id !== user.id) {
      return NextResponse.json(
        { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
        { status: 409 }
      );
    }

    // 3. Check if this student ID is already linked to another user in kclsu_roster
    const { data: existingRoster } = await admin
      .from('kclsu_roster')
      .select('*')
      .eq('card_number', cleanId)
      .maybeSingle();

    if (existingRoster && existingRoster.user_id && existingRoster.user_id !== user.id) {
      return NextResponse.json(
        { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
        { status: 409 }
      );
    }

    // 4. Verify membership exists in official KCLSU records
    let memberRecord: KclsuMemberRecord | null = null;

    if (existingRoster) {
      memberRecord = {
        cardNumber: existingRoster.card_number,
        name: existingRoster.full_name,
        rawPurchaser: existingRoster.raw_purchaser || '',
        tier: existingRoster.tier,
        productName: existingRoster.product_name,
        transactionId: existingRoster.transaction_id,
        purchaseDate: existingRoster.purchase_date || '',
      };
    } else {
      // Check seeded roster
      const seeded = findMemberByCardNumber(cleanId);
      if (seeded) {
        memberRecord = seeded;
        // Insert into live kclsu_roster
        await admin.from('kclsu_roster').insert({
          card_number: seeded.cardNumber,
          full_name: seeded.name,
          raw_purchaser: seeded.rawPurchaser,
          tier: seeded.tier,
          product_name: seeded.productName,
          transaction_id: seeded.transactionId,
          purchase_date: seeded.purchaseDate,
          academic_year: '2026/27',
          user_id: user.id,
        });
      }
    }

    if (!memberRecord) {
      return NextResponse.json(
        { error: `Student ID "${cleanId}" was not found in the official KCLSU purchase list. Please ensure you have purchased a 2026/27 membership on the KCLSU shop.` },
        { status: 404 }
      );
    }

    // 5. Bind in kclsu_roster
    await admin
      .from('kclsu_roster')
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq('card_number', cleanId);

    // 6. Bind in profiles
    await admin
      .from('profiles')
      .update({
        student_id: cleanId,
        full_name: memberRecord.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      member: memberRecord,
      message: `Successfully linked KCL Student ID ${cleanId} to your account.`,
    });
  } catch (err: any) {
    console.error('Error linking student ID:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while linking student ID.' },
      { status: 500 }
    );
  }
}
