/**
 * Moncolis — Rate Limiter (in-memory, server-side only)
 * Protège les routes sensibles contre les attaques brute-force.
 * Fonctionne avec les API Routes de Next.js (Node.js runtime).
 *
 * Usage :
 *   import { rateLimit } from '@/lib/rateLimit';
 *   const result = await rateLimit(request, { max: 5, windowMs: 60_000 });
 *   if (!result.success) return NextResponse.json({ error: result.message }, { status: 429 });
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  firstHit: number;
  blocked: boolean;
  blockedAt?: number;
}

interface RateLimitOptions {
  /** Nombre max de requêtes dans la fenêtre */
  max: number;
  /** Fenêtre de temps en ms (défaut: 60 secondes) */
  windowMs?: number;
  /** Durée du blocage en ms si dépassé (défaut: 15 minutes) */
  blockDurationMs?: number;
  /** Identifiant custom (défaut: IP de la requête) */
  identifier?: string;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  message?: string;
  retryAfterMs?: number;
}

// Map en mémoire — se réinitialise au redémarrage du serveur
const store = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées (toutes les 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    const maxWindow = Math.max(60_000, 15 * 60_000); // au moins 15 min
    if (now - entry.firstHit > maxWindow * 2) {
      store.delete(key);
    }
  }
}, 5 * 60_000);

/**
 * Retourne l'IP réelle de la requête (prise en charge des proxies)
 */
function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    '127.0.0.1'
  );
}

/**
 * Applique le rate limiting sur la requête.
 */
export function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const {
    max,
    windowMs = 60_000,
    blockDurationMs = 15 * 60_000,
    identifier,
  } = options;

  const ip = identifier || getIp(request);
  const routeKey = request.nextUrl.pathname;
  const key = `rl:${routeKey}:${ip}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry) {
    // Première requête
    store.set(key, { count: 1, firstHit: now, blocked: false });
    return { success: true, remaining: max - 1 };
  }

  // Si actuellement bloqué
  if (entry.blocked && entry.blockedAt) {
    const elapsed = now - entry.blockedAt;
    if (elapsed < blockDurationMs) {
      return {
        success: false,
        remaining: 0,
        message: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
        retryAfterMs: blockDurationMs - elapsed,
      };
    } else {
      // Déblocage après la durée
      store.set(key, { count: 1, firstHit: now, blocked: false });
      return { success: true, remaining: max - 1 };
    }
  }

  // Vérifier si on est dans la fenêtre de temps
  if (now - entry.firstHit > windowMs) {
    // Nouvelle fenêtre
    store.set(key, { count: 1, firstHit: now, blocked: false });
    return { success: true, remaining: max - 1 };
  }

  // Incrémenter le compteur
  entry.count++;

  if (entry.count > max) {
    entry.blocked = true;
    entry.blockedAt = now;
    store.set(key, entry);
    return {
      success: false,
      remaining: 0,
      message: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
      retryAfterMs: blockDurationMs,
    };
  }

  store.set(key, entry);
  return { success: true, remaining: max - entry.count };
}

/**
 * Helper — Ajoute les headers standard de rate limit à une réponse
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  max: number
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(max));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  if (result.retryAfterMs) {
    response.headers.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
  }
  return response;
}
