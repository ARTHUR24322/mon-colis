import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/session-server';

// -- Routes protégées et les rôles autorisés pour chacune ---------------------
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
    // C3 FIX: /livreur était entièrement public — maintenant protégé
    prefix: '/livreur',
    roles: ['livreur'],
    redirect: '/auth/livreur/login',
  },
  {
    // C3 FIX: /point-relais était entièrement public — maintenant protégé
    prefix: '/point-relais',
    roles: ['point_relais'],
    redirect: '/auth/point-relais/login',
  },
  {
    prefix: '/admin-x9k2/dashboard',
    roles: ['superadmin', 'admin_agences', 'admin_relais', 'admin_vendeurs', 'admin_service_client'],
    redirect: '/admin-x9k2',
  },
];

const SESSION_COOKIE = 'mc_session';

// -- Headers de sécurité appliqués à toutes les réponses ----------------------
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // -- 1. REDIRECTION DES SESSIONS ACTIVES DEPUIS L'ACCUEIL OU LOGIN --------
  // Un utilisateur déjà connecté ne doit pas rester sur l'écran d'accueil ou de login
  if (pathname === '/' || pathname === '/login') {
    if (token) {
      const payload = await verifyToken(token);
      if (payload && payload.role) {
        let destination = '/dashboard/vendeur';
        if (payload.role === 'agence') destination = '/dashboard/agence';
        else if (payload.role === 'livreur') destination = '/livreur';
        else if (payload.role === 'point_relais') destination = '/point-relais';
        else if (payload.role === 'superadmin') destination = '/admin-x9k2/dashboard';

        const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
        return applySecurityHeaders(redirectResponse);
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // -- 2. VÉRIFICATION DES ROUTES PROTÉGÉES ---------------------------------
  const matched = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));

  if (!matched) {
    return applySecurityHeaders(NextResponse.next());
  }

  // -- Vérification cookie de session ----------------------------------------
  if (!token) {
    // Pas de session — redirection vers la page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
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
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  // Vérification du rôle autorisé
  if (!matched.roles.includes(payload.role)) {
    // Mauvais rôle — redirection vers la bonne page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('error', 'role_mismatch');
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse);
    return redirectResponse;
  }

  // [OK] Session valide — laisser passer, injecter les infos dans les headers
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  response.headers.set('x-user-role', payload.role);
  response.headers.set('x-user-name', encodeURIComponent(payload.name));
  response.headers.set('Cache-Control', 'no-store');

  // Headers de sécurité spécifiques au dashboard admin
  if (matched.prefix === '/admin-x9k2/dashboard') {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  applySecurityHeaders(response);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/dashboard/vendeur/:path*',
    '/dashboard/agence/:path*',
    '/livreur/:path*',
    '/point-relais/:path*',
    '/admin-x9k2/dashboard/:path*',
  ],
};
