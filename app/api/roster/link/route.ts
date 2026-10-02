import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database is not configured' },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authenticate user from session
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
    const cleanId = rawStudentId.trim().toUpperCase();

    if (!cleanId || cleanId.length > 32 || !/^[A-Z0-9_-]{3,32}$/.test(cleanId)) {
      return NextResponse.json(
        { error: 'Please provide a valid KCL Student ID (e.g. K25008223).' },
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const safeDisplayId = cleanId.replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    const admin = createAdminClient();

    // 2. Check if this student ID is already linked to another user in profiles
    // Try user client first (or admin client)
    let existingProfile: any = null;
    const { data: profFromUser } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
      .eq('student_id', cleanId)
      .maybeSingle();

    if (profFromUser) {
      existingProfile = profFromUser;
    } else {
      const { data: profFromAdmin } = await admin
        .from('profiles')
        .select('id, full_name, student_id')
        .eq('student_id', cleanId)
        .maybeSingle();
      existingProfile = profFromAdmin;
    }

    if (existingProfile && existingProfile.id !== user.id) {
      return NextResponse.json(
        { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if this student ID is already linked to another user in kclsu_roster
    let existingRoster: any = null;
    const { data: rosterFromUser } = await supabase
      .from('kclsu_roster')
      .select('*')
      .eq('card_number', cleanId)
      .maybeSingle();

    if (rosterFromUser) {
      existingRoster = rosterFromUser;
    } else {
      const { data: rosterFromAdmin } = await admin
        .from('kclsu_roster')
        .select('*')
        .eq('card_number', cleanId)
        .maybeSingle();
      existingRoster = rosterFromAdmin;
    }

    if (existingRoster && existingRoster.user_id && existingRoster.user_id !== user.id) {
      return NextResponse.json(
        { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
        { status: 409, headers: { 'Content-Type': 'application/json' } }
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
        // Insert into live kclsu_roster (try authenticated client then admin)
        const insertPayload = {
          card_number: seeded.cardNumber,
          full_name: seeded.name,
          raw_purchaser: seeded.rawPurchaser,
          tier: seeded.tier,
          product_name: seeded.productName,
          transaction_id: seeded.transactionId,
          purchase_date: seeded.purchaseDate,
          academic_year: '2026/27',
          user_id: user.id,
        };
        const { error: insErr } = await supabase.from('kclsu_roster').insert(insertPayload);
        if (insErr) {
          await admin.from('kclsu_roster').insert(insertPayload);
        }
      }
    }

    if (!memberRecord) {
      return NextResponse.json(
        { error: `Student ID "${cleanId}" was not found in the official KCLSU purchase list. Please ensure you have purchased a 2026/27 membership on the KCLSU shop.` },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Bind in kclsu_roster using authenticated user client (satisfies RLS with check user_id = auth.uid())
    const { error: userRosterErr } = await supabase
      .from('kclsu_roster')
      .update({ user_id: user.id, updated_at: new Date().toISOString() })
      .eq('card_number', cleanId);

    if (userRosterErr) {
      // Fallback to admin client if service role key available
      await admin
        .from('kclsu_roster')
        .update({ user_id: user.id, updated_at: new Date().toISOString() })
        .eq('card_number', cleanId);
    }

    // 6. Bind in profiles using authenticated user client (satisfies RLS using id = auth.uid())
    const { error: userProfErr } = await supabase
      .from('profiles')
      .update({
        student_id: cleanId,
        full_name: memberRecord.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (userProfErr) {
      await admin
        .from('profiles')
        .update({
          student_id: cleanId,
          full_name: memberRecord.name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    return NextResponse.json(
      {
        success: true,
        member: memberRecord,
        message: `Successfully linked KCL Student ID ${cleanId} to your account.`,
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
