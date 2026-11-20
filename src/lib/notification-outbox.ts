/**
 * Moncolis – File d'envoi de notifications (Outbox Pattern)
 *
 * Fournit enqueueNotification() à appeler DANS la même transaction que l'événement métier.
 * Le cron /api/cron/notifications-outbox lit ensuite l'outbox et envoie via Telegram.
 *
 * SÉCURITÉ :
 * - Vérification des préférences utilisateur avant insertion
 * - Idempotence via ON CONFLICT (user_id, event_type, dedupe_key) DO NOTHING
 * - Isolation inter-agences : agency_id vérifié côté serveur
 * - Aucune donnée personnelle complète dans le payload
 */

import { supabaseAdmin } from '@/utils/supabase/admin';
import { NotificationEventType, AGENCY_EVENTS, SUPERADMIN_EVENTS } from '@/types/telegram-notifications';
import type { AgencyRole } from '@/lib/agencyPermissions';
import { sendTelegram } from '@/lib/telegram';
import { buildNotificationHtml } from '@/lib/telegram-format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnqueueParams {
  /** Identifiant de l'utilisateur destinataire */
  userId: string;
  /** Type d'événement Telegram */
  eventType: NotificationEventType;
  /**
   * Payload JSON minimal : identifiants et chiffres uniquement.
   * INTERDIT : OTP, PIN, mots de passe, tokens, téléphones complets, adresses complètes.
   */
  payload: Record<string, unknown>;
  /**
   * Clé de déduplication : garantit qu'un même événement n'est enfilé qu'une seule fois.
   * Format recommandé : "<eventType>:<entityId>:<date_heure_tronquée>"
   * Exemple : "NOUVEAU_COLIS_AGENCE:colis-123:2024-01-15T14"
   */
  dedupeKey: string;
  /** ID agence (pour l'isolation inter-agences) */
  agencyId?: string;
  /** Rôle agence de l'utilisateur (pour vérifier les droits sur l'événement) */
  agencyRole?: AgencyRole | string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPERADMIN_ID = 'superadmin-master-id';

/** Vérifie que l'utilisateur est autorisé à recevoir ce type d'événement. */
function isEventAllowedForUser(
  eventType: NotificationEventType,
  userId: string,
  agencyRole?: AgencyRole | string
): boolean {
  const isSuperAdmin = userId === SUPERADMIN_ID;

  if (isSuperAdmin) {
    return eventType in SUPERADMIN_EVENTS;
  }

  const def = AGENCY_EVENTS[eventType as keyof typeof AGENCY_EVENTS];
  if (!def) return false;
  if (!agencyRole) return false;
  if (!def.allowedRoles) return true;
  return def.allowedRoles.includes(agencyRole as AgencyRole);
}

// ---------------------------------------------------------------------------
// enqueueNotification — Point d'entrée principal
// ---------------------------------------------------------------------------

/**
 * Enfile une notification Telegram dans l'outbox.
 * À appeler dans la même transaction que l'événement métier ou juste après.
 *
 * Ne lève JAMAIS d'erreur vers l'appelant : une notification ratée
 * ne doit pas faire échouer l'opération métier principale.
 */
