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
    prefix: '/agence/dashboard',
    roles: ['agence'],
    redirect: '/agence/login',
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
function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Autoriser explicitement la caméra et géolocalisation pour le domaine
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');

  // Sécurité renforcée pour l'espace agence (route secrète)
  if (pathname && pathname.startsWith('/agence')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // -- 0. REDIRECTION DE L'ANCIEN DASHBOARD AGENCE VERS LA ROUTE SECRÈTE --
  if (pathname.startsWith('/dashboard/agence')) {
    const newUrl = new URL('/agence/dashboard', request.url);
    return applySecurityHeaders(NextResponse.redirect(newUrl), pathname);
  }

  // -- 1. REDIRECTION DES SESSIONS ACTIVES DEPUIS L'ACCUEIL OU LOGIN --------
  // Un utilisateur déjà connecté ne doit pas rester sur l'écran d'accueil ou de login
  if (pathname === '/' || pathname === '/login') {
    if (token) {
      const payload = await verifyToken(token);
      if (payload && payload.role) {
        let destination = '/dashboard/vendeur';
        if (payload.role === 'agence') destination = '/agence/dashboard';
        else if (payload.role === 'livreur') destination = '/livreur';
        else if (payload.role === 'point_relais') destination = '/point-relais';
        else if (payload.role === 'superadmin') destination = '/admin-x9k2/dashboard';

        const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
        return applySecurityHeaders(redirectResponse, pathname);
      }
    }
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // -- 2. VÉRIFICATION DES ROUTES PROTÉGÉES ---------------------------------
  const matched = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));

  if (!matched) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // -- Vérification cookie de session ----------------------------------------
  if (!token) {
    // Pas de session — redirection vers la page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse, pathname);
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
    applySecurityHeaders(redirectResponse, pathname);
    return redirectResponse;
  }

  // Vérification du rôle autorisé
  if (!matched.roles.includes(payload.role)) {
    // Mauvais rôle — redirection vers la bonne page de connexion
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('error', 'role_mismatch');
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse, pathname);
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

  applySecurityHeaders(response, pathname);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/(.*)',
  ],
};
