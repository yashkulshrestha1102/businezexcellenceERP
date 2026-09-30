import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const ADMIN_ONLY_ROUTES = [
  '/employees',
  '/attendance',
  '/leave',
  '/assets',
  '/mail',
  '/reports',
  '/settings',
];

const PUBLIC_ROUTES = ['/', '/login', '/forgot-password', '/reset-password', '/auth'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Update session & fetch auth state
  const { response, user, profile } = await updateSession(request);

  const isPublicRoute = PUBLIC_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );

  // 1. Not logged in + protected route → login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 2. Logged in + on login/root → dashboard
  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // 3. Role-based server-side protection
  if (user && profile) {
    const isAdminRoute = ADMIN_ONLY_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(r + '/')
    );

    if (isAdminRoute && profile.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon, icons, manifest (public files)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|css|js|map)$).*)',
  ],
};