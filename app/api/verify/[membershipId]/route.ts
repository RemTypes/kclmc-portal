import { NextResponse } from 'next/server';
import { memberRoster } from '@/lib/roster/service';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { getAuthenticatedUser } from '@/lib/auth/server';

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

function maskStudentId(id?: string | null): string | null {
  if (!id) return null;
  const clean = id.trim();
  if (clean.length <= 3) return '***';
  return '***' + clean.slice(-3);
}

/**
 * GET /api/verify/[membershipId]
 * Verifies membership validity and pass details for wall scanners and trip leaders.
 * Applies IP rate limiting and redacts PII for unauthenticated public requests.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  // 1. IP-based anti-scraping rate limiting
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { valid: false, error: rateCheck.reason || 'Rate limit exceeded. Too many verification attempts.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSeconds || 60) },
      }
    );
  }

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

  // 2. Defense-in-depth: Committee clearance verification for full PII access
  const user = await getAuthenticatedUser(request);
  const isCommittee = Boolean(user && user.role >= 1);

  let member = result.member ? { ...result.member } : undefined;

  // Redact PII on public unauthenticated endpoints
  if (member && !isCommittee) {
    delete (member as any).transaction_id;
    delete (member as any).kclsu_transaction_id;
    if (member.student_id) {
      member.student_id = maskStudentId(member.student_id) as any;
    }
  }

  return NextResponse.json({
    valid: result.valid,
    member,
  });
}

