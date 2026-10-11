import { NextResponse } from 'next/server';
import { authSession } from '@/lib/auth/session';

/**
 * POST /api/auth/verify-2fa
 * Thin HTTP adapter delegating two-factor authentication verification to the deep AuthSession module.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const outcome = await authSession.verifyTwoFactor(request);
  return authSession.toApiResponse(outcome);
}
