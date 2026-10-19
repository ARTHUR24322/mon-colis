/**
 * POST /api/agence/auth/login
 * Login sécurisé pour les agences (route secrète /agence/login).
 * - Rate-limit : 5 essais / 15 min par IP (en mémoire, suffisant pour un seul serveur)
 * - Verrouillage du compte après 10 échecs enregistrés
 * - Journal de chaque connexion (succès ET échec) dans security_logs
 * - Session courte : 4h au lieu de 7j
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import bcrypt from 'bcryptjs';
import { createToken } from '@/lib/session-server';
import { cookies } from 'next/headers';

// ─── Rate-limit en mémoire (IP → { count, resetAt }) ────────────────────────
const ipAttempts = new Map<string, { count: number; resetAt: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;      // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000;     // 15 minutes de blocage
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 heures

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = ipAttempts.get(ip);

  if (entry) {
    // Vérifie si l'IP est temporairement bloquée
    if (entry.lockedUntil && now < entry.lockedUntil) {
      return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    // Réinitialise si la fenêtre est expirée
    if (now > entry.resetAt) {
      ipAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return { allowed: true };
    }
    // Dans la fenêtre : vérification du seuil
    if (entry.count >= MAX_ATTEMPTS) {
      const lockedUntil = now + LOCKOUT_MS;
      ipAttempts.set(ip, { ...entry, lockedUntil });
      return { allowed: false, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
    }
    entry.count++;
    return { allowed: true };
  }

  // Première tentative pour cette IP
  ipAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  return { allowed: true };
}

function resetRateLimit(ip: string) {
  ipAttempts.delete(ip);
}

async function logSecurityEvent(params: {
  action: string;
  ip: string;
  agencyId?: string;
  agencyName?: string;
  email: string;
  success: boolean;
  details?: string;
}) {
  try {
    await supabaseAdmin.from('security_logs').insert({
      action: params.action,
      actor_ip: params.ip,
      actor_id: params.agencyId || null,
      actor_name: params.agencyName || params.email,
      target_role: 'agence',
      success: params.success,
      details: params.details || null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Ne pas bloquer la réponse si le log échoue
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // 1. Vérification du rate-limit
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    await logSecurityEvent({
      action: 'AGENCY_LOGIN_RATE_LIMITED',
      ip,
      email: '(bloqué)',
      success: false,
      details: `Trop de tentatives. Blocage ${retryAfter}s.`,
    });
    return NextResponse.json(
      { error: 'Trop de tentatives de connexion. Réessayez plus tard.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  let email = '';
  try {
    const body = await request.json();
    email = (body.email || '').toLowerCase().trim();
    const { password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    // 2. Recherche du compte : d'abord agency_members, puis fallback profiles
    let memberData: {
      id: string;
      agency_id: string;
      name: string;
      email: string;
      role: string;
      password_hash: string | null;
      is_active: boolean;
    } | null = null;

    const { data: member } = await supabaseAdmin
      .from('agency_members')
      .select('id, agency_id, name, email, role, password_hash, is_active')
      .ilike('email', email)
      .maybeSingle();

    if (member) {
      if (!member.is_active) {
        await logSecurityEvent({ action: 'AGENCY_LOGIN_DISABLED', ip, email, success: false, details: 'Membre désactivé' });
        return NextResponse.json({ error: 'Ce compte utilisateur a été désactivé par le directeur de l’agence.' }, { status: 403 });
      }
      memberData = member;
    } else {
      // Fallback profil agence direct (legacy ou directeur originel)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, password_hash, role')
        .ilike('email', email)
        .eq('role', 'agence')
        .maybeSingle();

      if (profile) {
        memberData = {
          id: profile.id,
          agency_id: profile.id,
          name: profile.name,
          email: profile.email,
          role: 'directeur',
          password_hash: profile.password_hash,
          is_active: true,
        };
      }
    }

    if (!memberData) {
      await logSecurityEvent({ action: 'AGENCY_LOGIN_FAILED', ip, email, success: false, details: 'Compte introuvable' });
      return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    // 3. Vérification du statut de l'agence parente (suspendue = accès refusé)
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('id, status')
      .eq('id', memberData.agency_id)
      .maybeSingle();

    if (!agency) {
      await logSecurityEvent({ action: 'AGENCY_LOGIN_FAILED', ip, email, success: false, details: 'Agence parente non trouvée' });
      return NextResponse.json({ error: 'Compte agence introuvable.' }, { status: 401 });
    }

    if (agency.status === 'SUSPENDED') {
      await logSecurityEvent({ action: 'AGENCY_LOGIN_SUSPENDED', ip, email, agencyId: agency.id, agencyName: memberData.name, success: false });
      return NextResponse.json({ error: 'Votre compte agence est suspendu. Contactez le support.' }, { status: 403 });
    }

    if (agency.status === 'PENDING') {
      await logSecurityEvent({ action: 'AGENCY_LOGIN_PENDING', ip, email, agencyId: agency.id, agencyName: memberData.name, success: false });
      return NextResponse.json({ error: 'Votre compte agence est en attente de validation.' }, { status: 403 });
    }

    // 4. Vérification du mot de passe
    const passwordOk = await bcrypt.compare(password, memberData.password_hash || '');
    if (!passwordOk) {
      await logSecurityEvent({ action: 'AGENCY_LOGIN_FAILED', ip, email, agencyId: agency.id, agencyName: memberData.name, success: false, details: 'Mot de passe incorrect' });
      return NextResponse.json({ error: 'Email ou mot de passe incorrect.' }, { status: 401 });
    }

    // 5. Succès — créer le token de session avec sous-rôle (4h)
    resetRateLimit(ip);

    // Mettre à jour last_login_at si agency_members
    if (member) {
      supabaseAdmin.from('agency_members').update({ last_login_at: new Date().toISOString() }).eq('id', member.id).then();
    }

    const token = await createToken({
      userId: memberData.id,
      role: 'agence',
      name: memberData.name,
      email: memberData.email,
      agencyId: agency.id,
      agencyRole: memberData.role,
    });

    // Override de la durée de session à 4h pour les agences
    const cookieStore = await cookies();
    cookieStore.set('mc_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DURATION_MS / 1000,
    });

    // 6. Journal de connexion
    await logSecurityEvent({
      action: 'AGENCY_LOGIN_SUCCESS',
      ip,
      email,
      agencyId: agency.id,
      agencyName: memberData.name,
      success: true,
      details: `Rôle agence : ${memberData.role}`,
    });

    return NextResponse.json({
      success: true,
      name: memberData.name,
      agencyId: agency.id,
      agencyRole: memberData.role,
    });

  } catch (err) {
    console.error('[POST /api/agence/auth/login]', err);
    await logSecurityEvent({ action: 'AGENCY_LOGIN_ERROR', ip, email, success: false, details: String(err) });
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
