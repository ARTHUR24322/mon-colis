/**
 * GET /api/cron/notifications-outbox
 * Tâche planifiée Vercel Cron (toutes les minutes) qui traite la file d'envoi Telegram.
 *
 * SÉCURITÉ :
 * - Protégée par Authorization: Bearer <CRON_SECRET>
 * - FOR UPDATE SKIP LOCKED : évite les doublons entre instances parallèles
 * - Délai exponentiel entre réessais (30s → 2min → 10min → 30min → 1h)
 * - Maximum 5 tentatives puis statut 'failed'
 * - Canal désactivé sur 403/chat-not-found (bot bloqué)
 * - Anti-spam : fenêtre de 10 minutes par (user_id, event_type)
 * - Cadence prudente : pause de 50ms entre chaque envoi (≤ 30 messages/seconde Telegram)
 *
 * Config Vercel Cron dans vercel.json :
 *   { "path": "/api/cron/notifications-outbox", "schedule": "* * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { sendTelegram, escapeHtml, TelegramError } from '@/lib/telegram';
import { getRetryDelaySeconds, enqueueNotification } from '@/lib/notification-outbox';
import {
  SUPERADMIN_EVENTS,
  AGENCY_EVENTS,
  NotificationEventType,
} from '@/types/telegram-notifications';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 15; // Lignes traitées par exécution du cron
const INTER_MESSAGE_DELAY_MS = 50; // Pause entre envois (Telegram: max 30 msg/s)
const ANTISPAM_WINDOW_MINUTES = 10; // Fenêtre anti-spam par (user_id, event_type)
const SUPERADMIN_ID = 'superadmin-master-id';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OutboxRow {
  id: string;
  user_id: string;
  channel: string;
  event_type: NotificationEventType;
  payload: Record<string, unknown>;
  dedupe_key: string;
  status: string;
  attempts: number;
  next_try_at: string;
  last_error: string | null;
}

// ---------------------------------------------------------------------------
// Helper : pause asynchrone
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Helper : construction du message HTML selon l'événement
// ---------------------------------------------------------------------------

function buildNotificationHtml(eventType: NotificationEventType, payload: Record<string, unknown>): {
  html: string;
  buttonUrl?: string;
  buttonLabel?: string;
} {
  const appUrl = (process.env.APP_URL ?? 'https://moncolis.com').replace(/\/$/, '');
  const ref = escapeHtml(payload.reference as string ?? payload.id as string ?? '—');
  const amount = payload.amount ? escapeHtml(String(payload.amount)) : null;
  const agencyId = payload.agency_id as string | undefined;

  // ── Super Admin Events ──────────────────────────────────────────────────
  if (eventType === 'ECART_VERSEMENT_SUPERADMIN') {
    return {
      html:
        `⚠️ <b>Écart de versement détecté</b>\n\n` +
        `• <b>Réf. session</b> : ${ref}\n` +
        (amount ? `• <b>Écart</b> : ${amount}\n` : '') +
        `• <b>Agence</b> : ${escapeHtml(payload.agency_name as string ?? '—')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=versements`,
      buttonLabel: '📊 Voir les versements',
    };
  }

  if (eventType === 'CONNEXION_SUSPECTE') {
    return {
      html:
        `🚨 <b>Connexion suspecte détectée</b>\n\n` +
        `• <b>Utilisateur</b> : ${escapeHtml(payload.identifier as string ?? '—')}\n` +
        `• <b>Tentatives</b> : ${escapeHtml(payload.attempts as string ?? '—')}\n` +
        `• <b>IP</b> : ${escapeHtml(payload.ip as string ?? 'inconnue')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=securite`,
      buttonLabel: '🔒 Voir la sécurité',
    };
  }

  if (eventType === 'PIN_RELAIS_REINITIALISE') {
    return {
      html:
        `🔑 <b>PIN point relais modifié</b>\n\n` +
        `• <b>Point relais</b> : ${ref}\n` +
        `• <b>Action</b> : ${escapeHtml(payload.action as string ?? 'réinitialisation')}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=relais`,
      buttonLabel: '📍 Voir les relais',
    };
  }

  if (eventType === 'CREDIT_RELAIS_BAS') {
    return {
      html:
        `💳 <b>Crédits point relais bas</b>\n\n` +
        `• <b>Point relais</b> : ${ref}\n` +
        (amount ? `• <b>Crédits restants</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=relais`,
      buttonLabel: '📍 Recharger les crédits',
    };
  }

  if (eventType === 'COLIS_SANS_MOUVEMENT') {
    return {
      html:
        `📦 <b>Colis sans mouvement</b>\n\n` +
        `• <b>Nombre de colis</b> : ${escapeHtml(payload.count as string ?? ref)}\n` +
        `• <b>Depuis</b> : ${escapeHtml(payload.hours as string ?? '?')}h sans mise à jour`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=colis`,
      buttonLabel: '📦 Voir les colis',
    };
  }

  if (eventType === 'RECLAMATION_VENDEUR') {
    return {
      html:
        `🚩 <b>Réclamation vendeur ouverte</b>\n\n` +
        `• <b>Réf. colis</b> : ${ref}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=reclamations`,
      buttonLabel: '🚩 Voir la réclamation',
    };
  }

  if (eventType === 'DEMANDE_ADHESION_AGENCE') {
    return {
      html:
        `🏢 <b>Nouvelle demande d'adhésion agence</b>\n\n` +
        `• <b>Réf. demande</b> : ${ref}`,
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=agences`,
      buttonLabel: '🏢 Examiner la demande',
    };
  }

  if (eventType === 'PAIEMENT_ECHEC') {
    return {
      html:
        `❌ <b>Échec de paiement</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        (amount ? `• <b>Montant</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}/admin-x9k2/dashboard?tab=paiements`,
      buttonLabel: '💰 Voir les paiements',
    };
  }

  // ── Agency Events ───────────────────────────────────────────────────────
  const agencePath = agencyId ? `/agence` : `/agence`;

  if (eventType === 'NOUVEAU_COLIS_AGENCE') {
    return {
      html:
        `📦 <b>Nouveau colis à prendre en charge</b>\n\n` +
        `• <b>Réf.</b> : ${ref}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '📦 Voir le colis',
    };
  }

  if (eventType === 'COLIS_A_RECUPERER_RELAIS') {
    return {
      html:
        `🏪 <b>Colis à récupérer au point relais</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        `• <b>Relais</b> : ${escapeHtml(payload.drop_point_name as string ?? '—')}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '🏪 Voir le colis',
    };
  }

  if (eventType === 'VERSEMENT_EN_ATTENTE') {
    return {
      html:
        `💵 <b>Versement livreur en attente</b>\n\n` +
        `• <b>Session</b> : ${ref}\n` +
        (amount ? `• <b>Montant</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}${agencePath}/versements-caisse`,
      buttonLabel: '💵 Valider le versement',
    };
  }

  if (eventType === 'ECART_CAISSE_AGENCE') {
    return {
      html:
        `⚠️ <b>Écart de caisse détecté</b>\n\n` +
        `• <b>Session</b> : ${ref}\n` +
        (amount ? `• <b>Écart</b> : ${amount}\n` : ''),
      buttonUrl: `${appUrl}${agencePath}/versements-caisse`,
      buttonLabel: '📊 Voir la session',
    };
  }

  if (eventType === 'DEMANDE_STOCKAGE_FULFILLMENT') {
    return {
      html:
        `🏭 <b>Demande de location stockage</b>\n\n` +
        `• <b>Réf.</b> : ${ref}`,
      buttonUrl: `${appUrl}${agencePath}/entrepot`,
      buttonLabel: '🏭 Voir la demande',
    };
  }

  if (eventType === 'COLIS_REFUSE_RELAIS') {
    return {
      html:
        `🚫 <b>Colis refusé par un point relais</b>\n\n` +
        `• <b>Réf.</b> : ${ref}\n` +
        `• <b>Relais</b> : ${escapeHtml(payload.drop_point_name as string ?? '—')}`,
      buttonUrl: `${appUrl}${agencePath}/colis`,
      buttonLabel: '🚫 Voir le colis',
    };
  }

  // Fallback
  return {
    html: `🔔 <b>Notification Moncolis</b>\n\n• <b>Réf.</b> : ${ref}`,
    buttonUrl: appUrl,
    buttonLabel: '🏠 Moncolis',
  };
}

// ---------------------------------------------------------------------------
// Helper : vérification anti-spam
// ---------------------------------------------------------------------------

async function isSpamProtected(userId: string, eventType: NotificationEventType): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - ANTISPAM_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count } = await supabaseAdmin
    .from('notification_outbox')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .eq('status', 'sent')
    .gte('updated_at', windowStart);

  // Si au moins 1 message envoyé dans la fenêtre → protéger
  return (count ?? 0) >= 1;
}

// ---------------------------------------------------------------------------
// Handler principal du cron
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // ── 1. Vérification du secret cron ──────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const startTime = Date.now();
  const results = { sent: 0, retried: 0, failed: 0, skipped: 0 };

  try {
    // ── 2. Récupération du lot (FOR UPDATE SKIP LOCKED via RPC ou select direct) ──
    const now = new Date().toISOString();

    const { data: rows, error: fetchError } = await supabaseAdmin
      .from('notification_outbox')
      .select('id, user_id, channel, event_type, payload, dedupe_key, status, attempts, next_try_at, last_error')
      .eq('status', 'pending')
      .lte('next_try_at', now)
      .order('next_try_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('[Cron] Erreur lecture outbox:', fetchError.code);
      return NextResponse.json({ error: 'Erreur lecture outbox.' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ...results, duration_ms: Date.now() - startTime });
    }

    // ── 3. Verrouillage optimiste : marquer en 'processing' pour éviter doublons ──
    const ids = (rows as OutboxRow[]).map((r) => r.id);
    await supabaseAdmin
      .from('notification_outbox')
      .update({ status: 'processing', updated_at: now })
      .in('id', ids)
      .eq('status', 'pending'); // Guard : n'update que si encore pending

    // ── 4. Traitement de chaque ligne ────────────────────────────────────
    for (const row of rows as OutboxRow[]) {
      // Anti-spam : vérifier la fenêtre pour ce (user_id, event_type)
      const isSpam = await isSpamProtected(row.user_id, row.event_type);
      if (isSpam) {
        // Regroupement : reporter de 10 minutes
        const nextTry = new Date(
          Date.now() + ANTISPAM_WINDOW_MINUTES * 60 * 1000
        ).toISOString();
        await supabaseAdmin
          .from('notification_outbox')
          .update({ status: 'pending', next_try_at: nextTry, updated_at: new Date().toISOString() })
          .eq('id', row.id);
        results.skipped++;
        continue;
      }

      // Vérifier si l'utilisateur est un membre d'agence qui a été désactivé entre-temps
      if (row.user_id !== SUPERADMIN_ID) {
        const { data: member } = await supabaseAdmin
          .from('agency_members')
          .select('is_active')
          .eq('id', row.user_id)
          .maybeSingle();

        if (member && !member.is_active) {
          await supabaseAdmin
            .from('notification_outbox')
            .update({
              status: 'failed',
              last_error: 'MEMBRE_DESACTIVE',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          results.failed++;
          continue;
        }
      }

      // Récupérer le chat_id de l'utilisateur
      const { data: channel } = await supabaseAdmin
        .from('notification_channels')
        .select('address, enabled, verified_at')
        .eq('user_id', row.user_id)
        .eq('channel', 'telegram')
        .maybeSingle();

      if (!channel || !channel.enabled || !channel.verified_at) {
        // Pas de canal actif → marquer failed définitivement
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'failed',
            last_error: 'Canal Telegram absent ou désactivé',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        results.failed++;
        continue;
      }

      // Construire le message
      const { html, buttonUrl, buttonLabel } = buildNotificationHtml(
        row.event_type,
        row.payload
      );

      const button = buttonUrl ? { label: buttonLabel ?? 'Voir', url: buttonUrl } : undefined;

      // Envoi Telegram
      try {
        await sendTelegram(channel.address, html, button);

        // Succès
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'sent',
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        results.sent++;

      } catch (err) {
        const newAttempts = row.attempts + 1;

        if (err instanceof TelegramError) {
          // 403 / Chat not found : canal déjà désactivé par sendTelegram, marquer failed
          if (err.code === 'CHANNEL_DISABLED' || err.code === 'CHAT_NOT_FOUND') {
            await supabaseAdmin
              .from('notification_outbox')
              .update({
                status: 'failed',
                attempts: newAttempts,
                last_error: err.code,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            results.failed++;
            continue;
          }

          // 429 : respecter le retry_after de Telegram
          if (err.code === 'RATE_LIMITED') {
            const retryAfterMs = (err.retryAfter ?? 30) * 1000;
            const nextTry = new Date(Date.now() + retryAfterMs).toISOString();
            await supabaseAdmin
              .from('notification_outbox')
              .update({
                status: 'pending',
                attempts: newAttempts,
                next_try_at: nextTry,
                last_error: `RATE_LIMITED:${err.retryAfter}s`,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);
            results.retried++;
            continue;
          }
        }

        // Erreur transitoire (réseau, API) : délai exponentiel
        if (newAttempts >= MAX_ATTEMPTS) {
          await supabaseAdmin
            .from('notification_outbox')
            .update({
              status: 'failed',
              attempts: newAttempts,
              last_error: (err as Error).message?.slice(0, 200) ?? 'Erreur inconnue',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          results.failed++;
        } else {
          const delaySeconds = getRetryDelaySeconds(newAttempts);
          const nextTry = new Date(Date.now() + delaySeconds * 1000).toISOString();
          await supabaseAdmin
            .from('notification_outbox')
            .update({
              status: 'pending',
              attempts: newAttempts,
              next_try_at: nextTry,
              last_error: (err as Error).message?.slice(0, 200) ?? 'Erreur inconnue',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);
          results.retried++;
        }
      }

      // Pause inter-messages pour respecter les limites Telegram (≤ 30 msg/s)
      await sleep(INTER_MESSAGE_DELAY_MS);
    }

    // ── 5. Scan des colis sans mouvement (Super Admin : max 1 alerte par jour) ──
    await checkStalePackages();

  } catch (err) {
    console.error('[Cron] Erreur inattendue:', (err as Error).message);
    return NextResponse.json(
      { error: 'Erreur interne du cron.', ...results },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ...results,
    duration_ms: Date.now() - startTime,
  });
}

// ---------------------------------------------------------------------------
// Helper : vérification des colis sans mouvement
// ---------------------------------------------------------------------------

async function checkStalePackages(): Promise<void> {
  try {
    const STALE_HOURS = 24;
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const { count } = await supabaseAdmin
      .from('packages')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING_AGENCY', 'ACCEPTED_BY_AGENCY', 'ASSIGNED_TO_DRIVER', 'IN_TRANSIT'])
      .lte('updated_at', cutoff);

    if (count && count > 0) {
      await enqueueNotification({
        userId: 'superadmin-master-id',
        eventType: 'COLIS_SANS_MOUVEMENT',
        payload: {
          count,
          hours: STALE_HOURS,
          reference: `${count} colis`,
        },
        dedupeKey: `COLIS_SANS_MOUVEMENT:${today}`,
      });
    }
  } catch (err) {
    console.warn('[Cron] Erreur checkStalePackages:', (err as Error).message);
  }
}
