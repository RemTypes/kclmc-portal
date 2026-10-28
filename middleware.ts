import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getModuleByRoute } from './config/modules.config';
import { getAuthenticatedUserRole, getUserRole } from './lib/auth';
import { verify2FAAttestation } from './lib/security/two-factor';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://bsvnyibipcwrcyzqilge.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_IZmrUzhCzPpLG5ZuWVxY_A_QxQJl5Hg';
  const path = request.nextUrl.pathname;

  // 1. Check disabled public modules first (fast block for unauthenticated visitors)
  const moduleDef = getModuleByRoute(path);
  if (moduleDef && !moduleDef.enabled && !path.startsWith('/admin')) {
    const hasAuthCookie = request.cookies.getAll().some(
      c => c.name.startsWith('sb-') || c.name === 'kclmc_session' || c.name.includes('better-auth.session_token')
    );
    if (!hasAuthCookie) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
    }
  }

  // 1.4. Resolve Cloudflare runtime environment bindings and secrets across all isolates
  let cfSecret: string | undefined = process.env.BETTER_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  let cfEnv: Record<string, any> | undefined;
  try {
    const { getCloudflareEnv } = await import('./lib/db/d1');
    cfEnv = await getCloudflareEnv();
    if (cfEnv) {
      cfSecret = cfSecret || cfEnv.BETTER_AUTH_SECRET || cfEnv.SUPABASE_SERVICE_ROLE_KEY;
    }
  } catch (envErr) {
    console.warn('[Middleware] Cloudflare env resolution warning:', envErr);
  }

  // 1.5. Check Better Auth Edge Session on D1 first (sub-5ms)
  const hasBetterAuthCookie = request.cookies.getAll().some(c => c.name.includes('better-auth.session_token'));
  if (hasBetterAuthCookie) {
    try {
      const { getD1Database } = await import('./lib/db/d1');
      const env = cfEnv;
      const db = (await getD1Database()) || env?.DB;
      if (db) {
        const { createBetterAuth } = await import('./lib/auth/better-auth');
        const auth = createBetterAuth({ ...env, DB: db });
        const session = await auth.api.getSession({ headers: request.headers });

        if (session?.user) {
          const baUser = session.user;
          const emailRole = getUserRole(baUser.email);
          let role = 0;
          if (emailRole >= 1) {
            role = emailRole;
          } else {
            try {
              const profile = await db.prepare('SELECT role FROM profiles WHERE id = ?').bind(baUser.id).first();
              if (profile && ((profile as any).role === 1 || (profile as any).role === 2)) {
                role = (profile as any).role;
              }
            } catch {}
          }

          // Admin API checks
          const isOrdersAdminApi =
            path.startsWith('/api/orders') &&
            (request.method === 'PUT' ||
              request.method === 'DELETE' ||
              (request.method === 'GET' && !request.nextUrl.searchParams.has('code')));

          const isAdminApi =
            path.startsWith('/api/admin') ||
            path.startsWith('/api/reconcile') ||
            (path.startsWith('/api/roster') && !path.startsWith('/api/roster/link')) ||
            (path.startsWith('/api/links') && request.method !== 'GET') ||
            isOrdersAdminApi ||
            (path === '/api/telemetry' && request.method === 'GET');

          if (isAdminApi && role < 1) {
            return NextResponse.json({ error: 'Unauthorized: Committee access required' }, { status: 403 });
          }

          // Mandatory Committee 2FA check
          if (role >= 1 && process.env.NODE_ENV === 'production') {
            const attestationCookie = request.cookies.get('kclmc_2fa_verified')?.value;
            const is2FAVerified = verify2FAAttestation(attestationCookie, baUser.id, cfSecret, baUser.email);
            if (!is2FAVerified) {
              if (path.startsWith('/admin') || path === '/status' || path.startsWith('/status/')) {
                return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}&error=2fa_required`, request.url));
              }
              if (isAdminApi) {
                return NextResponse.json({ error: 'Unauthorized: Two-Factor Authentication required' }, { status: 403 });
              }
            }
          }

          // Admin page clearance
          if (path.startsWith('/admin') || path === '/status' || path.startsWith('/status/')) {
            if (role < 1) {
              return NextResponse.redirect(new URL(`/403?req=committee&from=${encodeURIComponent(path)}`, request.url));
            }
            if (moduleDef && !moduleDef.enabled && role < 2) {
              return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
            }
            if (path.startsWith('/admin/ml') && role < 2) {
              return NextResponse.redirect(new URL(`/403?req=superadmin&from=${encodeURIComponent(path)}`, request.url));
            }
          }

          // Disabled public module checks
          if (moduleDef && !moduleDef.enabled && !path.startsWith('/admin')) {
            if (role < 2) {
              return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
            }
          }

          // Authenticated via Better Auth, allow pass-through
          return supabaseResponse;
        }
      }
    } catch (baErr) {
      console.warn('[Middleware] Better Auth edge resolution non-fatal warning:', baErr);
    }
  }

  // 2. Fallback check if Supabase is unconfigured
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder-project')) {
    if (path.startsWith('/admin') || path === '/status' || path.startsWith('/status/')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }
    const isOrdersAdminApi =
      path.startsWith('/api/orders') &&
      (request.method === 'PUT' ||
        request.method === 'DELETE' ||
        (request.method === 'GET' && !request.nextUrl.searchParams.has('code')));

    if (
      path.startsWith('/api/admin') ||
      path.startsWith('/api/reconcile') ||
      (path.startsWith('/api/roster') && !path.startsWith('/api/roster/link')) ||
      (path.startsWith('/api/links') && request.method !== 'GET') ||
      isOrdersAdminApi ||
      (path === '/api/telemetry' && request.method === 'GET')
    ) {
      return NextResponse.json({ error: 'Unauthorized: Committee access required' }, { status: 403 });
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
          })
        );
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Server-side middleware protection for Admin API endpoints
  const isOrdersAdminApi =
    path.startsWith('/api/orders') &&
    (request.method === 'PUT' ||
      request.method === 'DELETE' ||
      (request.method === 'GET' && !request.nextUrl.searchParams.has('code')));

  const isAdminApi =
    path.startsWith('/api/admin') ||
    path.startsWith('/api/reconcile') ||
    (path.startsWith('/api/roster') && !path.startsWith('/api/roster/link')) ||
    (path.startsWith('/api/links') && request.method !== 'GET') ||
    isOrdersAdminApi ||
    (path === '/api/telemetry' && request.method === 'GET');

  if (isAdminApi) {
    const role = user ? await getAuthenticatedUserRole(supabase, user) : 0;
    if (role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required' },
        { status: 403 }
      );
    }
    if (process.env.NODE_ENV === 'production') {
      const attestationCookie = request.cookies.get('kclmc_2fa_verified')?.value;
      const is2FAVerified = verify2FAAttestation(attestationCookie, user?.id, cfSecret, user?.email);
      if (!is2FAVerified) {
        return NextResponse.json({ error: 'Unauthorized: Two-Factor Authentication required' }, { status: 403 });
      }
    }
  }

  // 4. Server-side middleware protection for /admin and /status pages (Committee clearance required)
  if (path.startsWith('/admin') || path === '/status' || path.startsWith('/status/')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
    }

    const role = await getAuthenticatedUserRole(supabase, user);
    if (role < 1) {
      return NextResponse.redirect(new URL(`/403?req=committee&from=${encodeURIComponent(path)}`, request.url));
    }

    if (process.env.NODE_ENV === 'production') {
      const attestationCookie = request.cookies.get('kclmc_2fa_verified')?.value;
      const is2FAVerified = verify2FAAttestation(attestationCookie, user.id, cfSecret, user.email);
      if (!is2FAVerified) {
        return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}&error=2fa_required`, request.url));
      }
    }

    if (moduleDef && !moduleDef.enabled && role < 2) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
    }

    if (path.startsWith('/admin/ml') && role < 2) {
      return NextResponse.redirect(new URL(`/403?req=superadmin&from=${encodeURIComponent(path)}`, request.url));
    }
  }

  // 5. Enforce disabled public module restrictions (superadmins with role >= 2 can preview/bypass)
  if (moduleDef && !moduleDef.enabled && !path.startsWith('/admin')) {
    const role = user ? await getAuthenticatedUserRole(supabase, user) : 0;
    if (role < 2) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
