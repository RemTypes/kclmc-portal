import { NextResponse } from 'next/server';
import { authSession } from '@/lib/auth/session';
import { getCloudflareEnv } from '@/lib/db/d1';

/**
 * POST /api/auth/verify-2fa
 * Thin HTTP adapter delegating two-factor authentication verification to the deep AuthSession module.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const outcome = await authSession.verifyTwoFactor(request);
  const env = await getCloudflareEnv();
  const cfSecret = env?.BETTER_AUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY;
  return authSession.toApiResponse(outcome, cfSecret);
}
