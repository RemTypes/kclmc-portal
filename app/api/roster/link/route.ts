import { NextResponse } from 'next/server';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { findMemberByCardNumber, KclsuMemberRecord } from '@/lib/roster';
import { isD1Available, queryOneD1, executeD1 } from '@/lib/db/d1';

export async function POST(request: Request) {
  try {
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

    // 2. Conflict checks against Cloudflare D1
    if (await isD1Available()) {
      try {
        const d1ProfileConflict = await queryOneD1<{ id: string }>(
          'SELECT id FROM profiles WHERE UPPER(student_id) = ? LIMIT 1',
          [cleanId]
        );
        if (d1ProfileConflict && d1ProfileConflict.id !== user.id) {
          return NextResponse.json(
            { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const d1RosterConflict = await queryOneD1<{ user_id: string | null }>(
          'SELECT user_id FROM kclsu_roster WHERE UPPER(card_number) = ? LIMIT 1',
          [cleanId]
        );
        if (d1RosterConflict && d1RosterConflict.user_id && d1RosterConflict.user_id !== user.id) {
          return NextResponse.json(
            { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (d1Err) {
        console.warn('D1 conflict check warning:', d1Err);
      }
    }

    // 3. Conflict checks against Supabase
    if (isSupabaseConfigured()) {
      try {
        const { data: sbProfileConflict } = await supabase
          .from('profiles')
          .select('id')
          .eq('student_id', cleanId)
          .maybeSingle();

        if (sbProfileConflict && sbProfileConflict.id !== user.id) {
          return NextResponse.json(
            { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const { data: sbRosterConflict } = await supabase
          .from('kclsu_roster')
          .select('user_id')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (sbRosterConflict && sbRosterConflict.user_id && sbRosterConflict.user_id !== user.id) {
          return NextResponse.json(
            { error: `Student ID "${safeDisplayId}" is already linked to another KCLMC account. If this is your student ID, please contact committee@kclmc.org.` },
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch (sbErr) {
        console.warn('Supabase conflict check warning:', sbErr);
      }
    }

    // 4. Resolve member record from D1, Supabase, or Seeded Roster
    let memberRecord: KclsuMemberRecord | null = null;
    let d1RosterExists = false;
    let sbRosterExists = false;

    if (await isD1Available()) {
      try {
        const d1Row = await queryOneD1<any>(
          'SELECT * FROM kclsu_roster WHERE UPPER(card_number) = ? LIMIT 1',
          [cleanId]
        );
        if (d1Row) {
          d1RosterExists = true;
          memberRecord = {
            cardNumber: d1Row.card_number,
            name: d1Row.full_name,
            rawPurchaser: d1Row.raw_purchaser || '',
            tier: d1Row.tier,
            productName: d1Row.product_name,
            transactionId: d1Row.transaction_id,
            purchaseDate: d1Row.purchase_date || '',
          };
        }
      } catch (d1FetchErr) {
        console.warn('D1 roster query warning:', d1FetchErr);
      }
    }

    if (!memberRecord && isSupabaseConfigured()) {
      try {
        const { data: sbRow } = await supabase
          .from('kclsu_roster')
          .select('*')
          .eq('card_number', cleanId)
          .maybeSingle();

        if (sbRow) {
          sbRosterExists = true;
          memberRecord = {
            cardNumber: sbRow.card_number,
            name: sbRow.full_name,
            rawPurchaser: sbRow.raw_purchaser || '',
            tier: sbRow.tier,
            productName: sbRow.product_name,
            transactionId: sbRow.transaction_id,
            purchaseDate: sbRow.purchase_date || '',
          };
        }
      } catch (sbFetchErr) {
        console.warn('Supabase roster query warning:', sbFetchErr);
      }
    }

    if (!memberRecord) {
      const seeded = findMemberByCardNumber(cleanId);
      if (seeded) {
        memberRecord = seeded;
      }
    }

    if (!memberRecord) {
      return NextResponse.json(
        { error: `Student ID "${cleanId}" was not found in the official KCLSU purchase list. Please ensure you have purchased a 2026/27 membership on the KCLSU shop.` },
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Bind in Cloudflare D1 (if available)
    if (await isD1Available()) {
      try {
        // Step A: Ensure profile exists FIRST to satisfy FK (kclsu_roster.user_id -> profiles.id)
        const userProf = await queryOneD1<{ id: string }>(
          'SELECT id FROM profiles WHERE id = ? LIMIT 1',
          [user.id]
        );
        if (userProf) {
          await executeD1(
            'UPDATE profiles SET student_id = ?, full_name = ?, updated_at = datetime("now") WHERE id = ?',
            [cleanId, memberRecord.name, user.id]
          );
        } else {
          await executeD1(
            'INSERT INTO profiles (id, full_name, student_id, university, role, created_at, updated_at) VALUES (?, ?, ?, "King\'s College London", 0, datetime("now"), datetime("now"))',
            [user.id, memberRecord.name, cleanId]
          );
        }

        // Step B: Bind user_id in kclsu_roster
        if (d1RosterExists) {
          await executeD1(
            'UPDATE kclsu_roster SET user_id = ?, updated_at = datetime("now") WHERE UPPER(card_number) = ?',
            [user.id, cleanId]
          );
        } else {
          await executeD1(
            `INSERT INTO kclsu_roster (
              id, card_number, full_name, raw_purchaser, tier, product_name,
              transaction_id, purchase_date, academic_year, user_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
              crypto.randomUUID(),
              memberRecord.cardNumber,
              memberRecord.name,
              memberRecord.rawPurchaser,
              memberRecord.tier,
              memberRecord.productName,
              memberRecord.transactionId,
              memberRecord.purchaseDate,
              '2026/27',
              user.id,
            ]
          );
        }
      } catch (d1BindErr) {
        console.error('D1 roster binding error:', d1BindErr);
      }
    }

    // 6. Bind in Supabase (if configured)
    if (isSupabaseConfigured()) {
      try {
        if (sbRosterExists) {
          await supabase
            .from('kclsu_roster')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('card_number', cleanId);
        } else {
          await supabase
            .from('kclsu_roster')
            .insert({
              card_number: memberRecord.cardNumber,
              full_name: memberRecord.name,
              raw_purchaser: memberRecord.rawPurchaser,
              tier: memberRecord.tier,
              product_name: memberRecord.productName,
              transaction_id: memberRecord.transactionId,
              purchase_date: memberRecord.purchaseDate,
              academic_year: '2026/27',
              user_id: user.id,
            });
        }

        await supabase
          .from('profiles')
          .update({
            student_id: cleanId,
            full_name: memberRecord.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      } catch (sbBindErr) {
        console.warn('Supabase roster binding warning:', sbBindErr);
      }
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
    console.error('Error in /api/roster/link:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error while linking student ID.' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
