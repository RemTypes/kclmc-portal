import { NextResponse } from 'next/server';
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { checkSafetyProfileCompleteness } from '@/lib/safety';
import { findMemberByCardNumber } from '@/lib/roster';

/**
 * Protected WhatsApp Community Gateway Route
 *
 * Prevents public invite link leakage by keeping the destination URL strictly on the server.
 * Only authenticated members who satisfy the following conditions are redirected to WhatsApp:
 * 1. Logged into an active account
 * 2. Student ID verified against official KCLSU purchase roster
 * 3. Mobile phone number & emergency contact registered (Safety Gate passed)
 *
 * If a link is copied and sent to an unpaid friend or non-member, they are blocked with
 * a 307 redirect to /login or /membership, ensuring the WhatsApp invite link is never disclosed.
 */
export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const hostUrl = `${requestUrl.protocol}//${requestUrl.host}`;

    if (!isSupabaseConfigured()) {
      // Local development fallback without database
      const fallbackUrl = process.env.WHATSAPP_COMMUNITY_INVITE_URL || 'https://chat.whatsapp.com/CPVH7dfM88QCGuFYyLcrDF?mode=gi_t';
      return NextResponse.redirect(fallbackUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // 1. Authentication Check
    if (authError || !user) {
      return NextResponse.redirect(`${hostUrl}/login?next=/membership`, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // 2. Profile & Safety Gate Check
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const safetyCheck = checkSafetyProfileCompleteness(profile);
    if (!safetyCheck.isComplete) {
      return NextResponse.redirect(`${hostUrl}/membership?error=safety_required`, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // 3. Student ID & KCLSU Roster Verification Check
    const activeStudentId = profile?.student_id || user.user_metadata?.student_id;
    if (!activeStudentId) {
      return NextResponse.redirect(`${hostUrl}/membership?error=unlinked_student_id`, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const cleanId = activeStudentId.trim().toUpperCase();
    const admin = createAdminClient();
    const { data: rosterRow } = await admin
      .from('kclsu_roster')
      .select('card_number')
      .eq('card_number', cleanId)
      .maybeSingle();

    const isVerified = Boolean(rosterRow) || Boolean(findMemberByCardNumber(cleanId));
    if (!isVerified) {
      return NextResponse.redirect(`${hostUrl}/membership?error=not_on_roster`, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    // 4. Success: Redirect to secret WhatsApp Community URL (kept strictly on server)
    const destinationUrl = process.env.WHATSAPP_COMMUNITY_INVITE_URL || 'https://chat.whatsapp.com/CPVH7dfM88QCGuFYyLcrDF?mode=gi_t';

    return NextResponse.redirect(destinationUrl, {
      status: 307,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    console.error('API /api/whatsapp/join error:', err);
    return NextResponse.json({ error: 'Failed to access WhatsApp gateway' }, { status: 500 });
  }
}
