import { NextResponse } from 'next/server';
import { authSession } from '@/lib/auth/session';

/**
 * POST /api/auth/login
 * Thin HTTP adapter delegating credential authentication to the deep AuthSession module.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const outcome = await authSession.authenticateCredentials(request);
  return authSession.toApiResponse(outcome);
}
