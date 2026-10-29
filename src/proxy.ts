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

// -- Rate limiting en mémoire Edge (brute-force sur routes auth) --------------
const rateLimitStore = new Map<string, { count: number; firstHit: number; blocked: boolean; blockedAt?: number }>();

function checkRateLimit(key: string, max: number, windowMs: number, blockMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry) {
    rateLimitStore.set(key, { count: 1, firstHit: now, blocked: false });
    return true;
  }
  if (entry.blocked && entry.blockedAt) {
    if (now - entry.blockedAt < blockMs) return false;
    rateLimitStore.set(key, { count: 1, firstHit: now, blocked: false });
    return true;
  }
  if (now - entry.firstHit > windowMs) {
    rateLimitStore.set(key, { count: 1, firstHit: now, blocked: false });
    return true;
  }
  entry.count++;
  if (entry.count > max) {
    entry.blocked = true;
    entry.blockedAt = now;
    rateLimitStore.set(key, entry);
    return false;
  }
  rateLimitStore.set(key, entry);
  return true;
}

// Routes auth soumises au rate limiting : max 10 req / 5 min, blocage 15 min
const RATE_LIMITED_AUTH_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/admin-otp',
  '/api/admin/verify-pin',
  '/api/agence/auth/login',
];

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') ||
    '127.0.0.1'
  );
}

// -- Content Security Policy (CSP) -------------------------------------------
function buildCSP(isAdmin: boolean): string {
  const supabaseHost = 'https://lrtnfhhkconwbqjfafuj.supabase.co';
  const directives: string[] = [
    "default-src 'self'",
    `connect-src 'self' ${supabaseHost} https://nominatim.openstreetmap.org https://api.resend.com`,
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org",
    "media-src 'self' blob:",
    isAdmin ? "frame-ancestors 'none'" : "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];
  return directives.join('; ');
}

// -- Headers de sécurité appliqués à toutes les réponses ----------------------
function applySecurityHeaders(response: NextResponse, pathname?: string): NextResponse {
  const isAdmin  = !!pathname?.startsWith('/admin-x9k2');
  const isAgence = !!pathname?.startsWith('/agence');
  const isProtected = isAdmin || isAgence
    || !!pathname?.startsWith('/dashboard')
    || !!pathname?.startsWith('/livreur')
    || !!pathname?.startsWith('/point-relais');

  // Anti-clickjacking
  response.headers.set('X-Frame-Options', isAdmin ? 'DENY' : 'SAMEORIGIN');
  // Anti-MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // Contrôle du referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Protection XSS (navigateurs legacy)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // Permissions navigateur
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=()');
  // HSTS (HTTPS uniquement en production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  // Content Security Policy
  response.headers.set('Content-Security-Policy', buildCSP(isAdmin));
  // Masquer les espaces privés des moteurs de recherche
  if (isAdmin || isAgence) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  // No-cache sur pages authentifiées
  if (isProtected) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // -- 0. RATE LIMITING sur les routes d'authentification --------------------
  if (
    request.method === 'POST' &&
    RATE_LIMITED_AUTH_ROUTES.some(r => pathname.startsWith(r))
  ) {
    const ip = getIp(request);
    const rlKey = `auth:${pathname}:${ip}`;
    const allowed = checkRateLimit(rlKey, 10, 5 * 60_000, 15 * 60_000);
    if (!allowed) {
      const res = NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
        { status: 429 }
      );
      res.headers.set('Retry-After', '900');
      return applySecurityHeaders(res, pathname);
    }
  }

  // -- 1. REDIRECTION DE L'ANCIEN DASHBOARD AGENCE VERS LA ROUTE SECRÈTE ----
  if (pathname.startsWith('/dashboard/agence')) {
    const newUrl = new URL('/agence/dashboard', request.url);
    return applySecurityHeaders(NextResponse.redirect(newUrl), pathname);
  }

  // -- 2. REDIRECTION DES SESSIONS ACTIVES DEPUIS L'ACCUEIL OU LOGIN --------
  if (pathname === '/' || pathname === '/login') {
    if (token) {
      const payload = await verifyToken(token);
      if (payload && payload.role) {
        let destination = '/dashboard/vendeur';
        if (payload.role === 'agence')       destination = '/agence/dashboard';
        else if (payload.role === 'livreur') destination = '/livreur';
        else if (payload.role === 'point_relais') destination = '/point-relais';
        else if (payload.role === 'superadmin')   destination = '/admin-x9k2/dashboard';

        const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
        return applySecurityHeaders(redirectResponse, pathname);
      }
    }
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // -- 3. VÉRIFICATION DES ROUTES PROTÉGÉES ---------------------------------
  const matched = PROTECTED_ROUTES.find((r) => pathname.startsWith(r.prefix));

  if (!matched) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // -- Vérification cookie de session ----------------------------------------
  if (!token) {
    const loginUrl = new URL(matched.redirect, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse, pathname);
    return redirectResponse;
  }

  // Vérification signature et expiration du token
  const payload = await verifyToken(token);

  if (!payload) {
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

  applySecurityHeaders(response, pathname);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/(.*)',
  ],
};
