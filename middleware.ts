import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getModuleByRoute } from './config/modules.config';
import { getAuthenticatedUserRole, getUserRole } from './lib/auth';

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
      c => c.name.startsWith('sb-') || c.name === 'kclmc_session'
    );
    if (!hasAuthCookie) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
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
    if (path.startsWith('/api/reconcile')) {
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
            sameSite: 'lax',
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
  const isAdminApi =
    path.startsWith('/api/reconcile') ||
    path === '/api/roster' ||
    (path === '/api/telemetry' && request.method === 'GET');

  if (isAdminApi) {
    const role = user ? await getAuthenticatedUserRole(supabase, user) : 0;
    if (role < 1) {
      return NextResponse.json(
        { error: 'Unauthorized: Committee access required' },
        { status: 403 }
      );
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
