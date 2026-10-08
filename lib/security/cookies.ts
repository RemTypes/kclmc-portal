import { NextResponse } from 'next/server';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

export function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bsvnyibipcwrcyzqilge.supabase.co';
  try {
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0] || 'bsvnyibipcwrcyzqilge';
  } catch {
    return 'bsvnyibipcwrcyzqilge';
  }
}

export function getAuthCookiePrefix(): string {
  return `sb-${getProjectRef()}-auth-token`;
}

/**
 * Apply Supabase session cookies ensuring strict httpOnly, Secure, and SameSite=Lax flags.
 */
export function applySessionCookies(
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options?: any }>
): void {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: options?.path || '/',
    });
  });

  // Signal flag for UI state (contains zero secrets or tokens)
  response.cookies.set('kclmc_session', 'active', {
    ...SESSION_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: SESSION_COOKIE_OPTIONS.maxAge,
  });
}

/**
 * Fallback to encode and attach session cookies directly.
 */
export function setSessionCookies(
  response: NextResponse,
  sessionOrCookies: any
): void {
  if (Array.isArray(sessionOrCookies)) {
    applySessionCookies(response, sessionOrCookies);
    return;
  }

  if (sessionOrCookies?.cookiesToSet && Array.isArray(sessionOrCookies.cookiesToSet) && sessionOrCookies.cookiesToSet.length > 0) {
    applySessionCookies(response, sessionOrCookies.cookiesToSet);
    return;
  }

  const sessionObj = sessionOrCookies?.session || sessionOrCookies;
  const prefix = getAuthCookiePrefix();
  if (sessionObj?.access_token && sessionObj?.refresh_token) {
    const payload = JSON.stringify([
      sessionObj.access_token,
      sessionObj.refresh_token,
      sessionObj.user?.id || null,
      sessionObj.expires_at || Math.floor(Date.now() / 1000) + 3600,
    ]);

    response.cookies.set(prefix, payload, SESSION_COOKIE_OPTIONS);
  }

  response.cookies.set('kclmc_session', 'active', {
    ...SESSION_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: SESSION_COOKIE_OPTIONS.maxAge,
  });
}

/**
 * Expire and clear all session cookies from an outgoing NextResponse.
 */
export function clearSessionCookies(
  response: NextResponse,
  requestCookies?: { name: string }[]
): void {
  const prefix = getAuthCookiePrefix();

  // Clear base cookie
  response.cookies.set(prefix, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });

  // Clear chunked cookies if present
  if (requestCookies) {
    requestCookies.forEach(({ name }) => {
      if (name.startsWith(prefix)) {
        response.cookies.set(name, '', {
          ...SESSION_COOKIE_OPTIONS,
          maxAge: 0,
        });
      }
    });
  }

  // Clear for up to 5 standard chunks
  for (let i = 0; i < 5; i++) {
    response.cookies.set(`${prefix}.${i}`, '', {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    });
  }

  response.cookies.set('kclmc_session', '', {
    ...SESSION_COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: 0,
  });
}