export async function enqueueNotification(params: EnqueueParams): Promise<void> {
  const { userId, eventType, payload, dedupeKey, agencyId, agencyRole } = params;

  try {
    // 1. Vérification des droits sur l'événement
    if (!isEventAllowedForUser(eventType, userId, agencyRole)) {
      return; // Silencieux — pas une erreur
    }

    // 2. Vérifier que l'utilisateur a un canal Telegram actif et vérifié
    const { data: channel } = await supabaseAdmin
      .from('notification_channels')
      .select('id, address, enabled, verified_at')
      .eq('user_id', userId)
      .eq('channel', 'telegram')
      .maybeSingle();

    if (!channel || !channel.enabled || !channel.verified_at) {
      return; // Pas de canal → rien à faire
    }

    // 3. Vérifier la préférence utilisateur pour ce type d'événement
    const { data: pref } = await supabaseAdmin
      .from('notification_preferences')
      .select('enabled')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .maybeSingle();

    // Si la préférence existe et est désactivée → ne pas envoyer
    if (pref && pref.enabled === false) {
      return;
    }

    // 4. Insertion dans l'outbox (idempotente)
    const nextTryAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('notification_outbox')
      .insert({
        user_id: userId,
        channel: 'telegram',
        event_type: eventType,
        payload: {
          ...payload,
          // Métadonnées de routage (jamais des données personnelles)
          _agency_id: agencyId ?? null,
        },
        dedupe_key: dedupeKey,
        status: 'pending',
        attempts: 0,
        next_try_at: nextTryAt,
      });

    // ON CONFLICT (user_id, event_type, dedupe_key) → ignoré silencieusement
    if (error && error.code !== '23505') {
      // 23505 = unique_violation → déduplication OK, pas une erreur
      console.error('[Outbox] Erreur insertion:', error.code, eventType);
    }

    // 5. Dispatch instantané (non-bloquant) si l'insertion est acceptée
    if (!error && channel?.address) {
      try {
        const { html, buttonUrl, buttonLabel } = buildNotificationHtml(eventType, payload);
        const button = buttonUrl ? { label: buttonLabel ?? 'Voir', url: buttonUrl } : undefined;
        sendTelegram(channel.address, html, button)
          .then(async () => {
            await supabaseAdmin
              .from('notification_outbox')
              .update({ status: 'sent', updated_at: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('event_type', eventType)
              .eq('dedupe_key', dedupeKey);
          })
          .catch(() => {
            // En cas d'échec transitoire, la ligne reste 'pending' pour le cron
          });
      } catch {
        // Ignorer pour ne jamais impacter le flux métier
      }
    }

  } catch (err) {
    // Jamais de propagation : la notification ne doit pas faire échouer l'opération métier
    console.error('[Outbox] Erreur inattendue:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// enqueueNotificationForAgencyMembers — Enfile pour tous les membres éligibles
// ---------------------------------------------------------------------------

/**
 * Enfile une notification pour TOUS les membres actifs d'une agence
 * qui ont le droit de recevoir ce type d'événement.
 *
 * Utilisé pour les événements d'agence (nouveau colis, versement, etc.)
 */
export async function enqueueNotificationForAgencyMembers(params: {
  agencyId: string;
  eventType: NotificationEventType;
  payload: Record<string, unknown>;
  dedupeKey: string;
}): Promise<void> {
  const { agencyId, eventType, payload, dedupeKey } = params;

  try {
    // Récupérer tous les membres actifs de l'agence avec un canal Telegram lié
    const { data: members, error } = await supabaseAdmin
      .from('agency_members')
      .select('id, role, is_active')
      .eq('agency_id', agencyId)
      .eq('is_active', true);

    if (error || !members || members.length === 0) return;

    // Enfile pour chaque membre éligible (vérification du rôle dans enqueueNotification)
    const tasks = members.map((member) =>
      enqueueNotification({
        userId: member.id,
        eventType,
        payload,
        dedupeKey: `${dedupeKey}:${member.id}`,
        agencyId,
        agencyRole: member.role as AgencyRole,
      })
    );

    await Promise.allSettled(tasks);

  } catch (err) {
    console.error('[Outbox] Erreur enqueueForAgencyMembers:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Calcul du délai de réessai exponentiel
// ---------------------------------------------------------------------------

/**
 * Délai de réessai en secondes selon le nombre de tentatives déjà effectuées.
 * Tentative 1 → 30s, 2 → 2min, 3 → 10min, 4 → 30min, 5+ → 1h
 */
export function getRetryDelaySeconds(attempts: number): number {
  const delays = [30, 120, 600, 1800, 3600];
  return delays[Math.min(attempts, delays.length - 1)];
}
