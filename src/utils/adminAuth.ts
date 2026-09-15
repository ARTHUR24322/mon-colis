// --- Super Admin Authentication Utilities ------------------------------------
// Le hash du mot de passe admin est lu depuis les variables d'environnement.
// En production, définissez ADMIN_PASSWORD_HASH dans .env.local
// Pour générer : node -e "const c=require('crypto');c.subtle.digest('SHA-256',new TextEncoder().encode('VOTRE_MOT_DE_PASSE')).then(b=>console.log(Buffer.from(b).toString('hex')))"

// Fallback uniquement en développement local si la variable n'est pas définie
const _DEV_FALLBACK_HASH = process.env.NODE_ENV === 'production'
  ? undefined
  : process.env.ADMIN_PASSWORD_HASH;

export function getAdminPasswordHash(): string {
  const hash = process.env.ADMIN_PASSWORD_HASH || _DEV_FALLBACK_HASH;
  if (!hash) {
    throw new Error('[adminAuth] ADMIN_PASSWORD_HASH non défini dans les variables d\'environnement.');
  }
  return hash;
}

// Session key stored in sessionStorage (clears when tab is closed)
const SESSION_KEY = '__moncolis_admin_session__';
const SESSION_VALUE = 'authenticated_superadmin_v1';

// OTP stored in memory only (not in localStorage / sessionStorage)
let _memoryOTP: string | null = null;
let _otpExpiry: number | null  = null;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// --- SHA-256 via Web Crypto API -----------------------------------------------
export async function hashPassword(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data     = encoder.encode(plain);
  const hashBuf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- OTP ---------------------------------------------------------------------
export function generateOTP(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  _memoryOTP = otp;
  _otpExpiry = Date.now() + OTP_TTL_MS;

  // Display in console — visible only to someone with DevTools open
  console.clear();
  console.log('%c[MONCOLIS SUPER ADMIN]', 'color: #22c55e; font-size: 1.2rem; font-weight: bold;');
  console.log(`%cCode OTP : ${otp}`, 'color: #4ade80; font-size: 2rem; font-weight: 900; letter-spacing: 0.2em;');
  console.log(`%cValable jusqu'à : ${new Date(Date.now() + OTP_TTL_MS).toLocaleTimeString()}`, 'color: #9ca3af; font-size: 0.9rem;');

  return otp;
}

export function verifyOTP(input: string): boolean {
  if (!_memoryOTP || !_otpExpiry) return false;
  if (Date.now() > _otpExpiry) {
    _memoryOTP = null;
    _otpExpiry = null;
    return false;
  }
  return input.trim() === _memoryOTP;
}

export function clearOTP(): void {
  _memoryOTP = null;
  _otpExpiry = null;
}

// --- Session ------------------------------------------------------------------
export function createSession(): void {
  sessionStorage.setItem(SESSION_KEY, SESSION_VALUE);
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE;
}

export function destroySession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// --- Brute-force protection ---------------------------------------------------
const MAX_ATTEMPTS  = 3;
const COOLDOWN_MS   = 30_000;
let _attempts       = 0;
let _lockedUntil: number | null = null;

export function checkBruteForce(): { locked: boolean; remainingMs: number } {
  if (_lockedUntil && Date.now() < _lockedUntil) {
    return { locked: true, remainingMs: _lockedUntil - Date.now() };
  }
  if (_lockedUntil && Date.now() >= _lockedUntil) {
    _attempts   = 0;
    _lockedUntil = null;
  }
  return { locked: false, remainingMs: 0 };
}

export function recordFailedAttempt(): { locked: boolean; remainingMs: number } {
  _attempts++;
  if (_attempts >= MAX_ATTEMPTS) {
    _lockedUntil = Date.now() + COOLDOWN_MS;
    _attempts    = 0;
    return { locked: true, remainingMs: COOLDOWN_MS };
  }
  return { locked: false, remainingMs: 0 };
}

export function resetAttempts(): void {
  _attempts    = 0;
  _lockedUntil = null;
}
