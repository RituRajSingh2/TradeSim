import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware — lightweight routing logic.
 *
 * Auth strategy (MVP):
 * - Access token is in memory/localStorage (client-side only)
 * - Refresh token is in httpOnly cookie (invisible to JS & middleware)
 * - Route protection is handled CLIENT-SIDE by AuthProvider
 *
 * This middleware does NOT enforce authentication.
 * It handles:
 * - Redirecting authenticated users away from /login (via a soft hint cookie)
 * - Passing through all other requests
 *
 * SSR-level auth protection is deferred to a later phase.
 */

const AUTH_ROUTES = new Set(['/login']);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, assets, and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // If user visits /login but has an active refresh cookie,
  // redirect to /home (they're likely already authenticated).
  // This is a UX convenience, not a security measure.
  if (AUTH_ROUTES.has(pathname)) {
    const hasRefreshCookie = request.cookies.has('tradesim_refresh');
    if (hasRefreshCookie) {
      return NextResponse.redirect(new URL('/home', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
