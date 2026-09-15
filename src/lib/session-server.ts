/**
 * Moncolis — Gestion de Session Sécurisée (Server-Side Only)
 * Utilise HMAC-SHA256 natif (crypto Web API), aucune dépendance externe.
 * Les tokens sont stockés dans des cookies httpOnly, Secure, SameSite=Lax.
 */

import { cookies } from 'next/headers';

export type UserRole = 'vendeur' | 'agence' | 'livreur' | 'point_relais' | 'superadmin';

export interface SessionPayload {
  userId: string;
  role: UserRole;
  name: string;
  email?: string;
  phone?: string;
  agencyId?: string;
  driverId?: string;
  dropPointId?: string;
  agentNumber?: string;
  iat: number; // issued at (timestamp ms)
  exp: number; // expiration (timestamp ms)
}

// -- Secret key — OBLIGATOIRE via variable d'environnement
// En développement : définir SESSION_SECRET dans .env.local
// En production   : définir SESSION_SECRET dans les secrets du serveur (min 64 chars)
const SECRET = process.env.SESSION_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error(
    '[Moncolis] SESSION_SECRET est absent ou trop court (min 32 caractères). ' +
    'Définissez SESSION_SECRET dans votre fichier .env.local ou les variables du serveur.'
  );
}

const COOKIE_NAME = 'mc_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// -- Encode base64url (URL-safe)
function b64url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('base64url');
}

// -- HMAC-SHA256 signing
async function sign(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64url(sig);
}

// -- HMAC-SHA256 verification (constant-time safe via crypto.subtle)
async function verify(data: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SECRET),
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

// -- Create a signed session token: payload.signature
export async function createToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Date.now();
  const full: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + SESSION_DURATION_MS,
  };
  const encoded = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = await sign(encoded);
  return `${encoded}.${sig}`;
}

// -- Verify and decode a token, returning null if invalid/expired
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;

    const encoded = token.substring(0, dotIdx);
    const sig = token.substring(dotIdx + 1);

    const valid = await verify(encoded, sig);
    if (!valid) return null;

    const payload: SessionPayload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));

    // Check expiry
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// -- Read the current session from the request cookie (Server Component / Route Handler)
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// -- Set the session cookie (used in API Route Handlers)
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000, // seconds
  });
}

// -- Clear the session cookie (logout)
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
