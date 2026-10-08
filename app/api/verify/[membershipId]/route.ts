import { NextResponse } from 'next/server';
import { memberRoster } from '@/lib/roster/service';

/**
 * GET /api/verify/[membershipId]
 * Verifies membership validity and pass details for wall scanners and trip leaders.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  const { membershipId } = await params;

  let cleanId = '';
  try {
    cleanId = decodeURIComponent(membershipId || '').trim();
  } catch {
    return NextResponse.json({ valid: false, error: 'Malformed membership ID parameter' }, { status: 400 });
  }

  const result = await memberRoster.verifyPass(cleanId);

  if (!result.valid && result.statusCode === 404) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 404 });
  }

  if (result.error && result.statusCode === 400) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    valid: result.valid,
    member: result.member,
  });
}
