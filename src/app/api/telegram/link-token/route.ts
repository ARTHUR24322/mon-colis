/**
 * POST /api/telegram/link-token
 * Génère un lien de liaison Telegram pour le super admin ou un membre d'agence.
 *
 * SÉCURITÉ :
 * - Requiert une session valide (superadmin ou agence uniquement)
 * - Rate limit : 3 requêtes / 10 minutes par utilisateur
 * - Le token brut (32 octets hex) est renvoyé une seule fois et jamais stocké
 * - Seul le SHA-256 du token est enregistré en base de données
 * - Expiration : 10 minutes, usage unique
 *
 * DELETE /api/telegram/link-token
 * Délie le compte Telegram de l'utilisateur connecté.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { rateLimit } from '@/lib/rateLimit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calcule le SHA-256 d'un token (hex). Ne jamais stocker le token en clair. */
function sha256(token: string): string {
  return crypto.createHash('sha256').update(token, 'hex').digest('hex');
}

/** Vérifie que la session est superadmin ou agence (les seuls autorisés). */
function isAuthorized(role: string | undefined): boolean {
  return role === 'superadmin' || role === 'agence';
}

/** Retourne l'identifiant stable de l'utilisateur (userId pour admin, userId pour agence). */
function resolveUserId(session: Awaited<ReturnType<typeof getSession>>): string | null {
  if (!session) return null;
  if (session.role === 'superadmin') return 'superadmin-master-id';
  if (session.role === 'agence') return session.userId;
  return null;
}

// ---------------------------------------------------------------------------
// POST — Générer un lien de liaison
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Vérification de la session
    const session = await getSession();
    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé. Connexion requise (super admin ou agence).' },
        { status: 401 }
      );
    }

    const userId = resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
    }

    // 2. Rate limit : 3 demandes / 10 minutes par utilisateur
    const rl = rateLimit(request, {
      max: 3,
      windowMs: 10 * 60_000,
      blockDurationMs: 10 * 60_000,
      identifier: `tg-link:${userId}`,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Trop de demandes. Veuillez patienter 10 minutes avant de réessayer.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }

    // 3. Vérification des variables d'environnement
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (!botUsername) {
      return NextResponse.json(
        { error: 'Configuration Telegram manquante (TELEGRAM_BOT_USERNAME).' },
        { status: 500 }
      );
    }

    // 4. Génération du token (32 octets = 64 hex chars)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 minutes

    // 5. Nettoyage des anciens tokens non utilisés pour cet utilisateur (ménage proactif)
    await supabaseAdmin
      .from('telegram_link_tokens')
      .delete()
      .eq('user_id', userId)
      .is('used_at', null)
      .lt('expires_at', new Date().toISOString());

    // 6. Insertion du token hashé (jamais le token brut)
    const { error: insertError } = await supabaseAdmin
      .from('telegram_link_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        used_at: null,
      });

    if (insertError) {
      console.error('[TelegramLink] Erreur insertion token:', insertError.code);
      return NextResponse.json(
        { error: 'Erreur lors de la génération du lien.' },
        { status: 500 }
      );
    }

    // 7. Construction du lien deep link Telegram
    const link = `https://t.me/${botUsername}?start=${token}`;

    // 8. Log d'audit (sans le token ni son hash)
    await supabaseAdmin.from('financial_audit_logs').insert({
      action: 'TELEGRAM_LINK_GENERATED',
      performed_by: userId,
      details: {
        role: session.role,
        agency_id: session.agencyId ?? null,
        expires_at: expiresAt,
      },
    }).then(() => {/* audit non bloquant */});

    return NextResponse.json({ link }, { status: 200 });

  } catch (err) {
    console.error('[TelegramLink] Erreur inattendue:', (err as Error).message);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Délier le compte Telegram
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    // 1. Vérification de la session
    const session = await getSession();
    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json(
        { error: 'Accès non autorisé.' },
        { status: 401 }
      );
    }

    const userId = resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
    }

    // 2. Désactivation du canal (soft delete : enabled = false)
    const { error } = await supabaseAdmin
      .from('notification_channels')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('channel', 'telegram');

    if (error) {
      console.error('[TelegramLink] Erreur désactivation canal:', error.code);
      return NextResponse.json({ error: 'Erreur lors de la déliaison.' }, { status: 500 });
    }

    // 3. Log d'audit
    await supabaseAdmin.from('financial_audit_logs').insert({
      action: 'TELEGRAM_UNLINKED',
      performed_by: userId,
      details: {
        role: session.role,
        agency_id: session.agencyId ?? null,
      },
    }).then(() => {/* audit non bloquant */});

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err) {
    console.error('[TelegramLink] Erreur inattendue (DELETE):', (err as Error).message);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET — Statut du canal Telegram de l'utilisateur connecté
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !isAuthorized(session.role)) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }

    const userId = resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('notification_channels')
      .select('id, enabled, verified_at, created_at')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Erreur lecture canal.' }, { status: 500 });
    }

    return NextResponse.json({
      linked: !!data && data.enabled && !!data.verified_at,
      verified_at: data?.verified_at ?? null,
      enabled: data?.enabled ?? false,
    });

  } catch (err) {
    console.error('[TelegramLink] Erreur GET:', (err as Error).message);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
