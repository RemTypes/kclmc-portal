import { NextResponse } from 'next/server';
import { authSession } from '@/lib/auth/session';
import { getCloudflareEnv } from '@/lib/db/d1';

/**
 * POST /api/auth/login
 * Thin HTTP adapter delegating credential authentication to the deep AuthSession module.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const env = await getCloudflareEnv();
  const cfSecret = env?.BETTER_AUTH_SECRET || env?.SUPABASE_SERVICE_ROLE_KEY;
  const outcome = await authSession.authenticateCredentials(request, cfSecret);
  return authSession.toApiResponse(outcome, cfSecret);
}
