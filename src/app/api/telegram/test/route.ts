/**
 * POST /api/telegram/test
 * Envoie un message de test Telegram à l'utilisateur connecté.
 *
 * SÉCURITÉ :
 * - Requiert une session valide (superadmin ou agence)
 * - Rate limit : 2 requêtes / 5 minutes par utilisateur
 * - Log d'audit sans contenu sensible
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { sendTelegram, escapeHtml, TelegramError } from '@/lib/telegram';
import { rateLimit } from '@/lib/rateLimit';

function resolveUserId(session: Awaited<ReturnType<typeof getSession>>): string | null {
  if (!session) return null;
  if (session.role === 'superadmin') return 'superadmin-master-id';
  if (session.role === 'agence') return session.userId;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const session = await getSession();
    if (!session || (session.role !== 'superadmin' && session.role !== 'agence')) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }

    const userId = resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
    }

    // 2. Rate limit : 2 messages test / 5 minutes
    const rl = rateLimit(request, {
      max: 2,
      windowMs: 5 * 60_000,
      blockDurationMs: 5 * 60_000,
      identifier: `tg-test:${userId}`,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Trop de messages de test. Réessayez dans 5 minutes.' },
        { status: 429 }
      );
    }

    // 3. Récupérer le chat_id actif
    const { data: channel } = await supabaseAdmin
      .from('notification_channels')
      .select('address, enabled, verified_at')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .maybeSingle();

    if (!channel || !channel.enabled || !channel.verified_at) {
      return NextResponse.json(
        { error: 'Aucun compte Telegram lié et actif. Liez d\'abord votre Telegram.' },
        { status: 400 }
      );
    }

    // 4. Construction du message de test (aucune donnée personnelle)
    const appUrl = process.env.APP_URL ?? 'https://moncolis.com';
    const roleName = session.role === 'superadmin' ? 'Super Admin' : `Agence (${escapeHtml(session.agencyRole ?? session.role)})`;
    const html =
      `🔔 <b>Message de test Moncolis</b>\n\n` +
      `✅ Votre Telegram est bien lié à la plateforme.\n` +
      `Vous recevrez les alertes importantes ici.\n\n` +
      `• <b>Rôle</b> : ${escapeHtml(roleName)}\n` +
      `• <b>Date</b> : ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })}`;

    // 5. Envoi
    await sendTelegram(channel.address, html, {
      label: '🏠 Accéder à Moncolis',
      url: appUrl,
    });

    // 6. Log d'audit
    await supabaseAdmin.from('financial_audit_logs').insert({
      action: 'TELEGRAM_TEST_SENT',
      performed_by: userId,
      details: { role: session.role, agency_id: session.agencyId ?? null },
    }).then(() => {/* non bloquant */});

    return NextResponse.json({ success: true });

  } catch (err) {
    if (err instanceof TelegramError) {
      if (err.code === 'CHANNEL_DISABLED' || err.code === 'CHAT_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Votre bot Telegram a été bloqué ou le chat est introuvable. Votre canal a été désactivé.' },
          { status: 400 }
        );
      }
      if (err.code === 'RATE_LIMITED') {
        return NextResponse.json(
          { error: `Telegram rate limit — réessayez dans ${err.retryAfter ?? 30} secondes.` },
          { status: 429 }
        );
      }
    }
    console.error('[TelegramTest] Erreur:', (err as Error).message);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du message de test.' }, { status: 500 });
  }
}
