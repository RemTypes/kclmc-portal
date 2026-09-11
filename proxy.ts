import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserRole } from './lib/auth';
import { getModuleByRoute } from './config/modules.config';

export function proxy(request: NextRequest) {
  const email = request.cookies.get('user_email')?.value;
  const roleOverride = request.cookies.get('user_role_override')?.value;
  const role = getUserRole(email, roleOverride);
  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin/ml') || path.startsWith('/api/telemetry')) {
    if (role < 2) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=superadmin`, request.url));
    }
  } else if (path.startsWith('/admin')) {
    if (role < 1) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=committee`, request.url));
    }
  } else {
    const moduleDef = getModuleByRoute(path);
    if (moduleDef && !moduleDef.enabled && role < 2) {
      return NextResponse.redirect(new URL(`/403?from=${encodeURIComponent(path)}&req=disabled`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/telemetry/:path*'],
};

