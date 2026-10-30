/**
 * Moncolis — Gestion de Session Admin Sécurisée (Server-Side Only)
 *
 * Utilise HMAC-SHA256 natif (Web Crypto API), aucune dépendance externe.
 * Le token de session est stocké dans un cookie httpOnly `admin_session`.
 *
 * Flux :
 *   1. L'admin soumet email + password → génération OTP (cookie admin_otp_hash + admin_otp_meta)
 *   2. L'admin entre l'OTP → verification → création du cookie admin_session
 *   3. Chaque route API protégée appelle requireAdminSession() → valide le cookie
 *   4. Logout → clearAdminSessionCookie()
 */

import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { AdminRole } from '@/lib/adminPermissions';
import fs from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const COOKIE_NAME   = 'admin_session';
const SESSION_TTL   = 8 * 60 * 60 * 1000; // 8 heures

export interface AdminSessionPayload {
  role:  AdminRole;
  email: string;
  iat:   number; // issued at (ms)
  exp:   number; // expires at (ms)
}

// ─── Secret ──────────────────────────────────────────────────────────────────

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      '[adminSession] SESSION_SECRET absent ou trop court (min 32 chars). ' +
      'Définissez-le dans .env.local'
    );
  }
  return s;
}

// ─── HMAC-SHA256 helpers ──────────────────────────────────────────────────────

async function hmacSign(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Buffer.from(sig).toString('base64url');
}

async function hmacVerify(data: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  try {
    const sigBytes = Buffer.from(signature, 'base64url');
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data));
  } catch {
    return false;
  }
}

// ─── Token encoding / decoding ────────────────────────────────────────────────

async function encodeToken(payload: AdminSessionPayload): Promise<string> {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig     = await hmacSign(encoded);
  return `${encoded}.${sig}`;
}

async function decodeToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const dot     = token.lastIndexOf('.');
    if (dot < 0) return null;

    const encoded = token.substring(0, dot);
    const sig     = token.substring(dot + 1);

    const valid = await hmacVerify(encoded, sig);
    if (!valid) return null;

    const payload: AdminSessionPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    );

    if (Date.now() > payload.exp) return null; // expiré

    return payload;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Crée et pose le cookie de session admin sécurisé.
 * À appeler dans la route POST /api/auth/admin-otp/verify après succès.
 */
export async function createAdminSessionCookie(
  role:  AdminRole,
  email: string
): Promise<void> {
  const now     = Date.now();
  const payload: AdminSessionPayload = { role, email, iat: now, exp: now + SESSION_TTL };
  const token   = await encodeToken(payload);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_TTL / 1000, // secondes
  });
}

/**
 * Lit et valide le cookie de session admin (pour Server Components et Route Handlers).
 * Retourne le payload ou null si absent/invalide/expiré.
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return decodeToken(token);
  } catch {
    return null;
  }
}

/**
 * Guard pour Route Handlers : retourne le payload admin si la session est valide,
 * sinon retourne null. Vérifier côté appelant et renvoyer 401/403 si null.
 *
 * Usage dans une route API :
 *   const admin = await requireAdminSession();
 *   if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
 */
export async function requireAdminSession(): Promise<AdminSessionPayload | null> {
  return getAdminSession();
}

/**
 * Supprime le cookie de session admin (logout).
 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
    expires:  new Date(0),
  });
}

// ─── Cookie de métadonnées OTP (intermédiaire) ────────────────────────────────

const OTP_META_COOKIE = 'admin_otp_meta';

export interface AdminOtpMeta {
  role:  AdminRole;
  email: string;
}

/**
 * Stocke role + email en attendant la vérification OTP.
 * Durée : 5 minutes (alignée sur l'OTP).
 */
export async function setAdminOtpMeta(meta: AdminOtpMeta): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OTP_META_COOKIE, JSON.stringify(meta), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   5 * 60, // 5 minutes
  });
}

/**
 * Lit les métadonnées OTP depuis le cookie.
 */
export async function getAdminOtpMeta(): Promise<AdminOtpMeta | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(OTP_META_COOKIE)?.value;
    if (!raw) return null;
    return JSON.parse(raw) as AdminOtpMeta;
  } catch {
    return null;
  }
}

/**
 * Supprime le cookie de métadonnées OTP.
 */
export async function clearAdminOtpMeta(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OTP_META_COOKIE, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   0,
    expires:  new Date(0),
  });
}

/**
 * Récupère le code de sécurité critique ADVANCED_ADMIN_PIN.
 * Seul le Super Admin général peut l'utiliser.
 * Ne retourne JAMAIS de code par défaut (aucun fallback en dur).
 */
export function getAdvancedAdminPin(): string | null {
  if (process.env.ADVANCED_ADMIN_PIN) {
    const val = process.env.ADVANCED_ADMIN_PIN.trim();
    if (val) return val;
  }
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/^ADVANCED_ADMIN_PIN=["']?([^"'\r\n]+)["']?$/m);
      if (match && match[1]?.trim()) return match[1].trim();
    }
  } catch {}
  return null;
}
