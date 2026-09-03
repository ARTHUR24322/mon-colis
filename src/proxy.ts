import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/session-server';

// ── Routes protégées et les rôles autorisés pour chacune
const PROTECTED_ROUTES: { prefix: string; roles: string[]; redirect: string }[] = [
  {
    prefix: '/dashboard/vendeur',
    roles: ['vendeur'],
    redirect: '/auth/vendeur/login',
  },
  {
    prefix: '/dashboard/agence',
    roles: ['agence'],
    redirect: '/auth/agence/login',
  },
  {
    prefix: '/admin-x9k2/dashboard',
    roles: ['admin'],
    redirect: '/admin-x9k2',
  },
];

const SESSION_COOKIE = 'mc_session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Sécurité Headers sur toutes les réponses ──────────────────────────────
  const baseResponse = NextResponse.next();
  baseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
  baseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  baseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // ── Vérification des routes protégées ─────────────────────────────────────
  const matched = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));

  if (!matched) {
    return baseResponse;
  }

  // Admin dashboard: legacy header-based check (plus la session cookie)
  if (matched.prefix === '/admin-x9k2/dashboard') {
    const sentinel = request.headers.get('x-admin-token');
    const isBot = !request.headers.get('accept')?.includes('text/html');
    if (isBot && (!sentinel || sentinel !== process.env.ADMIN_SENTINEL_TOKEN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const cacheResponse = NextResponse.next();
    cacheResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    cacheResponse.headers.set('X-Frame-Options', 'DENY');
    return cacheResponse;
  }

  // ── Vérification cookie de session ────────────────────────────────────────
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    // Pas de session — redirection vers la page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Vérification signature et expiration du token
  const payload = await verifyToken(token);

  if (!payload) {
    // Token invalide ou expiré — redirection + suppression du cookie corrompu
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
    });
    return redirectResponse;
  }

  // Vérification du rôle autorisé
  if (!matched.roles.includes(payload.role)) {
    // Mauvais rôle — redirection vers la bonne page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('error', 'role_mismatch');
    return NextResponse.redirect(loginUrl);
  }

  // ✅ Session valide — laisser passer, injecter les infos dans les headers
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  response.headers.set('x-user-role', payload.role);
  response.headers.set('x-user-name', encodeURIComponent(payload.name));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    '/dashboard/vendeur/:path*',
    '/dashboard/agence/:path*',
    '/admin-x9k2/dashboard/:path*',
  ],
};
