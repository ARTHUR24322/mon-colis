import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes protégées — accessibles uniquement si la session admin est active.
// La valeur de session est vérifiée côté client (sessionStorage).
// Ce middleware ajoute une couche de protection supplémentaire au niveau de l'URL.

const PROTECTED_PREFIX = '/admin-x9k2/dashboard';
const LOGIN_PATH       = '/admin-x9k2';

// Header sentinel — set by the client after successful auth.
// Since sessionStorage is not accessible in middleware (Edge runtime),
// we use a custom request header that the admin app sets on every fetch call.
// For direct URL navigation, the client-side `useEffect` in the dashboard handles
// the redirect. This middleware blocks automated/bot access at the edge.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard the dashboard subtree
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Block any request that doesn't carry the sentinel header.
  // Browser navigation won't have this header; protection is enforced
  // by the client-side auth check in the dashboard component.
  // This layer stops direct API/script access attempts.
  const sentinel = request.headers.get('x-admin-token');
  if (!sentinel || sentinel !== process.env.ADMIN_SENTINEL_TOKEN) {
    // Allow the browser through (the dashboard component will redirect if not authed)
    // but reject programmatic requests without the sentinel
    const accept = request.headers.get('accept') ?? '';
    if (!accept.includes('text/html')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Add security headers to all admin responses
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  response.headers.set('Pragma', 'no-cache');

  return response;
}

export const config = {
  matcher: ['/admin-x9k2/dashboard/:path*'],
};
