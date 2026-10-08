import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';
import { getAuthenticatedUserRole, sanitizeUniversity } from '@/lib/auth';
import { checkSafetyProfileCompleteness } from '@/lib/safety';
import type { Profile, Membership } from '@/types/database';

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

    const role = await getAuthenticatedUserRole(supabase, user);

    // 1. Fetch user profile
    let profile: Profile | null = null;
    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profData) {
      profile = profData as Profile;
      // Auto-heal missing student_id or university if present in user_metadata
      const metaStudentId = user.user_metadata?.student_id;
      const metaUni = user.user_metadata?.university;
      if (profile && ((!profile.student_id && metaStudentId) || (!profile.university && metaUni))) {
        try {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (!profile.student_id && metaStudentId) updates.student_id = metaStudentId;
          if (!profile.university && metaUni) updates.university = metaUni;
          await supabase.from('profiles').update(updates).eq('id', user.id);
          profile = { ...profile, ...updates } as Profile;
        } catch {
          // Non-fatal auto-heal
        }
      }
    } else {
      // Fallback: create basic profile row if missing
      try {
        const { data: createdProf } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Climber',
            student_id: user.user_metadata?.student_id || null,
            university: user.user_metadata?.university || "King's College London",
            role,
          })
          .select()
          .single();
        profile = createdProf || null;
      } catch {
        // Non-fatal
      }
    }

    // 2. Identify active student ID
    let activeStudentId: string | null = profile?.student_id || user.user_metadata?.student_id || null;

    if (!activeStudentId) {
      const { data: linkedRoster } = await supabase
        .from('kclsu_roster')
        .select('card_number')
        .eq('user_id', user.id)
        .maybeSingle();
      if (linkedRoster?.card_number) {
        activeStudentId = linkedRoster.card_number;
      }
    }

    let boundStudentId: string | null = null;
    let suRecord: KclsuMemberRecord | null = null;
    let membership: Membership | null = null;

    if (activeStudentId) {
      const cleanId = activeStudentId.trim().toUpperCase();
      boundStudentId = cleanId;

      // 3. Match against live database roster or seeded records
      const admin = createAdminClient();
      let rosterRow: any = null;

      const { data: rowFromUser } = await supabase
        .from('kclsu_roster')
        .select('*')
        .eq('card_number', cleanId)
        .maybeSingle();

      if (rowFromUser) {
        rosterRow = rowFromUser;
      } else {
        const { data: rowFromAdmin } = await admin
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();
        rosterRow = rowFromAdmin;
      }

      if (rosterRow) {
        suRecord = {
          cardNumber: rosterRow.card_number,
          name: rosterRow.full_name,
          rawPurchaser: rosterRow.raw_purchaser || '',
          tier: rosterRow.tier,
          productName: rosterRow.product_name,
          transactionId: rosterRow.transaction_id,
          purchaseDate: rosterRow.purchase_date || '',
        };
      } else {
        suRecord = findMemberByCardNumber(cleanId) || null;
      }

      if (suRecord) {
        membership = {
          id: suRecord.cardNumber,
          user_id: user.id,
          membership_number: suRecord.cardNumber,
          tier: suRecord.tier,
          valid_from: '2026-09-01',
          valid_until: '2027-08-31',
          payment_reference: suRecord.transactionId,
          is_active: true,
          created_at: new Date().toISOString(),
        };
      }
    }

    const safetyCheck = checkSafetyProfileCompleteness(profile);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role,
        fullName: profile?.full_name || user.user_metadata?.full_name,
      },
      profile,
      boundStudentId,
      suRecord,
      membership,
      safetyCheck,
    });
  } catch (err: any) {
    console.error('API /api/membership GET error:', err);
    return NextResponse.json({ authenticated: false, user: null, error: err?.message }, { status: 500 });
  }
}

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
    const {
      university,
      customUniversity,
      phone,
      emergencyName,
      emergencyPhone,
      dietary,
    } = body;

    const effectiveUniversity = sanitizeUniversity(
      university === 'Other UK Institution' ? customUniversity : university
    );

    const updatePayload: Record<string, any> = {
      university: effectiveUniversity,
      phone: typeof phone === 'string' ? phone.trim().slice(0, 30) : null,
      emergency_contact_name: typeof emergencyName === 'string' ? emergencyName.trim().slice(0, 100) : null,
      emergency_contact_phone: typeof emergencyPhone === 'string' ? emergencyPhone.trim().slice(0, 30) : null,
      dietary_requirements: typeof dietary === 'string' ? dietary.trim().slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    };

    // Update using authenticated client (satisfies RLS for own profile)
    let { data: updatedProfile, error: updateErr } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (updateErr) {
      // Fallback to admin client if RLS is strict
      const admin = createAdminClient();
      const { data: adminProf, error: adminErr } = await admin
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .maybeSingle();
      if (adminErr) {
        throw adminErr;
      }
      updatedProfile = adminProf;
    }

    const safetyCheck = checkSafetyProfileCompleteness(updatedProfile);

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      safetyCheck,
      message: 'Safety notes and profile updated successfully.',
    });
  } catch (err: any) {
    console.error('API /api/membership POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update profile' }, { status: 500 });
  }
}
